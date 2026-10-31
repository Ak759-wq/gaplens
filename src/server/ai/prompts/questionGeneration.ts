import { PROVENANCE_RULES, briefBlock, type BriefInput } from "./shared";

export const QUESTION_GENERATION_VERSION = "questions-v0";

/** TODO(Phase 3): finalise wording. */
export function buildQuestionGenerationPrompt(brief: BriefInput, findingsJson: string) {
  return [
    { role: "system" as const, content: PROVENANCE_RULES },
    {
      role: "user" as const,
      content: `${briefBlock(brief)}

From the FINDINGS (gaps, contradictions, freshness warnings), list concrete questions that remain unanswered by the reviewed sources.
Return JSON: {"questions":[{"question","whyItMatters","relatedFindingIds":[string],"suggestedSourceType"?:string}]}

FINDINGS:
${findingsJson}`,
    },
  ];
}
