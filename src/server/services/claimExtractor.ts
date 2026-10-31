import "server-only";
import type { Claim, Source } from "@/server/ai/schemas";
import { NotImplementedError } from "./errors";
import type { StageContext } from "./types";

export type ClaimExtractionResult = {
  claims: Claim[];
  /** Claims the model returned whose quote could not be found in the source text (dropped). */
  rejected: { text: string; quote: string; reason: "quote_not_found" }[];
};

/**
 * TODO(Phase 2/3):
 *  - Chunk source.contentText; call structuredCompletion(buildClaimExtractionPrompt(...), claimExtractionOutputSchema).
 *  - Verify each quote with verifyQuoteInSource(); drop unverifiable claims into `rejected`.
 *  - Assign stable ids; persist char offsets via ClaimRepository.
 */
export async function extractClaims(_source: Source, _ctx: StageContext): Promise<ClaimExtractionResult> {
  throw new NotImplementedError("claimExtractor.extractClaims", 3);
}
