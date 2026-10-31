import { z } from "zod";
import { evidenceRefSchema, idSchema, isoDateSchema, severitySchema } from "./common";

/**
 * A gap = something the research question needs that the reviewed sources do not state.
 * "Not found in reviewed sources" is NOT the same as "does not exist".
 */
export const gapSchema = z.object({
  id: idSchema,
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  /** What was looked for and not found. */
  missingInformation: z.string().min(1).max(1000),
  severity: severitySchema,
  /** Related claims that frame the gap (may be empty when nothing related was found). */
  evidence: z.array(evidenceRefSchema).max(20),
  label: z.enum(["potential_gap", "not_found_in_sources"]),
});
export type Gap = z.infer<typeof gapSchema>;

/** Two or more sources disagree. The detector NEVER picks a winner arbitrarily. */
export const contradictionSchema = z.object({
  id: idSchema,
  topic: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  /** At least two sides, each backed by evidence from a different claim. */
  positions: z
    .array(z.object({ statement: z.string().min(1).max(1000), evidence: z.array(evidenceRefSchema).min(1) }))
    .min(2),
  severity: severitySchema,
  /** Possible benign explanations (different editions, regions, cycles). Optional. */
  possibleExplanations: z.array(z.string().max(500)).max(5).default([]),
});
export type Contradiction = z.infer<typeof contradictionSchema>;

/** Undated ≠ outdated: `reason` distinguishes the two explicitly. */
export const freshnessWarningSchema = z.object({
  id: idSchema,
  sourceId: idSchema,
  reason: z.enum(["dated_old", "references_past_cycle", "undated", "superseded_by_newer_source"]),
  description: z.string().min(1).max(1000),
  sourceDate: isoDateSchema.nullable(),
  evidence: z.array(evidenceRefSchema).max(10),
});
export type FreshnessWarning = z.infer<typeof freshnessWarningSchema>;

export const questionSchema = z.object({
  id: idSchema,
  question: z.string().min(1).max(500),
  whyItMatters: z.string().min(1).max(1000),
  /** Findings (gaps/contradictions/freshness) that raised this question. */
  relatedFindingIds: z.array(idSchema).max(20),
  suggestedSourceType: z.string().max(200).optional(),
});
export type Question = z.infer<typeof questionSchema>;

export const checklistItemSchema = z.object({
  id: idSchema,
  action: z.string().min(1).max(500),
  priority: severitySchema,
  rationale: z.string().min(1).max(1000),
  findingIds: z.array(idSchema).min(1).max(20),
});
export type ChecklistItem = z.infer<typeof checklistItemSchema>;
