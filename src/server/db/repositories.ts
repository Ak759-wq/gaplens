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
 * Repository interfaces. Phase 1 defines the contracts only; Supabase-backed implementations
 * arrive in Phase 2 (sessions/sources/claims) and Phase 3 (findings/checklist/reports).
 */

type Insert<T> = Omit<T, "id" | "created_at" | "updated_at"> & { id?: string };

export interface ResearchSessionRepository {
  create(input: Insert<ResearchSessionRow>): Promise<ResearchSessionRow>;
  get(id: string): Promise<ResearchSessionRow | null>;
  list(opts?: { limit?: number; before?: string }): Promise<ResearchSessionRow[]>;
  updateStatus(id: string, status: SessionStatus, errorMessage?: string | null): Promise<void>;
}

export interface SourceRepository {
  addMany(rows: Insert<SourceRow>[]): Promise<SourceRow[]>;
  listBySession(sessionId: string): Promise<SourceRow[]>;
  update(id: string, patch: Partial<Omit<SourceRow, "id" | "session_id" | "created_at">>): Promise<SourceRow>;
}

export interface ClaimRepository {
  addMany(rows: Insert<ClaimRow>[]): Promise<ClaimRow[]>;
  listBySession(sessionId: string): Promise<ClaimRow[]>;
  listBySource(sourceId: string): Promise<ClaimRow[]>;
}

export interface FindingRepository {
  addMany(rows: Insert<FindingRow>[]): Promise<FindingRow[]>;
  listBySession(sessionId: string, type?: FindingRow["type"]): Promise<FindingRow[]>;
}

export interface ChecklistRepository {
  replaceForSession(sessionId: string, rows: Insert<ChecklistItemRow>[]): Promise<ChecklistItemRow[]>;
  listBySession(sessionId: string): Promise<ChecklistItemRow[]>;
  setDone(id: string, done: boolean): Promise<void>;
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
