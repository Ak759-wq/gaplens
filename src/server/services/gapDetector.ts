import "server-only";
import { randomUUID } from "node:crypto";
import type { z } from "zod";
import { buildGapDetectionPrompt } from "@/server/ai/prompts";
import { coverageLlmSchema, type Claim, type Gap, type Source, type TopicCoverage } from "@/server/ai/schemas";
import { ConfigError } from "@/server/ai/errors";
import { claimsForPrompt, corpusAliases, evidenceFromClaims, sourcesForPrompt } from "./corpus";
import { claimScope, hasReliableDate, hostOf, isOfficialSource, parseAskedScope, type AskedScope } from "./scope";
import { planTopics, scopeLine, type PlannedTopic } from "./topicPlanner";
import type { ExtractedCorpus, StageContext } from "./types";

export type GapDetectionResult = {
  coverage: TopicCoverage[];
  gaps: Gap[];
  askedScope?: string | null;
  planning?: { aiUsed: boolean; aiError?: string; topics: number };
};

const MAX_CLAIMS_IN_PROMPT = 400;

/**
 * Gap detection in two separate calls:
 *  1. Topic planning from the brief + domain checklist only (never sees the claims), so topics are
 *     what the question NEEDS, not what the sources happen to say.
 *  2. Strict coverage assessment of those planned topics against verified claims.
 * Then deterministic post-checks (assessCoverage): coverage needs real evidence; if the question names
 * a cycle/year, evidence must match it; aggregator-only, undated evidence needs verification.
 */
export async function detectGaps(corpus: ExtractedCorpus, ctx: StageContext): Promise<GapDetectionResult> {
  if (!ctx.llm) throw new ConfigError("Configuration required: an AI provider key is needed for gap detection.", ["GEMINI_API_KEY"]);
  const scope = parseAskedScope(ctx.brief, ctx.now ?? new Date());
  const plan = await planTopics(ctx, scope);
  const claims = corpus.claims.slice(0, MAX_CLAIMS_IN_PROMPT);
  const al = corpusAliases({ sources: corpus.sources, claims });
  const topicsJson = JSON.stringify(plan.topics.map((t) => ({ key: t.key, label: t.label, whyItMatters: t.whyItMatters, timeSensitive: t.sensitivity === "claim" })));
  const out = await ctx.llm.generate(
    buildGapDetectionPrompt(ctx.brief, scopeLine(scope), topicsJson, claimsForPrompt(claims, al.claims, al.sources, 160), sourcesForPrompt(corpus.sources, al.sources)),
    coverageLlmSchema,
    { label: "Gap detection", signal: ctx.signal },
  );
  const r = assessCoverage(plan.topics, out.assessments, al.claims, corpus.sources, scope);
  return { ...r, askedScope: scope?.label ?? null, planning: { aiUsed: plan.aiUsed, aiError: plan.aiError, topics: plan.topics.length } };
}

type Assessment = z.infer<typeof coverageLlmSchema>["assessments"][number];
const keyOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function describeEvidence(claims: Claim[], sources: Map<string, Source>, scope: AskedScope, t: PlannedTopic): string {
  const parts = claims.slice(0, 3).map((c) => {
    const s = sources.get(c.sourceId);
    const name = hostOf(s?.url) ?? s?.fileName ?? "a source";
    const sc = claimScope(c, s, scope.cycleStart, t.sensitivity === "none" ? "source" : t.sensitivity);
    const where = sc.found.length ? `refers to ${sc.found.slice(0, 3).join(", ")}` : "states no year";
    return `${name}: "${clip(c.quote.replace(/\s+/g, " "), 110)}" (${where})`;
  });
  return parts.join("; ");
}

/**
 * Deterministic coverage normalisation. A topic is "covered" only when the model cites at least one
 * valid claim AND (when the question names a cycle) at least one cited claim matches that cycle AND
 * (for time-sensitive topics or a cycle-specific question) not every in-scope claim comes from an
 * undated third-party site. Everything else becomes a gap linked to the partial evidence.
 */
export function assessCoverage(
  planned: PlannedTopic[],
  assessments: Assessment[],
  claimAliases: { resolveMany(a: string[]): Claim[] },
  sources: Source[],
  scope: AskedScope | null,
): { coverage: TopicCoverage[]; gaps: Gap[] } {
  const byKey = new Map<string, Assessment>();
  for (const a of assessments) if (!byKey.has(keyOf(a.key))) byKey.set(keyOf(a.key), a);
  const srcById = new Map(sources.map((s) => [s.id, s]));
  const coverage: TopicCoverage[] = [];
  const gaps: Gap[] = [];
  const seen = new Set<string>();

  for (const t of planned) {
    if (seen.has(t.key)) continue;
    seen.add(t.key);
    const a = byKey.get(keyOf(t.key));
    const cited = a ? claimAliases.resolveMany(a.claimIds) : [];
    let status: TopicCoverage["status"] = a?.status ?? "missing";
    if (status === "covered" && cited.length === 0) status = "missing";
    if (status === "missing" && cited.length > 0) status = "partial";
    let verification: TopicCoverage["verification"] = status === "partial" ? "model_assessment" : null;
    let scopeNote: string | null = null;

    if (status === "covered" && t.sensitivity !== "none") {
      let inScope = cited;
      if (scope) {
        inScope = cited.filter((c) => claimScope(c, srcById.get(c.sourceId), scope.cycleStart, t.sensitivity as "claim" | "source").verdict === "match");
        if (inScope.length === 0) {
          status = "partial";
          verification = "scope_mismatch";
          scopeNote = `The question asks about ${scope.label}, but none of the cited evidence is stated for ${scope.label}. Found: ${describeEvidence(cited, srcById, scope, t)}.`;
        }
      }
      if (status === "covered" && (scope || t.sensitivity === "claim")) {
        const weak = inScope.every((c) => {
          const s = srcById.get(c.sourceId);
          return !!s && !isOfficialSource(s) && !hasReliableDate(s);
        });
        if (weak) {
          status = "partial";
          verification = "aggregator_only";
          const hosts = [...new Set(inScope.map((c) => hostOf(srcById.get(c.sourceId)?.url) ?? "a third-party site"))].join(", ");
          scopeNote = `Only ${hosts} (a third-party site without a reliable publication date) states this${scope ? ` for ${scope.label}` : ""}; no official or dated source in the review confirms it.`;
        }
      }
    }

    const id = randomUUID();
    coverage.push({
      id,
      key: t.key,
      label: t.label,
      whyItMatters: t.whyItMatters,
      status,
      claimIds: cited.map((c) => c.id),
      sourceIds: [...new Set(cited.map((c) => c.sourceId))],
      origin: t.origin,
      askedScope: scope?.label ?? null,
      verification,
      scopeNote,
    });
    if (status === "covered") continue;

    const modelMissing = a && a.status !== "covered" ? a.missingInformation?.trim() : undefined;
    const missing = clip(scopeNote ?? modelMissing ?? `${t.label} was not found in the reviewed sources.`, 1000);
    const investigate = clip(
      (a && a.status !== "covered" ? a.whatToInvestigate?.trim() : undefined) ||
        `Check the official ${scope ? `${scope.label} ` : ""}notification or the issuing authority's portal for: ${t.label.toLowerCase()}.`,
      1000,
    );
    gaps.push({
      id,
      title: t.label,
      description: clip(
        status === "missing"
          ? `Not found in the reviewed sources: ${missing} (Missing from these sources does not mean it does not exist.)`
          : `Potential gap, requires verification: ${missing}`,
        2000,
      ),
      missingInformation: missing,
      severity: t.severity,
      evidence: evidenceFromClaims(cited).slice(0, 20),
      label: status === "missing" ? "not_found_in_sources" : "potential_gap",
      topicKey: t.key,
      whyItMatters: t.whyItMatters,
      whatToInvestigate: investigate,
    });
  }
  return { coverage, gaps };
}
