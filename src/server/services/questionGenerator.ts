import "server-only";
import type { Question } from "@/server/ai/schemas";
import { NotImplementedError } from "./errors";
import type { StageContext } from "./types";
import type { FindingsBundle } from "./findings";

/**
 * TODO(Phase 3): call structuredCompletion() with prompts/questionGeneration.ts, validate with the Question schema,
 * then check every referenced finding id exists in the bundle and drop items that reference none.
 */
export async function generateQuestions(_findings: FindingsBundle, _ctx: StageContext): Promise<Question[]> {
  throw new NotImplementedError("questionGenerator.generateQuestions", 3);
}
