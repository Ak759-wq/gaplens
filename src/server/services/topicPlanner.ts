import "server-only";
import { buildTopicPlanningPrompt } from "@/server/ai/prompts";
import { topicPlanLlmSchema } from "@/server/ai/schemas";
import { AIProviderError, ConfigError } from "@/server/ai/errors";
import type { Severity } from "@/server/ai/schemas/common";
import type { AskedScope } from "./scope";
import type { StageContext } from "./types";

/**
 * Topic planning, independent of the claims. Required topics come from (1) a deterministic domain
 * checklist and (2) the aspects the question itself lists; the LLM (which sees only the brief) may add
 * a few question-specific topics. Because the planner never sees the sources, a topic cannot be
 * "covered" just because it was derived from what a source happened to say.
 */

/** "claim": the claim itself must state the asked year (deadlines). "source": may inherit its source's cycle. "none": not cycle-bound. */
export type ScopeSensitivity = "claim" | "source" | "none";
export type PlannedTopic = {
  key: string;
  label: string;
  whyItMatters: string;
  severity: Severity;
  sensitivity: ScopeSensitivity;
  origin: "checklist" | "question" | "ai";
};

type ChecklistEntry = Omit<PlannedTopic, "origin"> & { match: RegExp };

const forCycle = (s: AskedScope | null) => (s ? ` for ${s.label}` : " for the asked cycle");

export function scholarshipChecklist(scope: AskedScope | null): ChecklistEntry[] {
  return [
    { key: "eligibility", label: "Eligibility criteria", whyItMatters: "Decides whether the applicant can apply at all (marks/percentile, course type, institution, nationality).", severity: "high", sensitivity: "source", match: /eligib|who can apply|criteria/i },
    { key: "income_limit", label: "Family income limit", whyItMatters: "An income ceiling above or below the family's income changes eligibility outright.", severity: "high", sensitivity: "source", match: /income/i },
    { key: "amount", label: "Scholarship amount / rate", whyItMatters: "How much is paid per year and at which level determines whether applying is worthwhile.", severity: "high", sensitivity: "source", match: /amount|how much|rate|stipend|value|money/i },
    { key: "application_deadline", label: `Application deadline${forCycle(scope)}`, whyItMatters: "Missing the deadline for the cycle you are applying in means waiting a full year.", severity: "high", sensitivity: "claim", match: /deadline|last date|closing|due date|when to apply/i },
    { key: "required_documents", label: "Required documents", whyItMatters: "Missing or wrong documents (income certificate, marksheet, bank details) are a common rejection reason.", severity: "medium", sensitivity: "source", match: /document|certificate|paperwork/i },
    { key: "renewal_conditions", label: "Renewal process and conditions", whyItMatters: "Whether and how the award is renewed each year decides its total value over the course.", severity: "medium", sensitivity: "source", match: /renew/i },
    { key: "continuation_conditions", label: "Continuation conditions (marks, attendance, conduct)", whyItMatters: "Failing a marks, attendance or conduct condition can stop or forfeit the scholarship.", severity: "medium", sensitivity: "source", match: /attendance|continu|marks to keep|conduct|forfeit/i },
    { key: "selection_process", label: "Selection / merit process", whyItMatters: "How applicants are ranked or shortlisted affects the realistic chance of getting it.", severity: "medium", sensitivity: "source", match: /selection|merit|shortlist|rank/i },
    { key: "disbursement", label: "Disbursement method and timeline", whyItMatters: "When and how money is paid (DBT, bank account rules) affects planning for fees.", severity: "medium", sensitivity: "source", match: /disburs|payment|paid|dbt|bank/i },
    { key: "coverage_scope", label: "What the scholarship covers (fees, hostel, other costs)", whyItMatters: "Whether tuition, hostel or other costs are covered changes how much the family still has to pay.", severity: "low", sensitivity: "source", match: /cover|hostel|tuition|fees?\b/i },
    { key: "quotas", label: "Category / reservation quotas and number of awards", whyItMatters: "Reservations (e.g. for girls or categories) and the number of slots affect the chance of selection.", severity: "low", sensitivity: "source", match: /quota|reserv|categor|slots?|number of (?:awards|scholarships)/i },
    { key: "official_contact", label: "Official portal, contact and grievance channel", whyItMatters: "Needed to confirm details and to resolve problems with an application.", severity: "low", sensitivity: "none", match: /contact|helpline|grievance|portal|official/i },
  ];
}

const DOMAIN_RE = /\b(scholarships?|fellowships?|stipends?|admissions?|yojana|schemes?|grants?|subsid(?:y|ies)|entrance\s+exam|counsell?ing|fee\s+reimbursement|financial\s+aid|bursar(?:y|ies))\b/i;

export function detectDomain(brief: { topic: string; question: string; objective?: string }): "scholarship_scheme" | "generic" {
  return DOMAIN_RE.test(`${brief.topic} ${brief.question} ${brief.objective ?? ""}`) ? "scholarship_scheme" : "generic";
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);

/** Aspects the question lists explicitly ("…: eligibility, income limit, amount, deadline and renewal?"). */
export function questionAspects(question: string): string[] {
  const tail = question.includes(":") ? question.slice(question.lastIndexOf(":") + 1) : "";
  if (!tail.trim()) return [];
  return tail
    .replace(/[?.!]+\s*$/, "")
    .split(/,|;|\band\b|\bor\b|\//i)
    .map((s) => s.trim().replace(/^(?:the|its|their)\s+/i, ""))
    .filter((s) => s.length >= 3 && s.length <= 60)
    .slice(0, 10);
}

const TIME_WORDS = /deadline|last date|date|timeline|schedule|when|closing|opening/i;

/** Deterministic required topics: domain checklist + any question aspect the checklist does not cover. */
export function baselineTopics(brief: { topic: string; question: string; objective?: string }, scope: AskedScope | null): PlannedTopic[] {
  const aspects = questionAspects(brief.question);
  const out: PlannedTopic[] = [];
  if (detectDomain(brief) === "scholarship_scheme") {
    const list = scholarshipChecklist(scope);
    const asked = (e: ChecklistEntry) => e.match.test(brief.question);
    for (const e of list) {
      const { match: _m, ...t } = e;
      void _m;
      out.push({ ...t, origin: asked(e) ? "question" : "checklist" });
    }
    for (const a of aspects) {
      if (list.some((e) => e.match.test(a))) continue;
      out.push(aspectTopic(a, scope));
    }
    return out;
  }
  for (const a of aspects) out.push(aspectTopic(a, scope));
  if (out.length === 0) {
    out.push(
      { key: "key_facts", label: "Key facts the question asks for", whyItMatters: "The core answer to the research question.", severity: "high", sensitivity: "source", origin: "question" },
      { key: "dates_deadlines", label: `Relevant dates and deadlines${scope ? forCycle(scope) : ""}`, whyItMatters: "Timing can decide whether action is still possible.", severity: "high", sensitivity: "claim", origin: "checklist" },
      { key: "requirements_conditions", label: "Requirements and conditions", whyItMatters: "Conditions that apply can change the answer.", severity: "medium", sensitivity: "source", origin: "checklist" },
      { key: "official_source", label: "Official source or authority", whyItMatters: "Needed to confirm anything taken from secondary sources.", severity: "low", sensitivity: "none", origin: "checklist" },
    );
  }
  return out;
}

function aspectTopic(a: string, scope: AskedScope | null): PlannedTopic {
  const time = TIME_WORDS.test(a);
  const label = a.charAt(0).toUpperCase() + a.slice(1) + (time && scope ? forCycle(scope) : "");
  return { key: slug(a) || "aspect", label, whyItMatters: `The question asks about ${a} directly.`, severity: "high", sensitivity: time ? "claim" : "source", origin: "question" };
}

export const MAX_TOPICS = 15;
const PLAN_TIMEOUT_MS = 15_000;

export function scopeLine(scope: AskedScope | null): string {
  if (!scope) return "No specific cycle/year named in the question.";
  return scope.explicit
    ? `The question asks about the ${scope.label} cycle/year ("${scope.matched}"). Information for other cycles does not answer it.`
    : `The question asks about the current cycle ("${scope.matched}"), taken as ${scope.label}. Information for other cycles does not answer it.`;
}

/** Merge AI-proposed topics into the required list (required topics always kept, AI cannot remove them). */
export function mergePlannedTopics(required: PlannedTopic[], ai: { key: string; label: string; whyItMatters: string; severity: Severity; timeSensitive: boolean }[]): PlannedTopic[] {
  const out = [...required];
  const keys = new Set(out.map((t) => t.key));
  const labels = new Set(out.map((t) => slug(t.label)));
  for (const t of ai) {
    if (out.length >= MAX_TOPICS) break;
    const key = slug(t.key) || slug(t.label);
    if (!key || keys.has(key) || labels.has(slug(t.label))) continue;
    keys.add(key);
    labels.add(slug(t.label));
    out.push({ key, label: t.label.slice(0, 200), whyItMatters: t.whyItMatters.slice(0, 1000) || "Needed to answer the question.", severity: t.severity, sensitivity: t.timeSensitive ? "claim" : "source", origin: "ai" });
  }
  return out;
}

/**
 * Plan topics: deterministic baseline + LLM additions from the brief alone. If the planning call fails
 * (timeout, rate limit, bad output) the deterministic baseline is used, so gap detection still runs.
 */
export async function planTopics(ctx: StageContext, scope: AskedScope | null): Promise<{ topics: PlannedTopic[]; aiUsed: boolean; aiError?: string }> {
  const baseline = baselineTopics(ctx.brief, scope).slice(0, MAX_TOPICS);
  if (!ctx.llm) throw new ConfigError("Configuration required: an AI provider key is needed for gap detection.", ["GEMINI_API_KEY"]);
  // A generic question that lists no aspects: let the planner propose the whole list (baseline is the fallback).
  const openPlan = detectDomain(ctx.brief) === "generic" && questionAspects(ctx.brief.question).length === 0;
  const required = openPlan ? [] : baseline;
  const room = Math.max(0, MAX_TOPICS - required.length);
  if (!openPlan && room === 0) return { topics: required, aiUsed: false };
  const requiredJson = JSON.stringify(required.map((t) => ({ key: t.key, label: t.label })));
  try {
    const signal = ctx.signal ? AbortSignal.any([ctx.signal, AbortSignal.timeout(PLAN_TIMEOUT_MS)]) : AbortSignal.timeout(PLAN_TIMEOUT_MS);
    const out = await ctx.llm.generate(buildTopicPlanningPrompt(ctx.brief, scopeLine(scope), requiredJson, Math.min(3, room) || 8), topicPlanLlmSchema, { label: "Topic planning", signal });
    const ai = required.length ? out.topics.slice(0, Math.min(3, room)) : out.topics.slice(0, 10);
    const merged = mergePlannedTopics(required, ai);
    return { topics: merged.length ? merged : baseline, aiUsed: true };
  } catch (e) {
    if (e instanceof ConfigError) throw e;
    if (e instanceof AIProviderError && e.code === "auth") throw e;
    return { topics: baseline, aiUsed: false, aiError: (e as Error).message.slice(0, 200) };
  }
}
