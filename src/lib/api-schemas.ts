import { z } from "zod";
import { MAX_SOURCES, researchBriefSchema, safeUrlSchema } from "./validation";

/** Request-body schemas for the API routes (shared by routes and tests). */

export const uuidSchema = z.string().uuid("Invalid id.");

export const createSessionSchema = z.object({
  brief: researchBriefSchema,
  urls: z.array(safeUrlSchema).max(MAX_SOURCES, `At most ${MAX_SOURCES} sources.`).default([]),
  /** Number of PDFs the client will upload next (only used for the source-count check). */
  pdfCount: z.number().int().min(0).max(MAX_SOURCES).default(0),
}).superRefine((v, ctx) => {
  if (v.urls.length + v.pdfCount > MAX_SOURCES) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `At most ${MAX_SOURCES} sources per session.`, path: ["urls"] });
  if (new Set(v.urls).size !== v.urls.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate URLs.", path: ["urls"] });
});
export type CreateSessionInput = z.infer<typeof createSessionSchema>;

export const addUrlSourcesSchema = z.object({ urls: z.array(safeUrlSchema).min(1).max(MAX_SOURCES) });

export const claimsStageSchema = z.object({
  sourceId: uuidSchema,
  chunk: z.number().int().min(0).max(50).default(0),
});

export const ANALYSIS_STAGES = ["gaps", "contradictions", "freshness", "questions", "checklist", "report"] as const;
export const analysisStageSchema = z.enum(ANALYSIS_STAGES);
export type AnalysisStage = z.infer<typeof analysisStageSchema>;

export const checklistPatchSchema = z.object({ done: z.boolean() });

export const searchRequestSchema = z.object({ query: z.string().trim().min(3, "Enter at least 3 characters.").max(300) });

export const LLM_PROVIDERS = ["gemini", "openrouter"] as const;
export const llmProviderSchema = z.enum(LLM_PROVIDERS);
export type LlmProviderId = z.infer<typeof llmProviderSchema>;

/** Header names for a bring-your-own AI key (sent per request; never stored or logged server-side). */
export const BYO_HEADERS = {
  provider: "x-gaplens-llm-provider",
  key: "x-gaplens-llm-key",
  model: "x-gaplens-llm-model",
} as const;

export const byoModelSchema = z.string().trim().regex(/^[\w.\-/:]{1,100}$/, "Invalid model id.");
