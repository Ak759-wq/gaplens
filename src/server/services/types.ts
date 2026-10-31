import type { ResearchBrief } from "@/lib/validation";
import type { Claim, Source } from "@/server/ai/schemas";
import type { LlmClient } from "@/server/ai/llm";

export type { ResearchBrief };

/** Context passed to every stage. */
export type StageContext = {
  sessionId: string;
  brief: ResearchBrief;
  signal?: AbortSignal;
  /** LLM client for AI stages. Deterministic stages work without it. */
  llm?: LlmClient;
  /** Clock override (tests, reproducible freshness rules). */
  now?: Date;
};

export type ExtractedCorpus = { sources: Source[]; claims: Claim[] };
