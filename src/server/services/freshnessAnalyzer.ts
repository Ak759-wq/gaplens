import "server-only";
import type { FreshnessWarning } from "@/server/ai/schemas";
import { NotImplementedError } from "./errors";
import type { ExtractedCorpus, StageContext } from "./types";

/**
 * TODO(Phase 3):
 *  1. Deterministic pass: lib/dates.ageBucket() on each source.publishedAt.
 *     - "undated" -> reason "undated" (described as undated, NEVER as outdated).
 *     - "stale"   -> reason "dated_old".
 *  2. LLM pass (prompts/freshnessAnalysis.ts) for past-cycle references and supersession.
 *  3. Verify every evidence quote.
 */
export async function analyzeFreshness(
  _corpus: ExtractedCorpus,
  _ctx: StageContext & { now?: Date },
): Promise<FreshnessWarning[]> {
  throw new NotImplementedError("freshnessAnalyzer.analyzeFreshness", 3);
}
