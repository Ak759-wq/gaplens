import { PROVENANCE_RULES, briefBlock, type BriefInput } from "./shared";

export const REPORT_GENERATION_VERSION = "report-v0";

/** Produces only the neutral coverage overview; all other report sections are assembled deterministically. */
export function buildCoverageOverviewPrompt(brief: BriefInput, statsJson: string) {
  return [
    { role: "system" as const, content: PROVENANCE_RULES },
    {
      role: "user" as const,
      content: `${briefBlock(brief)}

Write a 2–4 sentence neutral overview of how well the reviewed sources COVER the research question (not a summary of the topic), using only these STATS.
Return JSON: {"coverageOverview": string}

STATS:
${statsJson}`,
    },
  ];
}
