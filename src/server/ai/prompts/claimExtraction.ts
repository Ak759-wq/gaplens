import { PROVENANCE_RULES, briefBlock, type BriefInput } from "./shared";

export const CLAIM_EXTRACTION_VERSION = "claims-v0";

export function buildClaimExtractionPrompt(brief: BriefInput, source: { id: string; title: string | null; text: string }) {
  return [
    { role: "system" as const, content: PROVENANCE_RULES },
    {
      role: "user" as const,
      content: `${briefBlock(brief)}

Extract atomic claims relevant to the research question from the SOURCE below.
Return JSON: {"claims":[{"text":string,"quote":string,"category":"fact"|"claim"|"date_deadline"|"requirement"|"condition"|"procedure"|"evidence","date"?:"YYYY-MM-DD"}]}
- "quote" must be copied character-for-character from the source.
- Use "date" only when the claim itself refers to a specific date stated in the quote.

SOURCE ${source.id} — ${source.title ?? "(untitled)"}
"""
${source.text}
"""`,
    },
  ];
}
