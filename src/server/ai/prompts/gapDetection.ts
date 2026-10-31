import { PROVENANCE_RULES, briefBlock, type BriefInput } from "./shared";

export const GAP_DETECTION_VERSION = "gaps-v1";

export function buildGapDetectionPrompt(brief: BriefInput, claimsJson: string, sourcesJson: string) {
  return [
    { role: "system" as const, content: PROVENANCE_RULES },
    {
      role: "user" as const,
      content: `${briefBlock(brief)}

TASK (two steps):
1. Derive the 6–12 information TOPICS someone needs to answer the research question and meet the objective.
   Example for a scholarship question: eligibility, income criteria, deadline, documents required, amount/coverage, renewal conditions, selection process, how to apply, official source/contact.
   Adapt topics to THIS question; do not copy the example blindly.
2. For each topic, decide coverage using ONLY the CLAIMS below:
   - "covered": at least one claim directly answers it (list those claim ids).
   - "partial": claims touch it but leave an important part open (list them; say what's missing).
   - "missing": no claim addresses it (claimIds = []).
Return JSON: {"topics":[{"key":"snake_case_key","label":string,"whyItMatters":string,"status":"covered"|"partial"|"missing","claimIds":["C1",...],"missingInformation"?:string,"whatToInvestigate"?:string,"severity":"high"|"medium"|"low"}]}
- For partial/missing topics, "missingInformation" says what was not found in the reviewed sources and "whatToInvestigate" says where/how to look (e.g. the official notification). Phrase as "not found in the reviewed sources", never "does not exist".
- severity = how much the missing information could change the answer (high = could change it).
- Use only claim ids that appear below.

SOURCES:
${sourcesJson}

CLAIMS:
${claimsJson}`,
    },
  ];
}
