import "server-only";
import { randomUUID } from "node:crypto";
import { buildGapDetectionPrompt } from "@/server/ai/prompts";
import { topicsLlmSchema, type Gap, type TopicCoverage } from "@/server/ai/schemas";
import { ConfigError } from "@/server/ai/errors";
import { claimsForPrompt, corpusAliases, evidenceFromClaims, sourcesForPrompt } from "./corpus";
import type { ExtractedCorpus, StageContext } from "./types";

export type GapDetectionResult = { coverage: TopicCoverage[]; gaps: Gap[] };

const MAX_TOPICS = 14;
const MAX_CLAIMS_IN_PROMPT = 400;

/**
 * Derive the information topics the question requires, then check which are covered by verified
 * claims. Coverage is re-derived from the claim ids the model cites, so it cannot claim coverage
 * without evidence: "covered" with no valid claim becomes "missing"; "missing" with valid claims
 * becomes "partial".
 */
export async function detectGaps(corpus: ExtractedCorpus, ctx: StageContext): Promise<GapDetectionResult> {
  if (!ctx.llm) throw new ConfigError("Configuration required: an AI provider key is needed for gap detection.", ["GEMINI_API_KEY"]);
  const claims = corpus.claims.slice(0, MAX_CLAIMS_IN_PROMPT);
  const al = corpusAliases({ sources: corpus.sources, claims });
  const out = await ctx.llm.generate(
    buildGapDetectionPrompt(ctx.brief, claimsForPrompt(claims, al.claims, al.sources, 160), sourcesForPrompt(corpus.sources, al.sources)),
    topicsLlmSchema,
    { label: "Gap detection", signal: ctx.signal },
  );
  return normalizeTopics(out.topics, al.claims);
}

export function normalizeTopics(
  topics: import("zod").infer<typeof topicsLlmSchema>["topics"],
  claimAliases: { resolveMany(a: string[]): import("@/server/ai/schemas").Claim[] },
): GapDetectionResult {
  const coverage: TopicCoverage[] = [];
  const gaps: Gap[] = [];
  const seenKeys = new Set<string>();
  for (const t of topics.slice(0, MAX_TOPICS)) {
    const key = t.key.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || `topic_${coverage.length + 1}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    const cited = claimAliases.resolveMany(t.claimIds);
    let status = t.status;
    if (status === "covered" && cited.length === 0) status = "missing";
    if (status === "missing" && cited.length > 0) status = "partial";
    const id = randomUUID();
    coverage.push({
      id,
      key,
      label: t.label.slice(0, 200),
      whyItMatters: t.whyItMatters.slice(0, 1000),
      status,
      claimIds: cited.map((c) => c.id),
      sourceIds: [...new Set(cited.map((c) => c.sourceId))],
    });
    if (status !== "covered") {
      const missing = (t.missingInformation?.trim() || `${t.label} was not found in the reviewed sources.`).slice(0, 1000);
      gaps.push({
        id,
        title: t.label.slice(0, 200),
        description:
          status === "missing"
            ? `Not found in the reviewed sources: ${missing}`.slice(0, 2000)
            : `Only partly covered by the reviewed sources: ${missing}`.slice(0, 2000),
        missingInformation: missing,
        severity: t.severity,
        evidence: evidenceFromClaims(cited).slice(0, 20),
        label: status === "missing" ? "not_found_in_sources" : "potential_gap",
        topicKey: key,
        whyItMatters: t.whyItMatters.slice(0, 1000),
        whatToInvestigate: t.whatToInvestigate?.slice(0, 1000),
      });
    }
  }
  return { coverage, gaps };
}
