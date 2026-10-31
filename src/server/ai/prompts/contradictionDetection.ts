import { PROVENANCE_RULES, briefBlock, type BriefInput } from "./shared";

export const CONTRADICTION_DETECTION_VERSION = "contradictions-v2";

export function buildContradictionDetectionPrompt(brief: BriefInput, groupsJson: string, sourcesJson: string, valueDiffsJson = "[]") {
  return [
    { role: "system" as const, content: PROVENANCE_RULES },
    {
      role: "user" as const,
      content: `${briefBlock(brief)}

TASK: Within each GROUP (claims on the same topic from DIFFERENT sources), find pairs or sets of claims that cannot all be true at the same time: different deadlines, amounts, eligibility limits, income ceilings, document lists, procedures, etc.
Compare the actual VALUES: amounts, income limits, percentages/percentiles, dates and deadlines. Each claim lists the values found in it and the cycle/year it refers to ("cycle"). VALUE DIFFERENCES lists cross-source pairs whose values differ: check each one; report it only if the claims really describe the same thing.
Return JSON: {"contradictions":[{"topicKey":string,"topic":string,"description":string,"severity":"high"|"medium"|"low","positions":[{"statement":string,"claimIds":["C1"]}],"possibleExplanations":[string],"cycleRelation":"same"|"different"|"unclear"}]}
Rules:
- Each contradiction needs at least two positions, and positions must come from different sources.
- Not a contradiction: one source simply omits something; the same value phrased differently; values that clearly refer to different schemes, categories or levels (e.g. ₹12,000 for years 1–3 vs ₹20,000 for years 4–5); a range vs a value inside it.
- Different cycles: if the values differ because the claims refer to different cycles/years (e.g. a 2025-26 deadline vs a 2026-27 deadline), set "cycleRelation":"different". GapLens reports that as a cycle mismatch (a freshness issue), not as a contradiction. Use "same" only when both sides clearly refer to the same cycle, "unclear" when a side states no cycle.
- "description" explains what conflicts. Do NOT decide which source is correct. "possibleExplanations" lists plausible benign reasons (different academic year, category, revision).
- Use only claim ids shown. Return {"contradictions":[]} if there are none.

SOURCES:
${sourcesJson}

GROUPS:
${groupsJson}

VALUE DIFFERENCES:
${valueDiffsJson}`,
    },
  ];
}
