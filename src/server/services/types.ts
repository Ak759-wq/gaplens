import type { ResearchBrief } from "@/lib/validation";
import type { Claim, Source } from "@/server/ai/schemas";

export type { ResearchBrief };

/** Context passed to every stage. */
export type StageContext = {
  sessionId: string;
  brief: ResearchBrief;
  signal?: AbortSignal;
  /** Override the model for this run (defaults to OPENROUTER_MODEL). */
  model?: string;
};

export type ExtractedCorpus = { sources: Source[]; claims: Claim[] };
