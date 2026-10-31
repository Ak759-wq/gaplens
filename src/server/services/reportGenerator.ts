import { randomUUID } from "node:crypto";
import { reportSchema, type ChecklistItem, type Question, type Report, type TopicCoverage } from "@/server/ai/schemas";
import type { FindingsBundle } from "./findings";
import type { ExtractedCorpus, StageContext } from "./types";

export type ReportInput = ExtractedCorpus &
  FindingsBundle & {
    questions: Question[];
    checklist: ChecklistItem[];
    coverage: TopicCoverage[];
    /** Extra limitation lines gathered by the pipeline (failed sources, rejected quotes…). */
    limitations?: string[];
    model: string;
  };

/**
 * Deterministic coverage overview from counts (no model call: fewer requests on free-tier limits and
 * nothing the sources don't support).
 */
export function coverageOverview(input: ReportInput): string {
  const extracted = input.sources.filter((s) => s.extractionStatus === "extracted").length;
  const covered = input.coverage.filter((t) => t.status === "covered").length;
  const partial = input.coverage.filter((t) => t.status === "partial").length;
  const missing = input.coverage.filter((t) => t.status === "missing").length;
  const parts = [
    `${extracted} of ${input.sources.length} sources were read and ${input.claims.length} verified claims were extracted.`,
  ];
  if (input.coverage.length) {
    parts.push(
      `Of ${input.coverage.length} information topics the question needs, ${covered} ${covered === 1 ? "is" : "are"} covered, ${partial} partly covered and ${missing} not found in the reviewed sources.`,
    );
  }
  const dated = input.freshnessWarnings.filter((f) => f.reason !== "undated").length;
  const undated = input.freshnessWarnings.length - dated;
  parts.push(
    `${input.contradictions.length} possible contradiction${input.contradictions.length === 1 ? "" : "s"} and ${dated} freshness warning${dated === 1 ? "" : "s"} were raised; ${undated} source${undated === 1 ? " is" : "s are"} undated.`,
  );
  return parts.join(" ");
}

export function standardLimitations(input: ReportInput): string[] {
  const out = [
    "Findings cover only the sources reviewed. Information marked “not found in the reviewed sources” may exist elsewhere.",
    "Undated sources are not treated as outdated; their currency simply could not be confirmed from the source itself.",
    "Contradictions are reported without picking a side. Authority notes (official domain, newer stated date) are signals, not verdicts.",
    "Unanswered questions and checklist items are AI suggestions derived from the findings and should be checked against official sources.",
    "Every quote shown was verified verbatim against the retrieved text; model output whose quote could not be found was discarded.",
  ];
  const failed = input.sources.filter((s) => s.extractionStatus === "failed");
  if (failed.length) out.push(`${failed.length} source(s) could not be read and were not analysed: ${failed.map((s) => s.url ?? s.fileName).join(", ")}.`);
  return [...out, ...(input.limitations ?? [])];
}

export async function generateReport(input: ReportInput, ctx: StageContext): Promise<Report> {
  const report: Report = {
    id: randomUUID(),
    sessionId: ctx.sessionId,
    generatedAt: (ctx.now ?? new Date()).toISOString(),
    model: input.model,
    brief: { topic: ctx.brief.topic, question: ctx.brief.question, objective: ctx.brief.objective ?? "" },
    coverageOverview: coverageOverview(input).slice(0, 3000),
    // Snapshot keeps metadata only; full texts stay in the sources table.
    sources: input.sources.map((s) => ({ ...s, contentText: null })),
    claims: input.claims,
    gaps: input.gaps,
    contradictions: input.contradictions,
    freshnessWarnings: input.freshnessWarnings,
    questions: input.questions,
    checklist: input.checklist,
    coverage: input.coverage,
    limitations: standardLimitations(input),
  };
  return reportSchema.parse(report);
}
