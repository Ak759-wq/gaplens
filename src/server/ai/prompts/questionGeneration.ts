import { PROVENANCE_RULES, briefBlock, type BriefInput } from "./shared";

export const QUESTION_GENERATION_VERSION = "questions-v1";

export function buildQuestionGenerationPrompt(brief: BriefInput, findingsJson: string) {
  return [
    { role: "system" as const, content: PROVENANCE_RULES },
    {
      role: "user" as const,
      content: `${briefBlock(brief)}

TASK: From the FINDINGS (gaps, contradictions, freshness warnings), write the concrete questions the researcher still needs answered before relying on these sources. These are suggestions to investigate, not facts.
Return JSON: {"questions":[{"question":string,"whyItMatters":string,"relatedFindingIds":["F1"],"suggestedSourceType"?:string,"basis":"gap"|"contradiction"|"freshness"|"ambiguity"}]}
Rules:
- 4–10 questions, specific and answerable (e.g. "What is the last date to apply for the 2026-27 cycle?"), not generic.
- Every question cites at least one finding id from the list.
- "suggestedSourceType" names the kind of source likely to answer it (official notification, institute's scholarship cell, helpdesk), never a specific URL you have not been given.

FINDINGS:
${findingsJson}`,
    },
  ];
}
