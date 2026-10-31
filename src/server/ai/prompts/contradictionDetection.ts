import { PROVENANCE_RULES, briefBlock, type BriefInput } from "./shared";

export const CONTRADICTION_DETECTION_VERSION = "contradictions-v0";

/** TODO(Phase 3): finalise wording + few-shot examples. */
export function buildContradictionDetectionPrompt(brief: BriefInput, claimsJson: string) {
  return [
    { role: "system" as const, content: PROVENANCE_RULES },
    {
      role: "user" as const,
      content: `${briefBlock(brief)}

Find claims from DIFFERENT sources that cannot both be true.
Return JSON: {"contradictions":[{"topic","description","severity","positions":[{"statement","evidence":[{"claimId","sourceId","quote"}]}],"possibleExplanations":[string]}]}
Each contradiction needs at least two positions backed by different sources. Do not decide which is correct.

CLAIMS:
${claimsJson}`,
    },
  ];
}
