import { PROVENANCE_RULES, briefBlock, type BriefInput } from "./shared";

export const CHECKLIST_GENERATION_VERSION = "checklist-v1";

export function buildChecklistGenerationPrompt(brief: BriefInput, findingsJson: string) {
  return [
    { role: "system" as const, content: PROVENANCE_RULES },
    {
      role: "user" as const,
      content: `${briefBlock(brief)}

TASK: Turn the FINDINGS into a prioritised verification checklist the researcher can act on.
Return JSON: {"items":[{"action":string,"priority":"high"|"medium"|"low","rationale":string,"findingIds":["F1"]}]}
Rules:
- 5–12 items. Each "action" starts with a verb and says exactly what to confirm and with whom/where (e.g. "Confirm the 2026-27 application deadline on the official portal's notification").
- priority: high = could change the answer or cause a missed deadline/ineligibility; medium = affects preparation; low = nice to confirm.
- "rationale" says why, referring to the finding. Every item cites at least one finding id from the list.

FINDINGS:
${findingsJson}`,
    },
  ];
}
