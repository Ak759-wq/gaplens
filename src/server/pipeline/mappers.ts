import type { ChecklistItem, Claim, Contradiction, FreshnessWarning, Gap, Question, Source, TopicCoverage } from "@/server/ai/schemas";
import type { Insert } from "@/server/db/repositories";
import type { ChecklistItemRow, ClaimRow, FindingRow, SourceRow } from "@/server/db/types";

/** DB row ⇄ domain object mapping. Findings keep the full typed object in `payload`. */

export function rowToSource(r: SourceRow): Source {
  return {
    id: r.id,
    sourceType: r.source_type,
    url: r.url,
    fileName: r.file_name,
    title: r.title,
    publishedAt: r.published_at,
    retrievedAt: r.retrieved_at,
    extractionStatus: r.extraction_status,
    contentText: r.content_text,
    modifiedAt: r.metadata?.modifiedAt ?? null,
    dateEvidence: r.metadata?.dateEvidence ?? [],
    provider: r.metadata?.provider ?? r.extraction_provider,
    extractionError: r.extraction_error,
  };
}

export function rowToClaim(r: ClaimRow): Claim {
  return {
    id: r.id,
    sourceId: r.source_id,
    text: r.text,
    quote: r.quote,
    category: r.category,
    ...(r.claim_date ? { date: r.claim_date } : {}),
    ...(r.char_start != null ? { charStart: r.char_start } : {}),
    ...(r.char_end != null ? { charEnd: r.char_end } : {}),
  };
}

export function claimToRow(sessionId: string, c: Claim): Insert<ClaimRow> {
  return {
    id: c.id,
    session_id: sessionId,
    source_id: c.sourceId,
    text: c.text,
    quote: c.quote,
    category: c.category,
    claim_date: c.date ? c.date.slice(0, 10) : null,
    char_start: c.charStart ?? null,
    char_end: c.charEnd ?? null,
    quote_verified: true,
  };
}

const claimIdsOf = (ev: { claimId?: string | null }[]) => [...new Set(ev.map((e) => e.claimId).filter((x): x is string => !!x))];

export type TopicPayload = { kind: "topic"; topic: TopicCoverage; gap: Gap | null };

export function topicToRow(sessionId: string, topic: TopicCoverage, gap: Gap | null): Insert<FindingRow> {
  return {
    id: topic.id,
    session_id: sessionId,
    type: "gap",
    label: topic.status === "covered" ? "verified_in_source" : topic.status === "partial" ? "potential_gap" : "not_found_in_sources",
    severity: gap?.severity ?? null,
    title: topic.label,
    description: gap?.description ?? topic.whyItMatters,
    evidence: { claim_ids: topic.claimIds },
    payload: { kind: "topic", topic, gap } satisfies TopicPayload,
  };
}

export function contradictionToRow(sessionId: string, c: Contradiction): Insert<FindingRow> {
  return {
    id: c.id,
    session_id: sessionId,
    type: "contradiction",
    label: c.kind === "cycle_mismatch" ? "potentially_outdated" : "possible_contradiction",
    severity: c.severity,
    title: c.topic,
    description: c.description,
    evidence: { claim_ids: claimIdsOf(c.positions.flatMap((p) => p.evidence)) },
    payload: { kind: "contradiction", contradiction: c },
  };
}

export function freshnessToRow(sessionId: string, f: FreshnessWarning): Insert<FindingRow> {
  return {
    id: f.id,
    session_id: sessionId,
    type: "freshness",
    label: f.reason === "undated" ? "requires_verification" : "potentially_outdated",
    severity: f.severity ?? null,
    title: f.reason,
    description: f.description,
    evidence: { claim_ids: claimIdsOf(f.evidence) },
    payload: { kind: "freshness", warning: f },
  };
}

export function questionToRow(sessionId: string, q: Question): Insert<FindingRow> {
  return {
    id: q.id,
    session_id: sessionId,
    type: "question",
    label: "ai_suggestion",
    severity: null,
    title: q.question.slice(0, 500),
    description: q.whyItMatters,
    evidence: { claim_ids: [], finding_ids: q.relatedFindingIds },
    payload: { kind: "question", question: q },
  };
}

export function checklistToRow(sessionId: string, c: ChecklistItem, position: number): Insert<ChecklistItemRow> {
  return { id: c.id, session_id: sessionId, action: c.action, priority: c.priority, rationale: c.rationale, finding_ids: c.findingIds, done: false, position };
}

export type DecodedFindings = {
  coverage: TopicCoverage[];
  gaps: Gap[];
  contradictions: Contradiction[];
  freshness: FreshnessWarning[];
  questions: Question[];
};

/** Decode persisted findings back into typed objects (rows with unknown payloads are skipped). */
export function decodeFindings(rows: FindingRow[]): DecodedFindings {
  const out: DecodedFindings = { coverage: [], gaps: [], contradictions: [], freshness: [], questions: [] };
  for (const r of rows) {
    const p = r.payload as Record<string, unknown>;
    if (r.type === "gap" && p.kind === "topic") {
      const tp = p as unknown as TopicPayload;
      out.coverage.push(tp.topic);
      if (tp.gap) out.gaps.push(tp.gap);
    } else if (r.type === "contradiction" && p.kind === "contradiction") out.contradictions.push(p.contradiction as Contradiction);
    else if (r.type === "freshness" && p.kind === "freshness") out.freshness.push(p.warning as FreshnessWarning);
    else if (r.type === "question" && p.kind === "question") out.questions.push(p.question as Question);
  }
  return out;
}

export function rowToChecklist(r: ChecklistItemRow): ChecklistItem & { done: boolean } {
  return { id: r.id, action: r.action, priority: r.priority, rationale: r.rationale, findingIds: r.finding_ids, done: r.done };
}
