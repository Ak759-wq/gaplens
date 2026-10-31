import { PROVENANCE_RULES, briefBlock, type BriefInput } from "./shared";

export const CONTRADICTION_DETECTION_VERSION = "contradictions-v1";

export function buildContradictionDetectionPrompt(brief: BriefInput, groupsJson: string, sourcesJson: string) {
  return [
    { role: "system" as const, content: PROVENANCE_RULES },
    {
      role: "user" as const,
      content: `${briefBlock(brief)}

TASK: Within each GROUP (claims on the same topic from DIFFERENT sources), find pairs or sets of claims that cannot all be true at the same time: different deadlines, amounts, eligibility limits, income ceilings, document lists, procedures, etc.
Return JSON: {"contradictions":[{"topicKey":string,"topic":string,"description":string,"severity":"high"|"medium"|"low","positions":[{"statement":string,"claimIds":["C1"]}],"possibleExplanations":[string]}]}
Rules:
- Each contradiction needs at least two positions, and positions must come from different sources.
- Not a contradiction: one source simply omits something; the same value phrased differently; values that clearly refer to different schemes, categories or years when the claims say so. If two claims differ only because they refer to different cycles/years, you may still report it with that as a possible explanation.
- "description" explains what conflicts. Do NOT decide which source is correct. "possibleExplanations" lists plausible benign reasons (different academic year, category, revision).
- Use only claim ids shown. Return {"contradictions":[]} if there are none.

SOURCES:
${sourcesJson}

GROUPS:
${groupsJson}`,
    },
  ];
}
