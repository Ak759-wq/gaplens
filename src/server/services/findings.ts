import type { Contradiction, FreshnessWarning, Gap } from "@/server/ai/schemas";

/** Output of the detection stages, consumed by question + checklist generation. */
export type FindingsBundle = {
  gaps: Gap[];
  contradictions: Contradiction[];
  freshnessWarnings: FreshnessWarning[];
};
