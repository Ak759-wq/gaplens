import { z } from "zod";
import { idSchema, isoDateSchema } from "./common";

export const sourceTypeSchema = z.enum(["url", "pdf"]);
export const extractionStatusSchema = z.enum(["pending", "extracting", "extracted", "failed"]);

export const sourceSchema = z
  .object({
    id: idSchema,
    sourceType: sourceTypeSchema,
    url: z.string().url().nullable(),
    fileName: z.string().min(1).max(255).nullable(),
    /** Title as found in the source. Null until extracted, never invented. */
    title: z.string().max(500).nullable(),
    /** Publication date only if stated by the source. Null = undated (NOT outdated). */
    publishedAt: isoDateSchema.nullable(),
    retrievedAt: isoDateSchema.nullable(),
    extractionStatus: extractionStatusSchema,
    contentText: z.string().nullable(),
  })
  .refine((s) => (s.sourceType === "url" ? s.url !== null : s.fileName !== null), {
    message: "URL sources need a url; PDF sources need a fileName",
  });
export type Source = z.infer<typeof sourceSchema>;
export type SourceType = z.infer<typeof sourceTypeSchema>;
export type ExtractionStatus = z.infer<typeof extractionStatusSchema>;
