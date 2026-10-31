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
  topicKey: z.string().max(80).optional(),
  whyItMatters: z.string().max(1000).optional(),
  whatToInvestigate: z.string().max(1000).optional(),
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
  topicKey: z.string().max(80).optional(),
  /**
   * Evidence-based note on relative authority (official domain, newer stated date). Deterministic,
   * never a verdict: GapLens does not declare a winner.
   */
  authorityNote: z.string().max(600).nullable().optional(),
  /**
   * "cycle_mismatch" = the values differ because the sources describe different cycles/years (a
   * freshness issue, not a contradiction). Absent = "contradiction" (older rows).
   */
  kind: z.enum(["contradiction", "cycle_mismatch"]).optional(),
  /** Cycle/year each position refers to, as determined from the claims (null = not stated). */
  cycles: z.array(z.string().nullable()).max(10).optional(),
});
export type Contradiction = z.infer<typeof contradictionSchema>;

/** Undated ≠ outdated: `reason` distinguishes the two explicitly. */
export const freshnessWarningSchema = z.object({
  id: idSchema,
  sourceId: idSchema,
  reason: z.enum(["dated_old", "references_past_cycle", "undated", "superseded_by_newer_source", "expired_deadline", "old_version"]),
  description: z.string().min(1).max(1000),
  sourceDate: isoDateSchema.nullable(),
  evidence: z.array(evidenceRefSchema).max(10),
  severity: severitySchema.optional(),
  /** "rule" = deterministic date/cycle check; "ai" = model-assisted interpretation of verified quotes. */
  origin: z.enum(["rule", "ai"]).optional(),
});
export type FreshnessWarning = z.infer<typeof freshnessWarningSchema>;

export const questionSchema = z.object({
  id: idSchema,
  question: z.string().min(1).max(500),
  whyItMatters: z.string().min(1).max(1000),
  /** Findings (gaps/contradictions/freshness) that raised this question. */
  relatedFindingIds: z.array(idSchema).max(20),
  suggestedSourceType: z.string().max(200).optional(),
  /** What raised it. Questions are AI suggestions, distinct from gaps (confirmed not found in sources). */
  basis: z.enum(["gap", "contradiction", "freshness", "ambiguity"]).optional(),
});
export type Question = z.infer<typeof questionSchema>;

export const checklistItemSchema = z.object({
  id: idSchema,
  action: z.string().min(1).max(500),
  priority: severitySchema,
  rationale: z.string().min(1).max(1000),
  findingIds: z.array(idSchema).min(1).max(20),
  done: z.boolean().optional(),
});

/** Coverage of one information topic the research question requires. */
export const topicCoverageSchema = z.object({
  id: idSchema,
  key: z.string().min(1).max(80),
  label: z.string().min(1).max(200),
  whyItMatters: z.string().max(1000),
  status: z.enum(["covered", "partial", "missing"]),
  claimIds: z.array(idSchema),
  sourceIds: z.array(idSchema),
  /** Where the topic came from: the domain checklist, the question text, or the AI planner. */
  origin: z.enum(["checklist", "question", "ai"]).optional(),
  /** The cycle/year the question asks about, when it names one (e.g. "2026-27"). */
  askedScope: z.string().max(40).nullable().optional(),
  /** Why a topic is not fully covered for the asked scope (deterministic post-check). */
  verification: z.enum(["scope_mismatch", "aggregator_only", "model_assessment"]).nullable().optional(),
  scopeNote: z.string().max(1000).nullable().optional(),
});
export type TopicCoverage = z.infer<typeof topicCoverageSchema>;
export type ChecklistItem = z.infer<typeof checklistItemSchema>;
