import { PROVENANCE_RULES, briefBlock, type BriefInput } from "./shared";

export const CHECKLIST_GENERATION_VERSION = "checklist-v0";

/** TODO(Phase 3): finalise wording. */
export function buildChecklistGenerationPrompt(brief: BriefInput, findingsJson: string) {
  return [
    { role: "system" as const, content: PROVENANCE_RULES },
    {
      role: "user" as const,
      content: `${briefBlock(brief)}

Turn the FINDINGS into a prioritised verification checklist the researcher can act on.
Return JSON: {"items":[{"action","priority":"high"|"medium"|"low","rationale","findingIds":[string]}]}
Every item must reference at least one finding id. High = could change the answer to the research question.

FINDINGS:
${findingsJson}`,
    },
  ];
}
