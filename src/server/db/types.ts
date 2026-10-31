/** Row types mirroring supabase/migrations/0001_init.sql (snake_case as stored). */

export type SessionStatus = "draft" | "extracting" | "analyzing" | "complete" | "failed";

export type ResearchSessionRow = {
  id: string;
  topic: string;
  question: string;
  objective: string;
  status: SessionStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type SourceRow = {
  id: string;
  session_id: string;
  source_type: "url" | "pdf";
  url: string | null;
  file_name: string | null;
  title: string | null;
  published_at: string | null;
  retrieved_at: string | null;
  extraction_status: "pending" | "extracting" | "extracted" | "failed";
  extraction_provider: string | null;
  extraction_error: string | null;
  content_text: string | null;
  content_sha256: string | null;
  created_at: string;
};

export type ClaimRow = {
  id: string;
  session_id: string;
  source_id: string;
  text: string;
  quote: string;
  category: "fact" | "claim" | "date_deadline" | "requirement" | "condition" | "procedure" | "evidence";
  claim_date: string | null;
  char_start: number | null;
  char_end: number | null;
  quote_verified: boolean;
  created_at: string;
};

export type FindingType = "gap" | "contradiction" | "freshness" | "question";
export type FindingLabel =
  | "verified_in_source"
  | "potential_gap"
  | "possible_contradiction"
  | "potentially_outdated"
  | "not_found_in_sources"
  | "requires_verification"
  | "ai_suggestion"
  | "info";

export type FindingRow = {
  id: string;
  session_id: string;
  type: FindingType;
  label: FindingLabel;
  severity: "high" | "medium" | "low" | null;
  title: string;
  description: string;
  /** { claim_ids: string[], ... } */
  evidence: { claim_ids: string[]; [k: string]: unknown };
  payload: Record<string, unknown>;
  created_at: string;
};

export type ChecklistItemRow = {
  id: string;
  session_id: string;
  action: string;
  priority: "high" | "medium" | "low";
  rationale: string;
  finding_ids: string[];
  done: boolean;
  position: number;
  created_at: string;
};

export type ReportRow = {
  id: string;
  session_id: string;
  model: string;
  coverage_overview: string;
  report: Record<string, unknown>;
  created_at: string;
};
