import type { Contradiction, FreshnessWarning, Gap } from "@/server/ai/schemas";

/** Output of the detection stages, consumed by question + checklist generation. */
export type FindingsBundle = {
  gaps: Gap[];
  contradictions: Contradiction[];
  freshnessWarnings: FreshnessWarning[];
};

/** Compact, typed view of any persisted finding, used to brief the question/checklist stages. */
export type FindingSummary = {
  id: string;
  type: "gap" | "contradiction" | "freshness" | "question";
  title: string;
  detail: string;
  severity: "high" | "medium" | "low" | null;
};

export function summarizeBundle(b: FindingsBundle, nameOfSource: (id: string) => string = (id) => id): FindingSummary[] {
  return [
    ...b.gaps.map((g) => ({ id: g.id, type: "gap" as const, title: `Gap: ${g.title}`, detail: g.missingInformation, severity: g.severity })),
    ...b.contradictions.map((c) => ({
      id: c.id,
      type: "contradiction" as const,
      title: `Contradiction: ${c.topic}`,
      detail: `${c.description} Positions: ${c.positions.map((p) => p.statement).join(" vs ")}`,
      severity: c.severity,
    })),
    ...b.freshnessWarnings
      .map((f) => ({ id: f.id, type: "freshness" as const, title: `Freshness (${f.reason}) in ${nameOfSource(f.sourceId)}`, detail: f.description, severity: f.severity ?? null })),
  ];
}
