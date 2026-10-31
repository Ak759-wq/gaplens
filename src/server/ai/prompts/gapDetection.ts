import { PROVENANCE_RULES, briefBlock, type BriefInput } from "./shared";

export const GAP_DETECTION_VERSION = "gaps-v0";

/** TODO(Phase 3): finalise wording + few-shot examples. */
export function buildGapDetectionPrompt(brief: BriefInput, claimsJson: string) {
  return [
    { role: "system" as const, content: PROVENANCE_RULES },
    {
      role: "user" as const,
      content: `${briefBlock(brief)}

Given the extracted CLAIMS (JSON, each with id + sourceId + quote), identify information the research question requires that NO reviewed source states.
Return JSON: {"gaps":[{"title","description","missingInformation","severity":"high"|"medium"|"low","label":"potential_gap"|"not_found_in_sources","evidence":[{"claimId","sourceId","quote"}]}]}
Use evidence only to reference related claims that frame the gap. Phrase every gap as "not found in the reviewed sources".

CLAIMS:
${claimsJson}`,
    },
  ];
}
