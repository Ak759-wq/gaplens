import { PROVENANCE_RULES, briefBlock, type BriefInput } from "./shared";

export const TOPIC_PLANNING_VERSION = "topics-v2";
export const GAP_DETECTION_VERSION = "gaps-v2";

/**
 * Step 1 (topic planning). Sees ONLY the research brief and the domain checklist, never the claims,
 * so the topics describe what the question needs rather than what the sources happen to say.
 */
export function buildTopicPlanningPrompt(brief: BriefInput, scopeLine: string, requiredJson: string, maxExtra: number) {
  const hasRequired = requiredJson !== "[]";
  return [
    { role: "system" as const, content: PROVENANCE_RULES },
    {
      role: "user" as const,
      content: `${briefBlock(brief)}
ASKED SCOPE: ${scopeLine}

You have NOT seen any sources. Plan the information a careful person must confirm to answer the research question and meet the objective.
${
  hasRequired
    ? `These REQUIRED TOPICS are already planned (from a domain checklist and the question). Do not repeat or rename them.
TASK: add at most ${maxExtra} further topics that THIS question or objective specifically needs and that none of the required topics covers. Return {"topics":[]} if nothing is missing.`
    : `TASK: list the 6–10 information topics this question needs (eligibility/criteria, values, dates/deadlines, process, conditions, official contact… adapted to the question).`
}
Return JSON: {"topics":[{"key":"snake_case_key","label":string,"whyItMatters":string,"severity":"high"|"medium"|"low","timeSensitive":boolean}]}
- severity = how much not knowing this could change the decision.
- timeSensitive = true when the answer is specific to a cycle/year/edition (deadlines, timelines, notified dates).
- Topics are needs, not answers: never state values.
${hasRequired ? `\nREQUIRED TOPICS:\n${requiredJson}` : ""}`,
    },
  ];
}

/** Step 2 (coverage assessment): judge each PLANNED topic strictly against the verified claims. */
export function buildGapDetectionPrompt(brief: BriefInput, scopeLine: string, topicsJson: string, claimsJson: string, sourcesJson: string) {
  return [
    { role: "system" as const, content: PROVENANCE_RULES },
    {
      role: "user" as const,
      content: `${briefBlock(brief)}
ASKED SCOPE: ${scopeLine}

TASK: For EACH topic in TOPICS (use its exact key; do not add or drop topics), decide coverage using ONLY the CLAIMS below. Be strict:
- "covered": at least one claim EXPLICITLY answers the topic FOR THE ASKED SCOPE. If the question names a cycle/year, a claim about a different cycle/year does NOT cover it, and for time-sensitive topics a claim with no year does NOT cover it.
- "partial": claims touch the topic but leave an important part open: they answer it only for another cycle/year, give no year, only say where the information will be published (e.g. "timelines will be on the portal"), are vague ("₹20,000+"), or come only from a third-party site with no reliable date.
- "missing": no claim addresses it (claimIds = []).
List every claim id that bears on the topic (including the partial or past-cycle ones).
For partial/missing topics: "missingInformation" says precisely what was not found in the reviewed sources (e.g. "No 2026-27 deadline; sources give 31.10.2025 for 2025-26"), and "whatToInvestigate" says where/how to confirm it (e.g. the official notification for the asked cycle). Write "not found in the reviewed sources", never "does not exist".
Return JSON: {"assessments":[{"key":string,"status":"covered"|"partial"|"missing","claimIds":["C1"],"missingInformation"?:string,"whatToInvestigate"?:string}]}
Use only claim ids that appear below.

TOPICS:
${topicsJson}

SOURCES:
${sourcesJson}

CLAIMS:
${claimsJson}`,
    },
  ];
}
