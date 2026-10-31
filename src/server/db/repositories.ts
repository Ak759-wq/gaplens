import type {
  ChecklistItemRow,
  ClaimRow,
  FindingRow,
  ReportRow,
  ResearchSessionRow,
  SessionStatus,
  SourceRow,
} from "./types";

/**
 * Repository contracts. Implementations: `supabaseRepositories.ts` (production) and
 * `memoryRepositories.ts` (tests / local dev without a database).
 */

export type Insert<T> = Omit<T, "id" | "created_at" | "updated_at"> & { id?: string };
export type SourcePatch = Partial<Omit<SourceRow, "id" | "session_id" | "created_at">>;

export type SessionListItem = ResearchSessionRow & { source_count: number; finding_count: number };

export interface ResearchSessionRepository {
  create(input: Insert<ResearchSessionRow>): Promise<ResearchSessionRow>;
  get(id: string): Promise<ResearchSessionRow | null>;
  list(opts?: { limit?: number; before?: string }): Promise<SessionListItem[]>;
  updateStatus(id: string, status: SessionStatus, errorMessage?: string | null): Promise<void>;
  delete(id: string): Promise<boolean>;
}

export interface SourceRepository {
  addMany(rows: Insert<SourceRow>[]): Promise<SourceRow[]>;
  get(id: string): Promise<SourceRow | null>;
  listBySession(sessionId: string, opts?: { withContent?: boolean }): Promise<SourceRow[]>;
  update(id: string, patch: SourcePatch): Promise<SourceRow>;
  delete(id: string): Promise<void>;
}

export interface ClaimRepository {
  addMany(rows: Insert<ClaimRow>[]): Promise<ClaimRow[]>;
  listBySession(sessionId: string): Promise<ClaimRow[]>;
  listBySource(sourceId: string): Promise<ClaimRow[]>;
  deleteBySource(sourceId: string): Promise<void>;
}

export interface FindingRepository {
  /** Replace all findings of one type for a session (stages are idempotent / re-runnable). */
  replaceType(sessionId: string, type: FindingRow["type"], rows: Insert<FindingRow>[]): Promise<FindingRow[]>;
  listBySession(sessionId: string, type?: FindingRow["type"]): Promise<FindingRow[]>;
}

export interface ChecklistRepository {
  replaceForSession(sessionId: string, rows: Insert<ChecklistItemRow>[]): Promise<ChecklistItemRow[]>;
  listBySession(sessionId: string): Promise<ChecklistItemRow[]>;
  setDone(sessionId: string, id: string, done: boolean): Promise<boolean>;
}

export interface ReportRepository {
  save(row: Insert<ReportRow>): Promise<ReportRow>;
  latestForSession(sessionId: string): Promise<ReportRow | null>;
}

export type Repositories = {
  sessions: ResearchSessionRepository;
  sources: SourceRepository;
  claims: ClaimRepository;
  findings: FindingRepository;
  checklist: ChecklistRepository;
  reports: ReportRepository;
};
