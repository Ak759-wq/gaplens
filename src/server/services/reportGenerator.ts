import "server-only";
import type { Report } from "@/server/ai/schemas";
import { NotImplementedError } from "./errors";
import type { FindingsBundle } from "./findings";
import type { ExtractedCorpus, StageContext } from "./types";
import type { ChecklistItem, Question } from "@/server/ai/schemas";

export type ReportInput = ExtractedCorpus &
  FindingsBundle & { questions: Question[]; checklist: ChecklistItem[] };

/**
 * TODO(Phase 3): assemble the Report deterministically from stage outputs, add the neutral
 * coverage overview (prompts/reportGeneration.ts), validate with reportSchema, persist via ReportRepository.
 */
export async function generateReport(_input: ReportInput, _ctx: StageContext): Promise<Report> {
  throw new NotImplementedError("reportGenerator.generateReport", 3);
}
