import "server-only";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { Insert, Repositories, SessionListItem, SourcePatch } from "./repositories";
import { getSupabaseAdmin } from "./supabase";
import type { ChecklistItemRow, ClaimRow, FindingRow, ReportRow, ResearchSessionRow, SourceRow } from "./types";

export class DbError extends Error {
  readonly code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "DbError";
    this.code = code;
  }
}

function fail(op: string, e: PostgrestError): never {
  if (e.code === "PGRST205" || e.code === "42P01") {
    throw new DbError(`Database tables are missing. Apply supabase/migrations/0001_init.sql (${op}).`, e.code);
  }
  throw new DbError(`Database error during ${op}: ${e.message}`, e.code);
}

const SOURCE_COLUMNS_NO_CONTENT =
  "id,session_id,source_type,url,file_name,title,published_at,retrieved_at,extraction_status,extraction_provider,extraction_error,content_sha256,created_at";
const ALLOWED_PROVIDERS_0001 = new Set(["firecrawl", "jina", "pdf-parse"]);

/**
 * Migration 0002 adds sources.metadata and allows extraction_provider = 'direct'. Until it is applied
 * we degrade gracefully: metadata is dropped and 'direct' is stored as NULL (it is still reported in
 * the API response for the current request).
 */
let has0002: boolean | undefined;

function stripFor0001<T extends Record<string, unknown>>(row: T): T {
  const copy: Record<string, unknown> = { ...row };
  delete copy.metadata;
  if (typeof copy.extraction_provider === "string" && !ALLOWED_PROVIDERS_0001.has(copy.extraction_provider)) {
    copy.extraction_provider = null;
  }
  return copy as T;
}

function is0002Missing(e: PostgrestError): boolean {
  return (e.code === "PGRST204" && /metadata/.test(e.message)) || (e.code === "23514" && /extraction_provider/.test(e.message)) || (e.code === "42703" && /metadata/.test(e.message));
}

export function createSupabaseRepositories(db: SupabaseClient = getSupabaseAdmin()): Repositories {
  const sourceSelect = (withContent: boolean) => {
    if (has0002 === false) return withContent ? "*" : SOURCE_COLUMNS_NO_CONTENT;
    if (withContent) return "*";
    return `${SOURCE_COLUMNS_NO_CONTENT},metadata`;
  };

  type Payload = Record<string, unknown> | Record<string, unknown>[];
  const strip = (p: Payload): Payload => (Array.isArray(p) ? p.map((r) => stripFor0001(r)) : stripFor0001(p));
  async function writeSource<T>(op: string, run: (row: Payload) => PromiseLike<{ data: unknown; error: PostgrestError | null }>, row: Payload): Promise<T> {
    const first = await run(has0002 === false ? strip(row) : row);
    if (!first.error) return first.data as T;
    if (is0002Missing(first.error)) {
      has0002 = false;
      const second = await run(strip(row));
      if (!second.error) return second.data as T;
      fail(op, second.error);
    }
    fail(op, first.error);
  }

  return {
    sessions: {
      async create(input) {
        const { data, error } = await db.from("research_sessions").insert(input).select().single();
        if (error) fail("create session", error);
        return data as ResearchSessionRow;
      },
      async get(id) {
        const { data, error } = await db.from("research_sessions").select().eq("id", id).maybeSingle();
        if (error) fail("get session", error);
        return (data as ResearchSessionRow) ?? null;
      },
      async list(opts = {}) {
        let q = db
          .from("research_sessions")
          .select("*, sources(count), findings(count)")
          .order("created_at", { ascending: false })
          .limit(Math.min(opts.limit ?? 50, 200));
        if (opts.before) q = q.lt("created_at", opts.before);
        const { data, error } = await q;
        if (error) fail("list sessions", error);
        return (data ?? []).map((r) => {
          const { sources, findings, ...rest } = r as ResearchSessionRow & { sources: { count: number }[]; findings: { count: number }[] };
          return { ...rest, source_count: sources?.[0]?.count ?? 0, finding_count: findings?.[0]?.count ?? 0 } satisfies SessionListItem;
        });
      },
      async updateStatus(id, status, errorMessage = null) {
        const { error } = await db.from("research_sessions").update({ status, error_message: errorMessage }).eq("id", id);
        if (error) fail("update session status", error);
      },
      async delete(id) {
        const { data, error } = await db.from("research_sessions").delete().eq("id", id).select("id");
        if (error) fail("delete session", error);
        return (data ?? []).length > 0;
      },
    },
    sources: {
      async addMany(rows) {
        if (rows.length === 0) return [];
        return writeSource<SourceRow[]>("add sources", (r) => db.from("sources").insert(r as Insert<SourceRow>[]).select(), rows as unknown as Record<string, unknown>[]);
      },
      async get(id) {
        const { data, error } = await db.from("sources").select("*").eq("id", id).maybeSingle();
        if (error) fail("get source", error);
        return (data as SourceRow) ?? null;
      },
      async listBySession(sessionId, opts = {}) {
        const run = async () => db.from("sources").select(sourceSelect(!!opts.withContent)).eq("session_id", sessionId).order("created_at", { ascending: true });
        let { data, error } = await run();
        if (error && is0002Missing(error)) {
          has0002 = false;
          ({ data, error } = await run());
        }
        if (error) fail("list sources", error);
        return (data ?? []) as unknown as SourceRow[];
      },
      async update(id, patch: SourcePatch) {
        return writeSource<SourceRow>("update source", (r) => db.from("sources").update(r as Record<string, unknown>).eq("id", id).select().single(), patch as Record<string, unknown>);
      },
      async delete(id) {
        const { error } = await db.from("sources").delete().eq("id", id);
        if (error) fail("delete source", error);
      },
    },
    claims: {
      async addMany(rows) {
        if (rows.length === 0) return [];
        const out: ClaimRow[] = [];
        for (let i = 0; i < rows.length; i += 500) {
          const { data, error } = await db.from("claims").insert(rows.slice(i, i + 500)).select();
          if (error) fail("add claims", error);
          out.push(...((data ?? []) as ClaimRow[]));
        }
        return out;
      },
      async listBySession(sessionId) {
        const { data, error } = await db.from("claims").select().eq("session_id", sessionId).order("created_at", { ascending: true }).limit(5000);
        if (error) fail("list claims", error);
        return (data ?? []) as ClaimRow[];
      },
      async listBySource(sourceId) {
        const { data, error } = await db.from("claims").select().eq("source_id", sourceId).order("created_at", { ascending: true });
        if (error) fail("list claims by source", error);
        return (data ?? []) as ClaimRow[];
      },
      async deleteBySource(sourceId) {
        const { error } = await db.from("claims").delete().eq("source_id", sourceId);
        if (error) fail("delete claims", error);
      },
    },
    findings: {
      async replaceType(sessionId, type, rows) {
        const del = await db.from("findings").delete().eq("session_id", sessionId).eq("type", type);
        if (del.error) fail("clear findings", del.error);
        if (rows.length === 0) return [];
        const { data, error } = await db.from("findings").insert(rows).select();
        if (error) fail("add findings", error);
        return (data ?? []) as FindingRow[];
      },
      async listBySession(sessionId, type) {
        let q = db.from("findings").select().eq("session_id", sessionId).order("created_at", { ascending: true });
        if (type) q = q.eq("type", type);
        const { data, error } = await q;
        if (error) fail("list findings", error);
        return (data ?? []) as FindingRow[];
      },
    },
    checklist: {
      async replaceForSession(sessionId, rows) {
        const del = await db.from("checklist_items").delete().eq("session_id", sessionId);
        if (del.error) fail("clear checklist", del.error);
        if (rows.length === 0) return [];
        const { data, error } = await db.from("checklist_items").insert(rows).select();
        if (error) fail("add checklist", error);
        return ((data ?? []) as ChecklistItemRow[]).sort((a, b) => a.position - b.position);
      },
      async listBySession(sessionId) {
        const { data, error } = await db.from("checklist_items").select().eq("session_id", sessionId).order("position", { ascending: true });
        if (error) fail("list checklist", error);
        return (data ?? []) as ChecklistItemRow[];
      },
      async setDone(sessionId, id, done) {
        const { data, error } = await db.from("checklist_items").update({ done }).eq("id", id).eq("session_id", sessionId).select("id");
        if (error) fail("update checklist item", error);
        return (data ?? []).length > 0;
      },
    },
    reports: {
      async save(row) {
        const { data, error } = await db.from("reports").insert(row).select().single();
        if (error) fail("save report", error);
        return data as ReportRow;
      },
      async latestForSession(sessionId) {
        const { data, error } = await db.from("reports").select().eq("session_id", sessionId).order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (error) fail("get report", error);
        return (data as ReportRow) ?? null;
      },
    },
  };
}
