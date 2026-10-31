import { z } from "zod";
import { claimCategorySchema } from "./claim";
import { severitySchema } from "./common";

/**
 * Shapes requested from the model at each stage. Deliberately lenient (no length caps, loose date
 * strings) so a valid answer is not rejected on formatting; every value is then normalised, ids are
 * resolved against real records, and quotes are verified against stored source text before use.
 * The model refers to records by short aliases (S1, C12, F3) that the server maps back to ids.
 */

export const claimsLlmSchema = z.object({
  claims: z.array(
    z.object({
      text: z.string().min(1),
      quote: z.string().min(1),
      category: claimCategorySchema,
      date: z.string().optional(),
    }),
  ),
});

/** Topic planning: sees ONLY the research brief (never the claims), so topics are not circular. */
export const topicPlanLlmSchema = z.object({
  topics: z.array(
    z.object({
      key: z.string().min(1),
      label: z.string().min(1),
      whyItMatters: z.string(),
      severity: severitySchema,
      /** True when the answer changes per cycle/year (deadlines, timelines, notified rates). */
      timeSensitive: z.boolean(),
    }),
  ),
});

/** Coverage assessment of the planned topics against verified claims. */
export const coverageLlmSchema = z.object({
  assessments: z.array(
    z.object({
      key: z.string().min(1),
      status: z.enum(["covered", "partial", "missing"]),
      claimIds: z.array(z.string()),
      missingInformation: z.string().optional(),
      whatToInvestigate: z.string().optional(),
    }),
  ),
});

export const contradictionsLlmSchema = z.object({
  contradictions: z.array(
    z.object({
      topicKey: z.string(),
      topic: z.string().min(1),
      description: z.string().min(1),
      severity: severitySchema,
      positions: z.array(z.object({ statement: z.string().min(1), claimIds: z.array(z.string()) })),
      possibleExplanations: z.array(z.string()).optional(),
      /** Do the positions refer to the same cycle/year? "different" = cycle mismatch, not a contradiction. */
      cycleRelation: z.enum(["same", "different", "unclear"]).optional(),
    }),
  ),
});

export const freshnessLlmSchema = z.object({
  warnings: z.array(
    z.object({
      sourceId: z.string(),
      reason: z.enum(["references_past_cycle", "superseded_by_newer_source", "dated_old", "expired_deadline", "old_version"]),
      description: z.string().min(1),
      severity: severitySchema,
      claimIds: z.array(z.string()),
    }),
  ),
});

export const questionsLlmSchema = z.object({
  questions: z.array(
    z.object({
      question: z.string().min(1),
      whyItMatters: z.string().min(1),
      relatedFindingIds: z.array(z.string()),
      suggestedSourceType: z.string().optional(),
      basis: z.enum(["gap", "contradiction", "freshness", "ambiguity"]),
    }),
  ),
});

export const checklistLlmSchema = z.object({
  items: z.array(
    z.object({
      action: z.string().min(1),
      priority: severitySchema,
      rationale: z.string().min(1),
      findingIds: z.array(z.string()),
    }),
  ),
});
