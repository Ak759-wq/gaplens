import "server-only";
import { randomUUID } from "node:crypto";
import { buildChecklistGenerationPrompt } from "@/server/ai/prompts";
import { checklistLlmSchema, type ChecklistItem } from "@/server/ai/schemas";
import { ConfigError } from "@/server/ai/errors";
import { AliasMap } from "./corpus";
import type { FindingSummary } from "./findings";
import { findingsForPrompt } from "./questionGenerator";
import type { StageContext } from "./types";

const RANK = { high: 0, medium: 1, low: 2 } as const;

/** Prioritised verification checklist. Every item must link to ≥1 existing finding; others are dropped. */
export async function generateChecklist(findings: FindingSummary[], ctx: StageContext): Promise<ChecklistItem[]> {
  const usable = findings.slice(0, 100);
  if (usable.length === 0) return [];
  if (!ctx.llm) throw new ConfigError("Configuration required: an AI provider key is needed to build the checklist.", ["GEMINI_API_KEY"]);
  const fa = new AliasMap(usable, "F");
  const out = await ctx.llm.generate(buildChecklistGenerationPrompt(ctx.brief, findingsForPrompt(usable, fa)), checklistLlmSchema, { label: "Checklist generation", signal: ctx.signal });
  return out.items
    .map((it) => ({ it, linked: fa.resolveMany(it.findingIds) }))
    .filter(({ linked }) => linked.length > 0)
    .slice(0, 15)
    .map(({ it, linked }) => ({
      id: randomUUID(),
      action: it.action.slice(0, 500),
      priority: it.priority,
      rationale: it.rationale.slice(0, 1000),
      findingIds: linked.map((f) => f.id).slice(0, 20),
    }))
    .sort((a, b) => RANK[a.priority] - RANK[b.priority]);
}
