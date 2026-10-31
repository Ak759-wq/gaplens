/**
 * Serializable view of a research session sent to the browser (no raw source text, no secrets).
 * Shared by the API, server components and client components.
 */
import type { ChecklistItem, Claim, Contradiction, FreshnessWarning, Gap, Question, TopicCoverage } from "@/server/ai/schemas";

export type SessionStatus = "draft" | "extracting" | "analyzing" | "complete" | "failed";

export type SourceView = {
  id: string;
  /** Stable short label (S1, S2…) used across the dashboard and report. */
  alias: string;
  type: "url" | "pdf";
  url: string | null;
  fileName: string | null;
  title: string | null;
  publishedAt: string | null;
  modifiedAt: string | null;
  dateEvidence: string[];
  retrievedAt: string | null;
  status: "pending" | "extracting" | "extracted" | "failed";
  provider: string | null;
  error: string | null;
  charCount: number | null;
  warnings: string[];
  official: boolean;
  claimsStatus: { status: "pending" | "done" | "failed"; chunksDone: number; chunksTotal: number; rejected: number } | null;
};

export type QuoteContext = { before: string; match: string; after: string };

export type ClaimView = Claim & { context: QuoteContext | null };

/** Evidence context keyed by `${sourceId}:${quote}` for rule-based evidence without a claim. */
export type EvidenceContextMap = Record<string, QuoteContext>;

export type FindingMeta = { findingId: string; label: string; severity: "high" | "medium" | "low" | null };

export type SessionView = {
  session: {
    id: string;
    topic: string;
    question: string;
    objective: string;
    status: SessionStatus;
    errorMessage: string | null;
    createdAt: string;
    updatedAt: string;
  };
  sources: SourceView[];
  claims: ClaimView[];
  coverage: TopicCoverage[];
  gaps: Gap[];
  contradictions: Contradiction[];
  freshness: FreshnessWarning[];
  questions: Question[];
  checklist: (ChecklistItem & { done: boolean })[];
  evidenceContext: EvidenceContextMap;
  report: { generatedAt: string; model: string; coverageOverview: string; limitations: string[] } | null;
  stages: { gaps: boolean; contradictions: boolean; freshness: boolean; questions: boolean; checklist: boolean; report: boolean };
};

export const evidenceKey = (sourceId: string, quote: string) => `${sourceId}:${quote.slice(0, 120)}`;
