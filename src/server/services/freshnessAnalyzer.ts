import "server-only";
import { randomUUID } from "node:crypto";
import { buildFreshnessAnalysisPrompt } from "@/server/ai/prompts";
import { freshnessLlmSchema, type Claim, type EvidenceRef, type FreshnessWarning, type Source } from "@/server/ai/schemas";
import { DATE_TOKEN_SRC, parseLooseDate } from "@/server/extract/dates";
import { AliasMap, claimsForPrompt, evidenceFromClaims, sourcesForPrompt } from "./corpus";
import type { ExtractedCorpus, StageContext } from "./types";

/**
 * Freshness = deterministic rules first, LLM assist second.
 *  Rules (no AI needed):
 *   1. Undated source → reason "undated" (labelled "Requires verification", NEVER "outdated").
 *   2. Stated publication/update date ≥ 1 year old → "dated_old".
 *   3. Latest academic year / cycle mentioned (e.g. 2024-25) is before the current cycle → "references_past_cycle".
 *   4. All deadlines a source states have passed → "expired_deadline".
 *   5. Explicit archival / superseded wording → "old_version".
 *  LLM assist (optional): supersession between sources and cycle references the rules can't see.
 */

const DAY = 86_400_000;

/** Indian academic / scholarship cycles start around June: Oct 2026 → 2026 (i.e. 2026-27). */
export function currentCycleStart(now: Date): number {
  return now.getUTCMonth() >= 5 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
}

export type CycleMention = { start: number; label: string; index: number; match: string; openEnded: boolean };

export function findCycleMentions(text: string): CycleMention[] {
  const re = /\b(20\d{2})\s?[-–—/]\s?(20\d{2}|\d{2})\b/g;
  const out: CycleMention[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const a = Number(m[1]);
    const bRaw = m[2]!;
    const b = bRaw.length === 2 ? Math.floor(a / 100) * 100 + Number(bRaw) : Number(bRaw);
    if (b !== a + 1) continue;
    // Skip ISO-like dates such as 2024-12-01 (handled as dates, not cycles).
    if (/^\s?[-–/]\s?\d{1,2}\b/.test(text.slice(m.index + m[0].length, m.index + m[0].length + 4)) && bRaw.length === 2) continue;
    // "2022-23 onwards" describes an open-ended rule that still applies, not a past cycle.
    const openEnded = /^\W{0,3}(?:and\s+)?onwards?\b/i.test(text.slice(m.index + m[0].length, m.index + m[0].length + 16));
    out.push({ start: a, label: `${a}-${String(b).slice(2)}`, index: m.index, match: m[0], openEnded });
    if (out.length > 500) break;
  }
  return out;
}

/** The sentence/line around a position, as an exact substring of `text` (so it verifies as a quote). */
export function sentenceAround(text: string, index: number, length: number, max = 260): string {
  let s = index;
  let e = index + length;
  while (s > 0 && index - s < max / 2 && text[s - 1] !== "\n" && !(text[s - 1] === " " && text[s - 2] === ".")) s--;
  while (e < text.length && e - index < max / 2 + length && text[e] !== "\n" && !(text[e - 1] === "." && text[e] === " ")) e++;
  // Don't start or end mid-word when the window limit cut the sentence.
  if (s > 0 && text[s - 1] !== "\n" && /\w/.test(text[s - 1]!)) {
    const sp = text.indexOf(" ", s);
    if (sp !== -1 && sp < index) s = sp + 1;
  }
  if (e < text.length && /\w/.test(text[e]!)) {
    const sp = text.lastIndexOf(" ", e);
    if (sp > index + length) e = sp;
  }
  return text.slice(s, e).trim();
}

const DEADLINE_RE = new RegExp(
  `(last\\s+date|deadline|closing\\s+dates?|due\\s+date|apply\\s+(?:by|before)|applications?\\s+(?:close|closes|closing|open\\s+till|open\\s+until)|portal\\s+(?:closes|open\\s+till))(?:(?!\\.\\s)[^])${"{0,120}"}?${DATE_TOKEN_SRC}`,
  "gi",
);
const OLD_VERSION_RE = /\b(this (?:page|notification|scheme|circular) (?:is|has been) (?:archived|withdrawn|superseded|discontinued)|has been superseded|no longer (?:valid|in force|accepting applications|available)|archived (?:page|notification|content)|scheme (?:has been )?discontinued)\b/gi;

const ev = (source: Source, quote: string, claims: Claim[]): EvidenceRef => {
  const claim = claims.find((c) => c.sourceId === source.id && (c.quote.includes(quote) || quote.includes(c.quote)));
  return { claimId: claim?.id ?? null, sourceId: source.id, quote };
};

const nameOf = (s: Source) => s.title ?? s.url ?? s.fileName ?? "This source";

export function analyzeFreshnessRules(corpus: ExtractedCorpus, now: Date): FreshnessWarning[] {
  const warnings: FreshnessWarning[] = [];
  const today = now.toISOString().slice(0, 10);
  const cycleNow = currentCycleStart(now);

  for (const s of corpus.sources) {
    const text = s.contentText ?? "";
    const claims = corpus.claims.filter((c) => c.sourceId === s.id);
    const stated = [s.modifiedAt, s.publishedAt].filter((d): d is string => !!d).sort().pop() ?? null;

    // 1 + 2: stated date
    if (!stated) {
      warnings.push({
        id: randomUUID(),
        sourceId: s.id,
        reason: "undated",
        description: `${nameOf(s)} states no publication or update date. Undated is not the same as outdated, but its currency can't be confirmed from the page itself.`,
        sourceDate: null,
        evidence: [],
        severity: "low",
        origin: "rule",
      });
    } else {
      const ageDays = Math.floor((now.getTime() - new Date(stated).getTime()) / DAY);
      if (ageDays >= 365) {
        warnings.push({
          id: randomUUID(),
          sourceId: s.id,
          reason: "dated_old",
          description: `The most recent date this source states is ${stated.slice(0, 10)} (${Math.floor(ageDays / 30.4)} months before ${today}). Details may have changed since.${s.dateEvidence?.length ? ` Date taken from: ${s.dateEvidence.join("; ")}.` : ""}`.slice(0, 1000),
          sourceDate: stated,
          evidence: [],
          severity: ageDays >= 730 ? "high" : "medium",
          origin: "rule",
        });
      }
    }

    if (!text) continue;

    // 3: academic year / cycle references
    const cycles = findCycleMentions(text);
    if (cycles.length && !cycles.some((c) => c.openEnded && c.start <= cycleNow)) {
      const latest = cycles.reduce((a, b) => (b.start > a.start ? b : a));
      if (latest.start < cycleNow) {
        const behind = cycleNow - latest.start;
        warnings.push({
          id: randomUUID(),
          sourceId: s.id,
          reason: "references_past_cycle",
          description: `The latest academic year / cycle this source mentions is ${latest.label}; the current cycle is ${cycleNow}-${String(cycleNow + 1).slice(2)}. Its dates, amounts or rules may belong to an earlier cycle.`,
          sourceDate: stated,
          evidence: [ev(s, sentenceAround(text, latest.index, latest.match.length), claims)],
          severity: behind >= 2 ? "high" : "medium",
          origin: "rule",
        });
      }
    }

    // 4: deadlines — only flagged when EVERY deadline the source states has passed
    const deadlines: { iso: string; quote: string; claimId: string | null }[] = [];
    for (const c of claims) if (c.category === "date_deadline" && c.date) deadlines.push({ iso: c.date.slice(0, 10), quote: c.quote, claimId: c.id });
    DEADLINE_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = DEADLINE_RE.exec(text)) && deadlines.length < 60) {
      const p = parseLooseDate(m[2] ?? "");
      if (p) deadlines.push({ iso: p.iso, quote: sentenceAround(text, m.index, m[0].length), claimId: null });
    }
    if (deadlines.length && deadlines.every((d) => d.iso < today)) {
      const latest = deadlines.reduce((a, b) => (b.iso > a.iso ? b : a));
      const e = latest.claimId ? { claimId: latest.claimId, sourceId: s.id, quote: latest.quote } : ev(s, latest.quote, claims);
      warnings.push({
        id: randomUUID(),
        sourceId: s.id,
        reason: "expired_deadline",
        description: `Every deadline this source states has passed; the latest is ${latest.iso} (today is ${today}). It may describe a previous cycle.`,
        sourceDate: stated,
        evidence: [e],
        severity: "high",
        origin: "rule",
      });
    }

    // 5: explicit archival wording
    OLD_VERSION_RE.lastIndex = 0;
    const ov = OLD_VERSION_RE.exec(text);
    if (ov) {
      warnings.push({
        id: randomUUID(),
        sourceId: s.id,
        reason: "old_version",
        description: `The source itself says: "${ov[0]}".`,
        sourceDate: stated,
        evidence: [ev(s, sentenceAround(text, ov.index, ov[0].length), claims)],
        severity: "high",
        origin: "rule",
      });
    }
  }
  return warnings;
}

export async function analyzeFreshness(corpus: ExtractedCorpus, ctx: StageContext): Promise<{ warnings: FreshnessWarning[]; aiUsed: boolean }> {
  const now = ctx.now ?? new Date();
  const rules = analyzeFreshnessRules(corpus, now);
  if (!ctx.llm || corpus.claims.length === 0) return { warnings: rules, aiUsed: false };

  const sa = new AliasMap(corpus.sources, "S");
  const ca = new AliasMap(corpus.claims, "C");
  // Only date-bearing / cycle-bearing claims matter here; keeps the prompt small.
  const relevant = corpus.claims.filter((c) => c.date || c.category === "date_deadline" || /\b20\d{2}\b/.test(c.quote)).slice(0, 200);
  if (relevant.length === 0) return { warnings: rules, aiUsed: false };
  const ruleSummary = JSON.stringify(rules.map((w) => ({ source: sa.alias(w.sourceId), reason: w.reason })));
  const out = await ctx.llm.generate(
    buildFreshnessAnalysisPrompt(ctx.brief, sourcesForPrompt(corpus.sources, sa), claimsForPrompt(relevant, ca, sa), now.toISOString().slice(0, 10), ruleSummary),
    freshnessLlmSchema,
    { label: "Freshness analysis", signal: ctx.signal },
  );
  const have = new Set(rules.map((w) => `${w.sourceId}:${w.reason}`));
  const ai: FreshnessWarning[] = [];
  for (const w of out.warnings.slice(0, 20)) {
    const src = sa.resolve(w.sourceId);
    const cited = ca.resolveMany(w.claimIds);
    if (!src || cited.length === 0) continue;
    if (have.has(`${src.id}:${w.reason}`)) continue;
    have.add(`${src.id}:${w.reason}`);
    ai.push({
      id: randomUUID(),
      sourceId: src.id,
      reason: w.reason,
      description: w.description.slice(0, 1000),
      sourceDate: [src.modifiedAt, src.publishedAt].filter((d): d is string => !!d).sort().pop() ?? null,
      evidence: evidenceFromClaims(cited).slice(0, 10),
      severity: w.severity,
      origin: "ai",
    });
  }
  return { warnings: [...rules, ...ai], aiUsed: true };
}
