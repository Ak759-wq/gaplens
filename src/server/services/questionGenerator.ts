import "server-only";
import { randomUUID } from "node:crypto";
import { buildQuestionGenerationPrompt } from "@/server/ai/prompts";
import { questionsLlmSchema, type Question } from "@/server/ai/schemas";
import { ConfigError } from "@/server/ai/errors";
import { AliasMap } from "./corpus";
import type { FindingSummary } from "./findings";
import type { StageContext } from "./types";

export function findingsForPrompt(findings: FindingSummary[], fa: AliasMap<FindingSummary>): string {
  return JSON.stringify(findings.map((f) => ({ id: fa.alias(f.id), type: f.type, severity: f.severity, title: f.title.slice(0, 200), detail: f.detail.slice(0, 400) })));
}

/**
 * Unanswered questions = AI suggestions for what to ask next, each tied to ≥1 real finding.
 * They are labelled "AI suggestion", distinct from gaps (which are "not found in reviewed sources").
 */
export async function generateQuestions(findings: FindingSummary[], ctx: StageContext): Promise<Question[]> {
  const usable = findings.filter((f) => f.type !== "question").slice(0, 80);
  if (usable.length === 0) return [];
  if (!ctx.llm) throw new ConfigError("Configuration required: an AI provider key is needed to generate questions.", ["GEMINI_API_KEY"]);
  const fa = new AliasMap(usable, "F");
  const out = await ctx.llm.generate(buildQuestionGenerationPrompt(ctx.brief, findingsForPrompt(usable, fa)), questionsLlmSchema, { label: "Question generation", signal: ctx.signal });
  const seen = new Set<string>();
  const questions: Question[] = [];
  for (const q of out.questions.slice(0, 12)) {
    const related = fa.resolveMany(q.relatedFindingIds);
    const key = q.question.toLowerCase().replace(/\W+/g, " ").trim();
    if (related.length === 0 || seen.has(key)) continue;
    seen.add(key);
    questions.push({
      id: randomUUID(),
      question: q.question.slice(0, 500),
      whyItMatters: q.whyItMatters.slice(0, 1000),
      relatedFindingIds: related.map((r) => r.id).slice(0, 20),
      ...(q.suggestedSourceType ? { suggestedSourceType: q.suggestedSourceType.slice(0, 200) } : {}),
      basis: q.basis,
    });
  }
  return questions;
}
