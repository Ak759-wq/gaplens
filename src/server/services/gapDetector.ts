import "server-only";
import type { Gap } from "@/server/ai/schemas";
import { NotImplementedError } from "./errors";
import type { ExtractedCorpus, StageContext } from "./types";

/**
 * TODO(Phase 3): call structuredCompletion() with prompts/gapDetection.ts, validate with the Gap schema,
 * then verify every evidence quote against stored source text (provenance.verifyQuoteInSource) and
 * drop items whose evidence cannot be verified.
 */
export async function detectGaps(_corpus: ExtractedCorpus, _ctx: StageContext): Promise<Gap[]> {
  throw new NotImplementedError("gapDetector.detectGaps", 3);
}
