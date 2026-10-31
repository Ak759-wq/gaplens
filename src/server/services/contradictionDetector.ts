import "server-only";
import { randomUUID } from "node:crypto";
import { buildContradictionDetectionPrompt } from "@/server/ai/prompts";
import { contradictionsLlmSchema, type Claim, type Contradiction, type Source, type TopicCoverage } from "@/server/ai/schemas";
import { ConfigError } from "@/server/ai/errors";
import { AliasMap, evidenceFromClaims, safeHost, sourcesForPrompt } from "./corpus";
import { cycleLabel, differingValues, extractValues, findCycleMentions, parseLooseDateIso } from "./scope";
import type { ExtractedCorpus, StageContext } from "./types";

export type CandidateGroup = { topicKey: string; label: string; claims: Claim[]; pairCount: number };

const MAX_CLAIMS_PER_GROUP = 14;
const MAX_GROUPS = 12;

/**
 * Deterministic pairing: group claims by topic (from gap detection's coverage map), keep only groups
 * with claims from ≥2 different sources, and count cross-source pairs. Only these pairs are sent to the
 * model, so it never compares claims from the same source. Date/deadline claims that fall outside every
 * topic are grouped together as a catch-all, since conflicting dates are the commonest contradiction.
 */
export function buildContradictionCandidates(coverage: TopicCoverage[], claims: Claim[]): CandidateGroup[] {
  const byId = new Map(claims.map((c) => [c.id, c]));
  const groups: CandidateGroup[] = [];
  const grouped = new Set<string>();
  const finish = (topicKey: string, label: string, list: Claim[]) => {
    const perSource = new Map<string, Claim[]>();
    for (const c of list) perSource.set(c.sourceId, [...(perSource.get(c.sourceId) ?? []), c]);
    if (perSource.size < 2) return;
    // Round-robin across sources so every source is represented when capping.
    const picked: Claim[] = [];
    const queues = [...perSource.values()].map((q) => [...q]);
    while (picked.length < MAX_CLAIMS_PER_GROUP && queues.some((q) => q.length)) {
      for (const q of queues) if (q.length && picked.length < MAX_CLAIMS_PER_GROUP) picked.push(q.shift()!);
    }
    let pairCount = 0;
    for (let i = 0; i < picked.length; i++) for (let j = i + 1; j < picked.length; j++) if (picked[i]!.sourceId !== picked[j]!.sourceId) pairCount++;
    groups.push({ topicKey, label, claims: picked, pairCount });
  };
  for (const t of coverage) {
    const list = t.claimIds.map((id) => byId.get(id)).filter((c): c is Claim => !!c);
    list.forEach((c) => grouped.add(c.id));
    finish(t.key, t.label, list);
  }
  const looseDates = claims.filter((c) => c.category === "date_deadline" && !grouped.has(c.id));
  finish("dates_and_deadlines", "Other dates and deadlines", looseDates);
  return groups.sort((a, b) => b.pairCount - a.pairCount).slice(0, MAX_GROUPS);
}

const OFFICIAL_RE = /(\.gov\.in|\.nic\.in|\.gov|\.ac\.in|\.edu\.in|\.edu|\.res\.in|\.gov\.[a-z]{2})$/i;

/** Evidence-based authority signals. Never a verdict. */
export function authorityNote(sources: Source[]): string | null {
  const notes: string[] = [];
  const official = sources.filter((s) => s.url && OFFICIAL_RE.test(safeHost(s.url) ?? ""));
  if (official.length > 0 && official.length < sources.length) {
    notes.push(`${official.map((s) => safeHost(s.url!)).join(", ")} ${official.length === 1 ? "is an official government/academic domain" : "are official government/academic domains"}.`);
  }
  const dated = sources
    .map((s) => ({ s, d: [s.modifiedAt, s.publishedAt].filter(Boolean).sort().pop() ?? null }))
    .filter((x): x is { s: Source; d: string } => !!x.d);
  if (dated.length >= 2) {
    dated.sort((a, b) => (a.d < b.d ? 1 : -1));
    if (dated[0]!.d.slice(0, 10) !== dated[1]!.d.slice(0, 10)) {
      const name = dated[0]!.s.title ?? safeHost(dated[0]!.s.url ?? "") ?? dated[0]!.s.fileName ?? "One source";
      notes.push(`"${name}" states the most recent date (${dated[0]!.d.slice(0, 10)}).`);
    }
  }
  const undated = sources.filter((s) => !s.publishedAt && !s.modifiedAt).length;
  if (undated) notes.push(`${undated} of these sources ${undated === 1 ? "is" : "are"} undated.`);
  if (!notes.length) return null;
  return `${notes.join(" ")} These are signals only; GapLens does not decide which source is correct. Confirm with the issuing authority.`.slice(0, 600);
}

export type ClaimCycle = { start: number | null; label: string | null; openEnded: boolean; basis: "claim" | "source" | "none" };

/**
 * The cycle a claim refers to: an academic year it states ("2025-26"), else the cycle of a full date it
 * states (Oct 2025 → 2025-26, since cycles start around June), else the single cycle its source is about
 * (a notice that only mentions 2025-26). "2022-23 onwards" is open-ended: compatible with any later cycle.
 */
export function cycleOfClaim(c: Claim, src: Source | undefined): ClaimCycle {
  const text = `${c.text}\n${c.quote}`;
  const cyc = findCycleMentions(text);
  const closed = cyc.filter((m) => !m.openEnded);
  if (closed.length) {
    const starts = [...new Set(closed.map((m) => m.start))];
    if (starts.length === 1) return { start: starts[0]!, label: cycleLabel(starts[0]!), openEnded: false, basis: "claim" };
    return { start: null, label: closed.map((m) => m.label).join("/"), openEnded: false, basis: "claim" };
  }
  if (cyc.length) return { start: null, label: `${cyc[0]!.label} onwards`, openEnded: true, basis: "claim" };
  const dates = [c.date?.slice(0, 10), ...extractValues(text).filter((v) => v.kind === "date" && !v.value.startsWith("--")).map((v) => v.value)]
    .filter((d): d is string => !!d && !!parseLooseDateIso(d));
  const starts = [...new Set(dates.map((d) => (Number(d.slice(5, 7)) >= 6 ? Number(d.slice(0, 4)) : Number(d.slice(0, 4)) - 1)))];
  if (starts.length === 1) return { start: starts[0]!, label: cycleLabel(starts[0]!), openEnded: false, basis: "claim" };
  if (src?.contentText) {
    const sc = findCycleMentions(src.contentText);
    if (sc.some((m) => m.openEnded)) return { start: null, label: null, openEnded: true, basis: "source" };
    const ss = [...new Set(sc.map((m) => m.start))];
    if (ss.length === 1) return { start: ss[0]!, label: cycleLabel(ss[0]!), openEnded: false, basis: "source" };
  }
  return { start: null, label: null, openEnded: false, basis: "none" };
}

export type ValueDifference = { topicKey: string; a: string; b: string; kind: string; aValues: string[]; bValues: string[] };

/** Deterministic hints: cross-source claim pairs in a group that state different amounts/percentages/dates. */
export function findValueDifferences(groups: CandidateGroup[], alias: (id: string) => string): ValueDifference[] {
  const out: ValueDifference[] = [];
  for (const g of groups) {
    const vals = g.claims.map((c) => extractValues(`${c.text} ${c.quote}`));
    for (let i = 0; i < g.claims.length; i++)
      for (let j = i + 1; j < g.claims.length; j++) {
        if (g.claims[i]!.sourceId === g.claims[j]!.sourceId) continue;
        for (const d of differingValues(vals[i]!, vals[j]!)) {
          out.push({ topicKey: g.topicKey, a: alias(g.claims[i]!.id), b: alias(g.claims[j]!.id), kind: d.kind, aValues: d.a, bValues: d.b });
          if (out.length >= 60) return out;
        }
      }
  }
  return out;
}

/**
 * Decide whether a model-reported disagreement is a real contradiction or a cycle mismatch. Positions
 * that each rest on one known, different cycle (2025-26 vs 2026-27) are a cycle mismatch: a freshness
 * issue, not a contradiction. Same-cycle (or undeterminable) disagreements stay contradictions.
 */
export function classifyPositions(positionCycles: ClaimCycle[][], modelRelation?: "same" | "different" | "unclear"): { kind: "contradiction" | "cycle_mismatch"; cycles: (string | null)[]; unknown: number[] } {
  const per = positionCycles.map((cs) => {
    const starts = [...new Set(cs.filter((c) => c.start !== null).map((c) => c.start!))];
    return starts.length === 1 ? starts[0]! : null;
  });
  const cycles = per.map((p, i) => (p !== null ? cycleLabel(p) : positionCycles[i]!.find((c) => c.label)?.label ?? null));
  const unknown = per.map((p, i) => (p === null ? i : -1)).filter((i) => i >= 0);
  const known = per.filter((p): p is number => p !== null);
  const sharedKnown = known.length !== new Set(known).size;
  if (unknown.length === 0 && !sharedKnown && known.length >= 2) return { kind: "cycle_mismatch", cycles, unknown };
  if (modelRelation === "different" && !sharedKnown && known.length >= 1) return { kind: "cycle_mismatch", cycles, unknown };
  return { kind: "contradiction", cycles, unknown };
}

export async function detectContradictions(
  corpus: ExtractedCorpus & { coverage: TopicCoverage[] },
  ctx: StageContext,
): Promise<{ contradictions: Contradiction[]; groupsCompared: number; pairsCompared: number; valueDifferences: number }> {
  const groups = buildContradictionCandidates(corpus.coverage, corpus.claims);
  if (groups.length === 0) return { contradictions: [], groupsCompared: 0, pairsCompared: 0, valueDifferences: 0 };
  if (!ctx.llm) throw new ConfigError("Configuration required: an AI provider key is needed for contradiction detection.", ["GEMINI_API_KEY"]);

  const sa = new AliasMap(corpus.sources, "S");
  const ca = new AliasMap(corpus.claims, "C");
  const sourceById = new Map(corpus.sources.map((s) => [s.id, s]));
  const cycleOf = (c: Claim) => cycleOfClaim(c, sourceById.get(c.sourceId));
  const groupsJson = JSON.stringify(
    groups.map((g) => ({
      topicKey: g.topicKey,
      topic: g.label,
      claims: g.claims.map((c) => {
        const cy = cycleOf(c);
        const values = extractValues(`${c.text} ${c.quote}`).map((v) => v.raw);
        return {
          id: ca.alias(c.id),
          source: sa.alias(c.sourceId),
          text: c.text.slice(0, 300),
          quote: c.quote.slice(0, 260),
          ...(c.date ? { date: c.date } : {}),
          cycle: cy.label ?? "not stated",
          ...(values.length ? { values } : {}),
        };
      }),
    })),
  );
  const diffs = findValueDifferences(groups, (id) => ca.alias(id));
  const out = await ctx.llm.generate(
    buildContradictionDetectionPrompt(ctx.brief, groupsJson, sourcesForPrompt(corpus.sources, sa), JSON.stringify(diffs)),
    contradictionsLlmSchema,
    { label: "Contradiction detection", signal: ctx.signal },
  );

  const contradictions: Contradiction[] = [];
  for (const c of out.contradictions.slice(0, 20)) {
    const used = new Set<string>();
    const resolved = c.positions
      .map((p) => {
        const cl = ca.resolveMany(p.claimIds).filter((x) => !used.has(x.id));
        cl.forEach((x) => used.add(x.id));
        return { statement: p.statement.slice(0, 1000), claims: cl };
      })
      .filter((p) => p.claims.length > 0);
    const allSources = new Set(resolved.flatMap((p) => p.claims.map((x) => x.sourceId)));
    // Need ≥2 positions and they must not all rest on the same single source.
    if (resolved.length < 2 || allSources.size < 2) continue;
    const cls = classifyPositions(resolved.map((p) => p.claims.map(cycleOf)), c.cycleRelation);
    const explanations = (c.possibleExplanations ?? []).map((x) => x.slice(0, 500));
    if (cls.kind === "contradiction" && cls.unknown.length) {
      explanations.unshift(`Position ${cls.unknown.map((i) => String.fromCharCode(65 + i)).join(", ")} states no cycle/year, so it may describe a different cycle.`);
    }
    const cycleText = cls.cycles.map((x, i) => `${String.fromCharCode(65 + i)}: ${x ?? "not stated"}`).join("; ");
    contradictions.push({
      id: randomUUID(),
      topic: c.topic.slice(0, 200),
      description: (cls.kind === "cycle_mismatch"
        ? `Cycle mismatch, not a contradiction: the positions refer to different cycles (${cycleText}). ${c.description} The older value most likely belongs to an earlier cycle; confirm the value for the cycle you need.`
        : c.description
      ).slice(0, 2000),
      positions: resolved.map((p) => ({ statement: p.statement, evidence: evidenceFromClaims(p.claims).slice(0, 10) })),
      severity: cls.kind === "cycle_mismatch" ? "low" : c.severity,
      possibleExplanations: explanations.slice(0, 5),
      topicKey: c.topicKey.slice(0, 80),
      authorityNote: authorityNote([...allSources].map((id) => sourceById.get(id)!).filter(Boolean)),
      kind: cls.kind,
      cycles: cls.cycles,
    });
  }
  return { contradictions, groupsCompared: groups.length, pairsCompared: groups.reduce((n, g) => n + g.pairCount, 0), valueDifferences: diffs.length };
}
