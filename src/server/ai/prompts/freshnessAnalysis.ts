import { PROVENANCE_RULES, briefBlock, type BriefInput } from "./shared";

export const FRESHNESS_ANALYSIS_VERSION = "freshness-v2";

export function buildFreshnessAnalysisPrompt(brief: BriefInput, sourcesJson: string, claimsJson: string, today: string, ruleFindingsJson: string) {
  return [
    { role: "system" as const, content: PROVENANCE_RULES },
    {
      role: "user" as const,
      content: `${briefBlock(brief)}
TODAY: ${today}

Deterministic checks already flagged these (do NOT repeat them):
${ruleFindingsJson}

TASK: Using the CLAIMS, find additional freshness problems the date rules could miss:
- references_past_cycle: a claim tied to an academic year / scheme cycle / edition that has ended.
- superseded_by_newer_source: a claim another reviewed source shows was revised (cite both claims).
- old_version: the claim cites an older notification, guideline version or rate that a claim says was replaced.
- expired_deadline: a stated deadline before TODAY.
Return JSON: {"warnings":[{"sourceId":"S1","reason":...,"description":string,"severity":"high"|"medium"|"low","claimIds":["C3"]}]}
A rule that says it applies "<year> onwards", "from financial year <year>", "w.e.f. <year>" or "until further orders" is still IN FORCE: never flag it as references_past_cycle or dated_old just because the starting year is old.
A difference between cycles (e.g. a 2025-26 deadline vs a 2026-27 one) is a freshness/cycle issue of the older source, not a contradiction.
Every warning must cite at least one claim id. An undated source is NOT outdated: never warn just because a date is missing. Return {"warnings":[]} if nothing else applies.

SOURCES:
${sourcesJson}

CLAIMS:
${claimsJson}`,
    },
  ];
}
