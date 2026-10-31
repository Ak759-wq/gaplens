import "server-only";
import { evidenceKey, type ClaimView, type EvidenceContextMap, type QuoteContext, type SessionView, type SourceView } from "@/lib/view-types";
import type { Repositories } from "@/server/db/repositories";
import type { SourceRow } from "@/server/db/types";
import { safeHost } from "@/server/services/corpus";
import { verifyQuoteInSource } from "@/server/services/provenance";
import { decodeFindings, rowToChecklist, rowToClaim } from "./mappers";

const OFFICIAL_RE = /(\.gov\.in|\.nic\.in|\.gov|\.ac\.in|\.edu\.in|\.edu|\.res\.in|\.gov\.[a-z]{2})$/i;

export function toSourceView(r: SourceRow, index: number): SourceView {
  const m = r.metadata ?? {};
  return {
    id: r.id,
    alias: `S${index + 1}`,
    type: r.source_type,
    url: r.url,
    fileName: r.file_name,
    title: r.title,
    publishedAt: r.published_at,
    modifiedAt: m.modifiedAt ?? null,
    dateEvidence: m.dateEvidence ?? [],
    retrievedAt: r.retrieved_at,
    status: r.extraction_status,
    provider: m.provider ?? r.extraction_provider,
    error: r.extraction_error,
    charCount: m.charCount ?? (r.content_text ? r.content_text.length : null),
    warnings: m.warnings ?? [],
    official: !!r.url && OFFICIAL_RE.test(safeHost(r.url) ?? ""),
    claimsStatus: m.claims ?? null,
  };
}

export function quoteContext(text: string, start: number, end: number, pad = 160): QuoteContext {
  const s = Math.max(0, start - pad);
  const e = Math.min(text.length, end + pad);
  return {
    before: (s > 0 ? "…" : "") + text.slice(s, start).replace(/\s+/g, " ").trimStart(),
    match: text.slice(start, end),
    after: text.slice(end, e).replace(/\s+/g, " ").trimEnd() + (e < text.length ? "…" : ""),
  };
}

export async function buildSessionView(repos: Repositories, id: string): Promise<SessionView | null> {
  const session = await repos.sessions.get(id);
  if (!session) return null;
  const [sourceRows, claimRows, findingRows, checklistRows, reportRow] = await Promise.all([
    repos.sources.listBySession(id, { withContent: true }),
    repos.claims.listBySession(id),
    repos.findings.listBySession(id),
    repos.checklist.listBySession(id),
    repos.reports.latestForSession(id),
  ]);
  const textById = new Map(sourceRows.map((s) => [s.id, s.content_text ?? ""]));

  const claims: ClaimView[] = claimRows.map((r) => {
    const c = rowToClaim(r);
    const text = textById.get(c.sourceId) ?? "";
    let ctx: QuoteContext | null = null;
    if (text) {
      if (c.charStart != null && c.charEnd != null && c.charEnd <= text.length) ctx = quoteContext(text, c.charStart, c.charEnd);
      else {
        const v = verifyQuoteInSource(c.quote, text);
        if (v.verified) ctx = quoteContext(text, v.start, v.end);
      }
    }
    return { ...c, context: ctx };
  });

  const decoded = decodeFindings(findingRows);
  // Context for evidence that isn't attached to a claim (rule-based freshness evidence).
  const evidenceContext: EvidenceContextMap = {};
  const allEvidence = [
    ...decoded.freshness.flatMap((f) => f.evidence),
    ...decoded.contradictions.flatMap((c) => c.positions.flatMap((p) => p.evidence)),
    ...decoded.gaps.flatMap((g) => g.evidence),
  ];
  for (const e of allEvidence) {
    const key = evidenceKey(e.sourceId, e.quote);
    if (evidenceContext[key]) continue;
    const text = textById.get(e.sourceId);
    if (!text) continue;
    const v = verifyQuoteInSource(e.quote, text);
    if (v.verified) evidenceContext[key] = quoteContext(text, v.start, v.end);
  }

  const report = reportRow
    ? {
        generatedAt: reportRow.created_at,
        model: reportRow.model,
        coverageOverview: reportRow.coverage_overview,
        limitations: Array.isArray((reportRow.report as { limitations?: unknown }).limitations) ? ((reportRow.report as { limitations: string[] }).limitations) : [],
      }
    : null;

  return {
    session: {
      id: session.id,
      topic: session.topic,
      question: session.question,
      objective: session.objective,
      status: session.status,
      errorMessage: session.error_message,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
    },
    sources: sourceRows.map(toSourceView),
    claims,
    coverage: decoded.coverage,
    gaps: decoded.gaps,
    contradictions: decoded.contradictions,
    freshness: decoded.freshness,
    questions: decoded.questions,
    checklist: checklistRows.map(rowToChecklist),
    evidenceContext,
    report,
    stages: {
      gaps: decoded.coverage.length > 0,
      contradictions: !!report || decoded.contradictions.length > 0,
      freshness: !!report || decoded.freshness.length > 0,
      questions: !!report || decoded.questions.length > 0,
      checklist: !!report || checklistRows.length > 0,
      report: !!report,
    },
  };
}
