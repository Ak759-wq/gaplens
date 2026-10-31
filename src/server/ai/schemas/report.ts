import { z } from "zod";
import { claimSchema } from "./claim";
import { idSchema, isoDateSchema } from "./common";
import {
  checklistItemSchema,
  contradictionSchema,
  freshnessWarningSchema,
  gapSchema,
  questionSchema,
  topicCoverageSchema,
} from "./findings";
import { sourceSchema } from "./source";

export const reportSchema = z.object({
  id: idSchema,
  sessionId: idSchema,
  generatedAt: isoDateSchema,
  model: z.string().min(1),
  brief: z.object({ topic: z.string(), question: z.string(), objective: z.string() }),
  /** Short neutral overview of coverage — not a summary of the topic itself. */
  coverageOverview: z.string().max(3000),
  sources: z.array(sourceSchema),
  claims: z.array(claimSchema),
  gaps: z.array(gapSchema),
  contradictions: z.array(contradictionSchema),
  freshnessWarnings: z.array(freshnessWarningSchema),
  questions: z.array(questionSchema),
  checklist: z.array(checklistItemSchema),
  coverage: z.array(topicCoverageSchema).optional(),
  limitations: z.array(z.string()).optional(),
});
export type Report = z.infer<typeof reportSchema>;
