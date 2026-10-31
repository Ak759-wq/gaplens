import type { Claim, Source } from "@/server/ai/schemas";
import { DATE_TOKEN_SRC, parseLooseDate } from "@/server/extract/dates";

/**
 * Deterministic "scope" helpers: which academic year / cycle the research question asks about, which
 * cycle a claim or source speaks to, and whether a source is official. Used to keep the AI stages
 * honest (a 2025-26 deadline does not answer a 2026-27 question; a cross-cycle difference is not a
 * contradiction; "2022-23 onwards" is still in force). No AI involved.
 */

/** Indian academic / scholarship cycles start around June: Oct 2026 → 2026 (i.e. 2026-27). */
export function currentCycleStart(now: Date): number {
  return now.getUTCMonth() >= 5 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
}

export const cycleLabel = (start: number) => `${start}-${String(start + 1).slice(2)}`;

export type CycleMention = { start: number; label: string; index: number; match: string; openEnded: boolean };

const OPEN_AFTER_RE = /^\W{0,3}(?:and\s+)?onwards?\b/i;
const OPEN_BEFORE_RE =
  /(?:(?:w\.?\s?e\.?\s?f\.?|with\s+effect\s+from|effective\s+from)\s*(?:the\s+)?(?:(?:academic|financial|fiscal)\s+)?(?:year|session)?|(?:from|since)\s+(?:the\s+)?(?:academic|financial|fiscal)\s+(?:year|session))\s*$/i;

/** Academic-year mentions such as 2024-25 / 2025–2026. "2022-23 onwards" / "w.e.f. 2022-23" are open-ended. */
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
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 16);
    const before = text.slice(Math.max(0, m.index - 48), m.index);
    // "2022-23 onwards" / "from financial year 2022-23" describe a rule still in force, not a past cycle.
    const openEnded = OPEN_AFTER_RE.test(after) || OPEN_BEFORE_RE.test(before);
    out.push({ start: a, label: `${a}-${String(b).slice(2)}`, index: m.index, match: m[0], openEnded });
    if (out.length > 500) break;
  }
  return out;
}

const FURTHER_ORDERS_RE = /\b(?:until|till)\s+further\s+orders?\b/i;

/**
 * Rule-based "still in force" determination for a source: it says it applies "<cycle> onwards" (or
 * from a financial year) for a cycle at or before `cycle`, or "until further orders".
 */
export function inForceDetermination(text: string | null | undefined, cycle: number): string | null {
  if (!text) return null;
  const open = findCycleMentions(text).find((c) => c.openEnded && c.start <= cycle);
  if (open) return `states it applies from ${open.label} onwards`;
  const fo = FURTHER_ORDERS_RE.exec(text);
  if (fo) return `states it applies "${fo[0]}"`;
  return null;
}

export type AskedScope = { cycleStart: number; label: string; explicit: boolean; matched: string };

/**
 * The cycle the research question asks about. Explicit "2026-27" (or "2026 cycle/session/intake") wins;
 * "this/current cycle|year|session" maps to the current cycle (explicit=false). Otherwise null.
 */
export function parseAskedScope(brief: { topic: string; question: string; objective?: string }, now: Date): AskedScope | null {
  const text = `${brief.question}\n${brief.topic}\n${brief.objective ?? ""}`;
  const cycles = findCycleMentions(text).filter((c) => !c.openEnded);
  if (cycles.length) {
    const c = cycles.reduce((a, b) => (b.start > a.start ? b : a));
    return { cycleStart: c.start, label: c.label, explicit: true, matched: c.match };
  }
  const y = /\b(20\d{2})\s+(?:cycle|session|intake|batch|admissions?|academic\s+year|round)\b|\b(?:cycle|session|intake|academic\s+year|year)\s+(20\d{2})\b/i.exec(text);
  if (y) {
    const start = Number(y[1] ?? y[2]);
    return { cycleStart: start, label: cycleLabel(start), explicit: true, matched: y[0] };
  }
  const cur = /\b(?:this|current|upcoming|present)\s+(?:cycle|session|academic\s+year|year|round|intake)\b/i.exec(text);
  if (cur) {
    const start = currentCycleStart(now);
    return { cycleStart: start, label: cycleLabel(start), explicit: false, matched: cur[0] };
  }
  return null;
}

export type ScopeVerdict = "match" | "mismatch" | "unknown";
export type ScopeResult = { verdict: ScopeVerdict; found: string[]; basis: "claim" | "source" | "none"; inForce?: string };

/** Which cycle a piece of text (a claim) speaks to, relative to the asked cycle. */
export function textScope(text: string, date: string | undefined, asked: number): { verdict: ScopeVerdict; found: string[] } {
  const cycles = findCycleMentions(text);
  if (cycles.length) {
    if (cycles.some((c) => c.start === asked || (c.openEnded && c.start <= asked))) return { verdict: "match", found: cycles.map((c) => c.label + (c.openEnded ? " onwards" : "")) };
    return { verdict: "mismatch", found: [...new Set(cycles.map((c) => c.label))] };
  }
  const years = new Set<number>();
  if (date && /^\d{4}/.test(date)) years.add(Number(date.slice(0, 4)));
  for (const m of text.matchAll(/\b(20\d{2})\b/g)) years.add(Number(m[1]));
  if (years.size) {
    const list = [...years].sort();
    // A cycle that starts in `asked` runs into `asked + 1` (e.g. a January deadline of a 2026-27 cycle).
    if (list.some((y) => y === asked || y === asked + 1)) return { verdict: "match", found: list.map(String) };
    return { verdict: "mismatch", found: list.map(String) };
  }
  return { verdict: "unknown", found: [] };
}

/** Cycle signal of a whole source (used when a claim itself states no year). */
export function sourceScope(source: Source, asked: number): ScopeResult {
  const text = source.contentText ?? "";
  const inForce = inForceDetermination(text, asked);
  if (inForce) return { verdict: "match", found: [], basis: "source", inForce };
  const cycles = findCycleMentions(text);
  if (cycles.some((c) => c.start === asked)) return { verdict: "match", found: [cycleLabel(asked)], basis: "source" };
  if (cycles.length && cycles.every((c) => c.start < asked)) return { verdict: "mismatch", found: [...new Set(cycles.map((c) => c.label))], basis: "source" };
  return { verdict: "unknown", found: [], basis: "none" };
}

/**
 * Does `claim` answer for the asked cycle?
 *  - "claim" sensitivity (deadlines, timelines): the claim itself must carry the year/cycle.
 *  - "source" sensitivity (eligibility, amounts…): a claim with no year inherits its source's cycle
 *    signal ("2022-23 onwards" guidelines count as current; a 2025-26 notice does not).
 */
export function claimScope(claim: Claim, source: Source | undefined, asked: number, sensitivity: "claim" | "source"): ScopeResult {
  const own = textScope(`${claim.text}\n${claim.quote}`, claim.date, asked);
  if (own.verdict !== "unknown" || sensitivity === "claim" || !source) return { ...own, basis: own.verdict === "unknown" ? "none" : "claim" };
  return sourceScope(source, asked);
}

const OFFICIAL_HOST_RE = /(\.gov\.in|\.nic\.in|\.gov|\.ac\.in|\.edu\.in|\.edu|\.res\.in|\.gov\.[a-z]{2}|\.gc\.ca|\.gov\.uk)$/i;

export function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** True for official government/academic domains. Uploaded files (no URL) are treated as not third-party. */
export function isOfficialSource(s: Source): boolean {
  const h = hostOf(s.url);
  return h ? OFFICIAL_HOST_RE.test(h) : true;
}

/** Stated date we can rely on: present and not simply equal to the retrieval day (often generated dynamically). */
export function hasReliableDate(s: Source): boolean {
  const stated = [s.modifiedAt, s.publishedAt].filter((d): d is string => !!d).sort().pop();
  if (!stated) return false;
  return !(s.retrievedAt && stated.slice(0, 10) === s.retrievedAt.slice(0, 10));
}

/* --------------------------------- values --------------------------------- */

export type ExtractedValue = { kind: "amount" | "percent" | "date"; value: string; raw: string };

const AMOUNT_RE = /(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d+)?)\s*(lakhs?|lacs?|crores?|k\b)?|([\d.]+)\s*(lakhs?|lacs?|crores?)/gi;
const PERCENT_RE = /(\d+(?:\.\d+)?)\s*(?:%|percent\b|per\s+cent\b|(?:th\s+)?percentile\b)/gi;
const DATE_RE = new RegExp(DATE_TOKEN_SRC, "gi");
const DAY_MONTH_RE = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b(?!\.?[\s,-]+\d{4})|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b(?!,?\s+\d{4})/gi;

/**
 * Numeric and date values stated in a claim (amounts in ₹, percentages, dates). Used to point the
 * contradiction detector at real value differences; never shown as evidence on its own.
 */
export function extractValues(text: string): ExtractedValue[] {
  const out: ExtractedValue[] = [];
  const mult = (u?: string) => (!u ? 1 : /^l/i.test(u) ? 100_000 : /^c/i.test(u) ? 10_000_000 : /^k/i.test(u) ? 1000 : 1);
  for (const m of text.matchAll(AMOUNT_RE)) {
    const num = Number((m[1] ?? m[3] ?? "").replace(/,/g, ""));
    if (!Number.isFinite(num) || num === 0) continue;
    out.push({ kind: "amount", value: `₹${Math.round(num * mult(m[2] ?? m[4]))}`, raw: m[0].trim() });
  }
  for (const m of text.matchAll(PERCENT_RE)) out.push({ kind: "percent", value: `${Number(m[1])}%`, raw: m[0].trim() });
  for (const m of text.matchAll(DATE_RE)) {
    const p = parseLooseDate(m[0]);
    if (p) out.push({ kind: "date", value: p.iso, raw: m[0] });
  }
  for (const m of text.matchAll(DAY_MONTH_RE)) {
    const day = m[1] ?? m[4];
    const mon = (m[2] ?? m[3])!.toLowerCase();
    out.push({ kind: "date", value: `--${mon}-${String(Number(day)).padStart(2, "0")}`, raw: m[0].trim() });
  }
  const seen = new Set<string>();
  return out.filter((v) => (seen.has(v.kind + v.value) ? false : (seen.add(v.kind + v.value), true)));
}

/** Year-less "--oct-31" and "2025-10-31" describe the same day of year. */
const MONTH_NUM: Record<string, string> = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
export function dayOfYear(v: string): string {
  const m = /^--([a-z]{3})-(\d{2})$/.exec(v);
  return m ? `${MONTH_NUM[m[1]!]}-${m[2]}` : v.slice(5, 10);
}

/** Do two claims state different values of the same kind? (Dates compared on day-of-year when one has no year.) */
export function differingValues(a: ExtractedValue[], b: ExtractedValue[]): { kind: ExtractedValue["kind"]; a: string[]; b: string[] }[] {
  const out: { kind: ExtractedValue["kind"]; a: string[]; b: string[] }[] = [];
  for (const kind of ["amount", "percent", "date"] as const) {
    const av = a.filter((v) => v.kind === kind);
    const bv = b.filter((v) => v.kind === kind);
    if (!av.length || !bv.length) continue;
    const norm = (v: ExtractedValue, other: ExtractedValue[]) =>
      kind === "date" && (v.value.startsWith("--") || other.some((o) => o.value.startsWith("--"))) ? dayOfYear(v.value) : v.value;
    const as = new Set(av.map((v) => norm(v, bv)));
    const bs = new Set(bv.map((v) => norm(v, av)));
    if ([...as].some((x) => bs.has(x))) continue;
    out.push({ kind, a: av.map((v) => v.raw), b: bv.map((v) => v.raw) });
  }
  return out;
}

/** True for a valid YYYY-MM-DD string. */
export function parseLooseDateIso(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !!parseLooseDate(v);
}
