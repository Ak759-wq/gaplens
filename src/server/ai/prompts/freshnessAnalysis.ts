import { PROVENANCE_RULES, briefBlock, type BriefInput } from "./shared";

export const FRESHNESS_ANALYSIS_VERSION = "freshness-v0";

/** TODO(Phase 3): finalise wording. Deterministic date checks run first in freshnessAnalyzer. */
export function buildFreshnessAnalysisPrompt(brief: BriefInput, sourcesJson: string, claimsJson: string, today: string) {
  return [
    { role: "system" as const, content: PROVENANCE_RULES },
    {
      role: "user" as const,
      content: `${briefBlock(brief)}
TODAY: ${today}

Identify claims that reference a past cycle/edition/year, or sources superseded by a newer reviewed source.
Return JSON: {"warnings":[{"sourceId","reason":"dated_old"|"references_past_cycle"|"undated"|"superseded_by_newer_source","description","sourceDate":string|null,"evidence":[{"claimId","sourceId","quote"}]}]}
An undated source gets reason "undated" and must NOT be described as outdated.

SOURCES:
${sourcesJson}

CLAIMS:
${claimsJson}`,
    },
  ];
}
