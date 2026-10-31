import { z } from "zod";

export const idSchema = z.string().min(1).max(64);
/** ISO-8601 date (YYYY-MM-DD) or datetime. */
export const isoDateSchema = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: "Must be an ISO-8601 date" });

/** A pointer from a finding back to the claims (and therefore sources + quotes) that support it. */
export const evidenceRefSchema = z.object({
  claimId: idSchema,
  sourceId: idSchema,
  /** Exact quote copied from the source text. Verified against stored content before display. */
  quote: z.string().min(1).max(2000),
});
export type EvidenceRef = z.infer<typeof evidenceRefSchema>;

export const severitySchema = z.enum(["high", "medium", "low"]);
export type Severity = z.infer<typeof severitySchema>;
