import { z } from "zod";
import { idSchema, isoDateSchema } from "./common";

export const claimCategorySchema = z.enum([
  "fact",
  "claim",
  "date_deadline",
  "requirement",
  "condition",
  "procedure",
  "evidence",
]);
export type ClaimCategory = z.infer<typeof claimCategorySchema>;

export const claimSchema = z.object({
  id: idSchema,
  sourceId: idSchema,
  /** Normalised one-sentence statement of the claim. */
  text: z.string().min(1).max(1000),
  /** Verbatim quote from the source supporting the claim. Must appear in the stored source text. */
  quote: z.string().min(1).max(2000),
  category: claimCategorySchema,
  /** Date the claim refers to (e.g. a deadline), if any. */
  date: isoDateSchema.optional(),
  /** Offsets of the verified quote in the stored source text (for highlighting). */
  charStart: z.number().int().nonnegative().optional(),
  charEnd: z.number().int().positive().optional(),
});
export type Claim = z.infer<typeof claimSchema>;

/** Shape requested from the LLM for the claim-extraction stage. */
export const claimExtractionOutputSchema = z.object({
  claims: z.array(claimSchema.omit({ id: true, sourceId: true })).max(200),
});
export type ClaimExtractionOutput = z.infer<typeof claimExtractionOutputSchema>;
