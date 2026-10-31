import "server-only";
import type { ChecklistItem } from "@/server/ai/schemas";
import { NotImplementedError } from "./errors";
import type { StageContext } from "./types";
import type { FindingsBundle } from "./findings";

/**
 * TODO(Phase 3): call structuredCompletion() with prompts/checklistGeneration.ts, validate with the ChecklistItem schema,
 * then check every referenced finding id exists in the bundle and drop items that reference none.
 */
export async function generateChecklist(_findings: FindingsBundle, _ctx: StageContext): Promise<ChecklistItem[]> {
  throw new NotImplementedError("checklistGenerator.generateChecklist", 3);
}
