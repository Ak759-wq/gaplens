import "server-only";
import { randomUUID } from "node:crypto";
import { buildContradictionDetectionPrompt } from "@/server/ai/prompts";
import { contradictionsLlmSchema, type Claim, type Contradiction, type Source, type TopicCoverage } from "@/server/ai/schemas";
import { ConfigError } from "@/server/ai/errors";
import { AliasMap, evidenceFromClaims, safeHost, sourcesForPrompt } from "./corpus";
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

export async function detectContradictions(
  corpus: ExtractedCorpus & { coverage: TopicCoverage[] },
  ctx: StageContext,
): Promise<{ contradictions: Contradiction[]; groupsCompared: number; pairsCompared: number }> {
  const groups = buildContradictionCandidates(corpus.coverage, corpus.claims);
  if (groups.length === 0) return { contradictions: [], groupsCompared: 0, pairsCompared: 0 };
  if (!ctx.llm) throw new ConfigError("Configuration required: an AI provider key is needed for contradiction detection.", ["GEMINI_API_KEY"]);

  const sa = new AliasMap(corpus.sources, "S");
  const ca = new AliasMap(corpus.claims, "C");
  const sourceById = new Map(corpus.sources.map((s) => [s.id, s]));
  const groupsJson = JSON.stringify(
    groups.map((g) => ({
      topicKey: g.topicKey,
      topic: g.label,
      claims: g.claims.map((c) => ({ id: ca.alias(c.id), source: sa.alias(c.sourceId), text: c.text.slice(0, 300), quote: c.quote.slice(0, 260), ...(c.date ? { date: c.date } : {}) })),
    })),
  );
  const out = await ctx.llm.generate(buildContradictionDetectionPrompt(ctx.brief, groupsJson, sourcesForPrompt(corpus.sources, sa)), contradictionsLlmSchema, {
    label: "Contradiction detection",
    signal: ctx.signal,
  });

  const contradictions: Contradiction[] = [];
  for (const c of out.contradictions.slice(0, 20)) {
    const used = new Set<string>();
    const positions = c.positions
      .map((p) => {
        const cl = ca.resolveMany(p.claimIds).filter((x) => !used.has(x.id));
        cl.forEach((x) => used.add(x.id));
        return { statement: p.statement.slice(0, 1000), evidence: evidenceFromClaims(cl).slice(0, 10) };
      })
      .filter((p) => p.evidence.length > 0);
    const sourceSets = positions.map((p) => new Set(p.evidence.map((e) => e.sourceId)));
    const allSources = new Set(sourceSets.flatMap((s) => [...s]));
    // Need ≥2 positions and they must not all rest on the same single source.
    if (positions.length < 2 || allSources.size < 2) continue;
    contradictions.push({
      id: randomUUID(),
      topic: c.topic.slice(0, 200),
      description: c.description.slice(0, 2000),
      positions,
      severity: c.severity,
      possibleExplanations: (c.possibleExplanations ?? []).map((x) => x.slice(0, 500)).slice(0, 5),
      topicKey: c.topicKey.slice(0, 80),
      authorityNote: authorityNote([...allSources].map((id) => sourceById.get(id)!).filter(Boolean)),
    });
  }
  return { contradictions, groupsCompared: groups.length, pairsCompared: groups.reduce((n, g) => n + g.pairCount, 0) };
}
