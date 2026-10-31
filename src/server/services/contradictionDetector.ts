import "server-only";
import type { Contradiction } from "@/server/ai/schemas";
import { NotImplementedError } from "./errors";
import type { ExtractedCorpus, StageContext } from "./types";

/**
 * TODO(Phase 3): call structuredCompletion() with prompts/contradictionDetection.ts, validate with the Contradiction schema,
 * then verify every evidence quote against stored source text (provenance.verifyQuoteInSource) and
 * drop items whose evidence cannot be verified.
 */
export async function detectContradictions(_corpus: ExtractedCorpus, _ctx: StageContext): Promise<Contradiction[]> {
  throw new NotImplementedError("contradictionDetector.detectContradictions", 3);
}
