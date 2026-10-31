import "server-only";
import type { AnalysisStage } from "@/lib/api-schemas";
import { ApiError } from "@/server/api/http";
import type { LlmClient } from "@/server/ai/llm";
import type { Repositories } from "@/server/db/repositories";
import type { SourceMetadata } from "@/server/db/types";
import { extractClaims } from "@/server/services/claimExtractor";
import { detectContradictions } from "@/server/services/contradictionDetector";
import { summarizeBundle, type FindingSummary } from "@/server/services/findings";
import { analyzeFreshness } from "@/server/services/freshnessAnalyzer";
import { detectGaps } from "@/server/services/gapDetector";
import { generateQuestions } from "@/server/services/questionGenerator";
import { generateChecklist } from "@/server/services/checklistGenerator";
import { generateReport } from "@/server/services/reportGenerator";
import type { StageContext } from "@/server/services/types";
import {
  checklistToRow,
  claimToRow,
  contradictionToRow,
  decodeFindings,
  freshnessToRow,
  questionToRow,
  rowToChecklist,
  rowToClaim,
  rowToSource,
  topicToRow,
} from "./mappers";
import { requireSession } from "./sources";

/**
 * Stage runners. Each one is a single short API call (fits Vercel's 60s cap), reads its inputs from the
 * database, and replaces its own outputs, so any stage can be re-run safely. The browser drives the
 * sequence: extract → claims (per source, per chunk) → gaps → contradictions → freshness → questions →
 * checklist → report.
 */

async function context(repos: Repositories, sessionId: string, llm?: LlmClient, now?: Date): Promise<StageContext> {
  const s = await requireSession(repos, sessionId);
  return { sessionId, brief: { topic: s.topic, question: s.question, objective: s.objective }, llm, now };
}

async function loadCorpus(repos: Repositories, sessionId: string) {
  const [sourceRows, claimRows] = await Promise.all([repos.sources.listBySession(sessionId, { withContent: true }), repos.claims.listBySession(sessionId)]);
  const all = sourceRows.map(rowToSource);
  const extracted = all.filter((s) => s.extractionStatus === "extracted" && s.contentText);
  const okIds = new Set(extracted.map((s) => s.id));
  return { all, sourceRows, sources: extracted, claims: claimRows.map(rowToClaim).filter((c) => okIds.has(c.sourceId)) };
}

function requireReadable(sources: unknown[]) {
  if (sources.length === 0) {
    throw new ApiError(422, "insufficient_sources", "None of the sources could be read, so there is nothing to analyse. Check the source errors, then retry or add other sources.");
  }
}

export async function runClaimsStage(repos: Repositories, sessionId: string, sourceId: string, chunk: number, llm: LlmClient) {
  const ctx = await context(repos, sessionId, llm);
  const row = await repos.sources.get(sourceId);
  if (!row || row.session_id !== sessionId) throw new ApiError(404, "not_found", "Source not found.");
  if (row.extraction_status !== "extracted" || !row.content_text) throw new ApiError(422, "insufficient_sources", "This source has no extracted text.");
  await repos.sessions.updateStatus(sessionId, "analyzing");
  if (chunk === 0) await repos.claims.deleteBySource(sourceId);
  const existing = chunk === 0 ? [] : await repos.claims.listBySource(sourceId);
  const seen = new Set(existing.map((c) => c.quote.toLowerCase().replace(/\s+/g, " ").trim()));

  const source = rowToSource(row);
  const prevMeta: SourceMetadata = row.metadata ?? {};
  try {
    const result = await extractClaims(source, ctx, chunk, seen);
    await repos.claims.addMany(result.claims.map((c) => claimToRow(sessionId, c)));
    const done = chunk + 1 >= result.chunksTotal;
    const rejected = (chunk === 0 ? 0 : prevMeta.claims?.rejected ?? 0) + result.rejected.filter((r) => r.reason === "quote_not_found").length;
    await repos.sources.update(sourceId, {
      metadata: { ...prevMeta, claims: { status: done ? "done" : "pending", chunksDone: chunk + 1, chunksTotal: result.chunksTotal, rejected } },
    });
    return {
      added: result.claims.length,
      rejectedUnverified: result.rejected.filter((r) => r.reason === "quote_not_found").length,
      chunk,
      chunksTotal: result.chunksTotal,
      nextChunk: done ? null : chunk + 1,
    };
  } catch (e) {
    if (!(e instanceof Error && "code" in e && (e as { code?: string }).code === "rate_limited")) {
      await repos.sources
        .update(sourceId, { metadata: { ...prevMeta, claims: { status: "failed", chunksDone: chunk, chunksTotal: prevMeta.claims?.chunksTotal ?? 0, rejected: prevMeta.claims?.rejected ?? 0, error: (e as Error).message.slice(0, 300) } } })
        .catch(() => undefined);
    }
    throw e;
  }
}

function summaries(decoded: ReturnType<typeof decodeFindings>, sourceName: (id: string) => string): FindingSummary[] {
  return summarizeBundle({ gaps: decoded.gaps, contradictions: decoded.contradictions, freshnessWarnings: decoded.freshness }, sourceName);
}

export async function runAnalysisStage(repos: Repositories, sessionId: string, stage: AnalysisStage, llm?: LlmClient, now?: Date) {
  const ctx = await context(repos, sessionId, llm, now);
  const corpus = await loadCorpus(repos, sessionId);
  requireReadable(corpus.sources);
  await repos.sessions.updateStatus(sessionId, "analyzing");
  const nameOf = (id: string) => {
    const i = corpus.all.findIndex((s) => s.id === id);
    return i >= 0 ? `S${i + 1}` : "source";
  };

  switch (stage) {
    case "gaps": {
      const r = await detectGaps(corpus, ctx);
      const gapById = new Map(r.gaps.map((g) => [g.id, g]));
      await repos.findings.replaceType(sessionId, "gap", r.coverage.map((t) => topicToRow(sessionId, t, gapById.get(t.id) ?? null)));
      return {
        topics: r.coverage.length,
        gaps: r.gaps.length,
        covered: r.coverage.filter((t) => t.status === "covered").length,
        partial: r.coverage.filter((t) => t.status === "partial").length,
        missing: r.coverage.filter((t) => t.status === "missing").length,
        askedScope: r.askedScope ?? null,
        downgraded: r.coverage.filter((t) => t.verification === "scope_mismatch" || t.verification === "aggregator_only").length,
        topicPlanning: r.planning ? (r.planning.aiUsed ? "checklist+ai" : "checklist") : undefined,
      };
    }
    case "contradictions": {
      const decoded = decodeFindings(await repos.findings.listBySession(sessionId, "gap"));
      if (decoded.coverage.length === 0) throw new ApiError(409, "bad_request", "Run gap detection first (contradictions are compared topic by topic).");
      const r = await detectContradictions({ ...corpus, coverage: decoded.coverage }, ctx);
      await repos.findings.replaceType(sessionId, "contradiction", r.contradictions.map((c) => contradictionToRow(sessionId, c)));
      return {
        contradictions: r.contradictions.filter((c) => c.kind !== "cycle_mismatch").length,
        cycleMismatches: r.contradictions.filter((c) => c.kind === "cycle_mismatch").length,
        groupsCompared: r.groupsCompared,
        pairsCompared: r.pairsCompared,
        valueDifferences: r.valueDifferences,
      };
    }
    case "freshness": {
      const r = await analyzeFreshness(corpus, ctx);
      await repos.findings.replaceType(sessionId, "freshness", r.warnings.map((w) => freshnessToRow(sessionId, w)));
      return { warnings: r.warnings.length, aiUsed: r.aiUsed, aiSuppressed: r.aiSuppressed ?? 0 };
    }
    case "questions": {
      const decoded = decodeFindings(await repos.findings.listBySession(sessionId));
      const qs = await generateQuestions(summaries(decoded, nameOf), ctx);
      await repos.findings.replaceType(sessionId, "question", qs.map((q) => questionToRow(sessionId, q)));
      return { questions: qs.length };
    }
    case "checklist": {
      const decoded = decodeFindings(await repos.findings.listBySession(sessionId));
      const all = [
        ...summaries(decoded, nameOf),
        ...decoded.questions.map((q) => ({ id: q.id, type: "question" as const, title: `Open question: ${q.question}`, detail: q.whyItMatters, severity: null })),
      ];
      const items = await generateChecklist(all, ctx);
      await repos.checklist.replaceForSession(sessionId, items.map((it, i) => checklistToRow(sessionId, it, i)));
      return { items: items.length };
    }
    case "report": {
      const [findingRows, checklistRows] = await Promise.all([repos.findings.listBySession(sessionId), repos.checklist.listBySession(sessionId)]);
      const decoded = decodeFindings(findingRows);
      const extra: string[] = [];
      const rejected = corpus.sourceRows.reduce((n, r) => n + (r.metadata?.claims?.rejected ?? 0), 0);
      if (rejected) extra.push(`${rejected} model-extracted claim(s) were discarded because their quote could not be found verbatim in the source text.`);
      const noClaims = corpus.sources.filter((s) => !corpus.claims.some((c) => c.sourceId === s.id));
      if (noClaims.length) extra.push(`${noClaims.length} readable source(s) yielded no claims relevant to the question: ${noClaims.map((s) => s.title ?? s.url ?? s.fileName).join("; ")}.`);
      if (!llm) extra.push("No AI provider was configured, so only extraction and rule-based freshness checks ran.");
      const truncated = corpus.sourceRows.filter((r) => r.metadata?.warnings?.some((w) => w.startsWith("Text truncated")));
      if (truncated.length) extra.push(`${truncated.length} long source(s) were truncated before analysis.`);
      const report = await generateReport(
        {
          sources: corpus.all,
          claims: corpus.claims,
          coverage: decoded.coverage,
          gaps: decoded.gaps,
          contradictions: decoded.contradictions,
          freshnessWarnings: decoded.freshness,
          questions: decoded.questions,
          checklist: checklistRows.map(rowToChecklist),
          limitations: extra,
          model: llm ? `${llm.provider}:${llm.model}` : "none (rule-based stages only)",
        },
        ctx,
      );
      await repos.reports.save({ session_id: sessionId, model: report.model, coverage_overview: report.coverageOverview, report: report as unknown as Record<string, unknown> });
      await repos.sessions.updateStatus(sessionId, "complete");
      return { reportId: report.id };
    }
  }
}
