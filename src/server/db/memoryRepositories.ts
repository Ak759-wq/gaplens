import { randomUUID } from "node:crypto";
import type { Insert, Repositories } from "./repositories";
import type { ChecklistItemRow, ClaimRow, FindingRow, ReportRow, ResearchSessionRow, SourceRow } from "./types";

/**
 * In-memory repositories with the same semantics as the Supabase implementation (cascade deletes,
 * replace-by-type). Used by the pipeline tests; never used in production.
 */
export function createMemoryRepositories(): Repositories & { _tables: Record<string, unknown[]> } {
  const sessions: ResearchSessionRow[] = [];
  const sources: SourceRow[] = [];
  const claims: ClaimRow[] = [];
  const findings: FindingRow[] = [];
  const checklist: ChecklistItemRow[] = [];
  const reports: ReportRow[] = [];
  let tick = 0;
  const now = () => new Date(Date.UTC(2026, 0, 1) + tick++ * 1000).toISOString();
  const stamp = <T>(row: Insert<T>): T => ({ ...(row as object), id: row.id ?? randomUUID(), created_at: now() }) as unknown as T;
  const clone = <T>(x: T): T => structuredClone(x);
  const removeWhere = <T>(arr: T[], pred: (x: T) => boolean) => {
    for (let i = arr.length - 1; i >= 0; i--) if (pred(arr[i]!)) arr.splice(i, 1);
  };

  return {
    _tables: { sessions, sources, claims, findings, checklist, reports },
    sessions: {
      async create(input) {
        const row = { ...stamp<ResearchSessionRow>(input), updated_at: now() };
        sessions.push(row);
        return clone(row);
      },
      async get(id) {
        return clone(sessions.find((s) => s.id === id) ?? null);
      },
      async list() {
        return sessions
          .slice()
          .reverse()
          .map((s) => ({ ...clone(s), source_count: sources.filter((x) => x.session_id === s.id).length, finding_count: findings.filter((x) => x.session_id === s.id).length }));
      },
      async updateStatus(id, status, errorMessage = null) {
        const s = sessions.find((x) => x.id === id);
        if (s) Object.assign(s, { status, error_message: errorMessage, updated_at: now() });
      },
      async delete(id) {
        const before = sessions.length;
        removeWhere(sessions, (s) => s.id === id);
        for (const t of [sources, claims, findings, checklist, reports] as { session_id: string }[][]) removeWhere(t, (r) => r.session_id === id);
        return sessions.length < before;
      },
    },
    sources: {
      async addMany(rows) {
        const out = rows.map((r) => stamp<SourceRow>(r));
        sources.push(...out);
        return clone(out);
      },
      async get(id) {
        return clone(sources.find((s) => s.id === id) ?? null);
      },
      async listBySession(sessionId, opts = {}) {
        return clone(sources.filter((s) => s.session_id === sessionId)).map((s) => (opts.withContent ? s : { ...s, content_text: null }));
      },
      async update(id, patch) {
        const s = sources.find((x) => x.id === id);
        if (!s) throw new Error("source not found");
        Object.assign(s, patch);
        return clone(s);
      },
      async delete(id) {
        removeWhere(sources, (s) => s.id === id);
        removeWhere(claims, (c) => c.source_id === id);
      },
    },
    claims: {
      async addMany(rows) {
        const out = rows.map((r) => stamp<ClaimRow>(r));
        claims.push(...out);
        return clone(out);
      },
      async listBySession(sessionId) {
        return clone(claims.filter((c) => c.session_id === sessionId));
      },
      async listBySource(sourceId) {
        return clone(claims.filter((c) => c.source_id === sourceId));
      },
      async deleteBySource(sourceId) {
        removeWhere(claims, (c) => c.source_id === sourceId);
      },
    },
    findings: {
      async replaceType(sessionId, type, rows) {
        removeWhere(findings, (f) => f.session_id === sessionId && f.type === type);
        const out = rows.map((r) => stamp<FindingRow>(r));
        findings.push(...out);
        return clone(out);
      },
      async listBySession(sessionId, type) {
        return clone(findings.filter((f) => f.session_id === sessionId && (!type || f.type === type)));
      },
    },
    checklist: {
      async replaceForSession(sessionId, rows) {
        removeWhere(checklist, (c) => c.session_id === sessionId);
        const out = rows.map((r) => stamp<ChecklistItemRow>(r));
        checklist.push(...out);
        return clone(out).sort((a, b) => a.position - b.position);
      },
      async listBySession(sessionId) {
        return clone(checklist.filter((c) => c.session_id === sessionId)).sort((a, b) => a.position - b.position);
      },
      async setDone(sessionId, id, done) {
        const c = checklist.find((x) => x.id === id && x.session_id === sessionId);
        if (c) c.done = done;
        return !!c;
      },
    },
    reports: {
      async save(row) {
        const r = stamp<ReportRow>(row);
        reports.push(r);
        return clone(r);
      },
      async latestForSession(sessionId) {
        const list = reports.filter((r) => r.session_id === sessionId);
        return clone(list[list.length - 1] ?? null);
      },
    },
  };
}
