import { PROVENANCE_RULES, briefBlock, type BriefInput } from "./shared";

export const CLAIM_EXTRACTION_VERSION = "claims-v1";

export function buildClaimExtractionPrompt(
  brief: BriefInput,
  source: { id: string; title: string | null; text: string; part?: { index: number; total: number } },
) {
  const part = source.part && source.part.total > 1 ? ` (part ${source.part.index + 1} of ${source.part.total})` : "";
  return [
    { role: "system" as const, content: PROVENANCE_RULES },
    {
      role: "user" as const,
      content: `${briefBlock(brief)}

TASK: Extract atomic claims from the SOURCE below that are relevant to the research question (eligibility, dates, amounts, documents, procedures, conditions, contacts, figures, etc.). Ignore navigation, menus, cookie notices, unrelated news.
Return JSON: {"claims":[{"text":string,"quote":string,"category":"fact"|"claim"|"date_deadline"|"requirement"|"condition"|"procedure"|"evidence","date"?:"YYYY-MM-DD"}]}
Rules:
- "quote" MUST be copied character-for-character from the SOURCE (one sentence, list item or table row, ideally under 300 characters). No ellipses, no paraphrase, no fixing typos. Claims whose quote is not found verbatim are discarded automatically.
- "text" restates the claim in one plain sentence without adding anything not in the quote.
- "category": date_deadline for dates/deadlines/schedules, requirement for eligibility/documents needed, condition for rules/terms/renewal conditions, procedure for how-to-apply steps, fact for amounts/numbers/definitions, evidence for statistics, claim for other assertions.
- "date" only when the quote states a full calendar date the claim is about.
- At most 40 claims; prefer the most decision-relevant ones. If nothing relevant is present, return {"claims":[]}.

SOURCE ${source.id} — ${source.title ?? "(untitled)"}${part}
"""
${source.text}
"""`,
    },
  ];
}
