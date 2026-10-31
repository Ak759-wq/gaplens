"use client";

import { useMemo, useState } from "react";
import { AlertCircle, ExternalLink, Sparkles } from "lucide-react";
import { EvidenceItem, HighlightedQuote, SeverityPill, SourceChip, originalLink, sourceDateText, sourceLabel } from "@/components/evidence/evidence";
import { FindingBadge } from "@/components/evidence/finding-badge";
import { FINDING_LABELS } from "@/components/evidence/finding-labels";
import { formatDate } from "@/lib/dates";
import { CATEGORY_TEXT, FRESHNESS_REASON_TEXT } from "@/lib/report-markdown";
import { cn } from "@/lib/utils";
import type { SessionView } from "@/lib/view-types";
import { EmptyState } from "./empty-state";
import { CircleDashed, Clock, FileStack, GitCompareArrows, HelpCircle, ListChecks, Quote } from "lucide-react";

const RANK = { high: 0, medium: 1, low: 2 } as const;
const bySeverity = <T extends { severity?: "high" | "medium" | "low" | null }>(a: T, b: T) => RANK[a.severity ?? "low"] - RANK[b.severity ?? "low"];

function Card({ children, className, accent }: { children: React.ReactNode; className?: string; accent?: string }) {
  return <article className={cn("space-y-3 rounded-xl border bg-card p-4 shadow-xs sm:p-5", accent && `border-l-4 ${accent}`, className)}>{children}</article>;
}

function WhyDetected({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
      <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span>
        <span className="font-medium text-foreground">Why this was flagged: </span>
        {children}
      </span>
    </p>
  );
}

/** Lookup of every finding id → display title + kind (questions/checklist link back to findings). */
export function useFindingIndex(view: SessionView) {
  return useMemo(() => {
    const m = new Map<string, { title: string; kind: "gap" | "contradiction" | "outdated" | "ai_suggestion" | "requires_verification" }>();
    view.gaps.forEach((g) => m.set(g.id, { title: g.title, kind: "gap" }));
    view.contradictions.forEach((c) => m.set(c.id, { title: c.topic, kind: "contradiction" }));
    view.freshness.forEach((f) => {
      const s = view.sources.find((x) => x.id === f.sourceId);
      m.set(f.id, { title: `${FRESHNESS_REASON_TEXT[f.reason] ?? f.reason}: ${s?.alias ?? ""}`, kind: f.reason === "undated" ? "requires_verification" : "outdated" });
    });
    view.questions.forEach((q) => m.set(q.id, { title: q.question, kind: "ai_suggestion" }));
    return m;
  }, [view]);
}

function LinkedFindings({ ids, view }: { ids: string[]; view: SessionView }) {
  const idx = useFindingIndex(view);
  const items = ids.map((id) => ({ id, f: idx.get(id) })).filter((x) => x.f);
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-muted-foreground">Linked findings:</span>
      {items.map(({ id, f }) => (
        <span key={id} className={cn("max-w-[22rem] truncate rounded-full border px-2 py-0.5", FINDING_LABELS[f!.kind === "outdated" ? "outdated" : f!.kind].className)}>
          {f!.title}
        </span>
      ))}
    </div>
  );
}

/* ---------------------------------- Overview --------------------------------- */

export function OverviewPanel({ view, onJump }: { view: SessionView; onJump: (tab: string) => void }) {
  const extracted = view.sources.filter((s) => s.status === "extracted").length;
  const done = view.checklist.filter((c) => c.done).length;
  const datedWarnings = view.freshness.filter((f) => f.reason !== "undated").length;
  const stats = [
    { label: "Sources read", value: `${extracted}/${view.sources.length}`, tab: "sources", kind: "info" as const },
    { label: "Verified claims", value: view.claims.length, tab: "extracted", kind: "verified" as const },
    { label: "Information gaps", value: view.gaps.length, tab: "gaps", kind: "gap" as const },
    { label: "Possible contradictions", value: view.contradictions.length, tab: "contradictions", kind: "contradiction" as const },
    { label: "Freshness warnings", value: datedWarnings, tab: "freshness", kind: "outdated" as const },
    { label: "Unanswered questions", value: view.questions.length, tab: "questions", kind: "ai_suggestion" as const },
    { label: "Checklist done", value: `${done}/${view.checklist.length}`, tab: "checklist", kind: "requires_verification" as const },
  ];
  const counts = { covered: 0, partial: 0, missing: 0 };
  view.coverage.forEach((t) => counts[t.status]++);
  const total = view.coverage.length || 1;

  return (
    <div className="space-y-6">
      {view.report?.coverageOverview && (
        <p className="rounded-xl border border-sky-200 bg-sky-50/60 p-4 text-sm leading-relaxed text-sky-900">{view.report.coverageOverview}</p>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {stats.map((s) => (
          <button key={s.label} type="button" onClick={() => onJump(s.tab)} className="rounded-xl border bg-card p-3 text-left shadow-xs transition hover:border-brand/40 hover:shadow-sm">
            <span className={cn("mb-2 block h-1 w-8 rounded-full", FINDING_LABELS[s.kind].dotClassName)} aria-hidden="true" />
            <span className="block text-2xl font-semibold tabular-nums">{s.value}</span>
            <span className="text-xs text-muted-foreground">{s.label}</span>
          </button>
        ))}
      </div>

      <section className="space-y-3 rounded-xl border bg-card p-4 sm:p-5" aria-labelledby="coverage-h">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="coverage-h" className="font-medium">Coverage of what your question needs</h3>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-emerald-500" /> Covered {counts.covered}</span>
            <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-orange-500" /> Partial {counts.partial}</span>
            <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-zinc-400" /> Not found {counts.missing}</span>
          </div>
        </div>
        {view.coverage.length === 0 ? (
          <p className="text-sm text-muted-foreground">Topic coverage appears after gap detection runs (needs an AI key).</p>
        ) : (
          <>
            <div className="flex h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${counts.covered} covered, ${counts.partial} partial, ${counts.missing} not found`}>
              <div className="bg-emerald-500" style={{ width: `${(counts.covered / total) * 100}%` }} />
              <div className="bg-orange-500" style={{ width: `${(counts.partial / total) * 100}%` }} />
              <div className="bg-zinc-400" style={{ width: `${(counts.missing / total) * 100}%` }} />
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {view.coverage.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
                  <span className="min-w-0 truncate" title={t.whyItMatters}>{t.label}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-muted-foreground">{t.sourceIds.length} src</span>
                    <FindingBadge kind={t.status === "covered" ? "verified" : t.status === "partial" ? "gap" : "not_found"} label={t.status === "covered" ? "Covered" : t.status === "partial" ? "Partial" : "Not found"} className="py-0 text-[11px]" />
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

/* ------------------------------ Extracted claims ------------------------------ */

export function ExtractedPanel({ view }: { view: SessionView }) {
  const [only, setOnly] = useState<string | null>(null);
  if (view.claims.length === 0) {
    return <EmptyState icon={Quote} title="No verified claims" description="Claims appear after AI claim extraction. Only claims whose quote is found verbatim in the source text are kept." />;
  }
  const claims = only ? view.claims.filter((c) => c.sourceId === only) : view.claims;
  const groups = new Map<string, typeof claims>();
  claims.forEach((c) => groups.set(c.category, [...(groups.get(c.category) ?? []), c]));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Filter by source:</span>
        <button type="button" onClick={() => setOnly(null)} className={cn("rounded-full border px-2.5 py-1", !only && "border-brand bg-brand-soft")}>All ({view.claims.length})</button>
        {view.sources.filter((s) => view.claims.some((c) => c.sourceId === s.id)).map((s) => (
          <button key={s.id} type="button" onClick={() => setOnly(s.id)} className={cn("max-w-[16rem] truncate rounded-full border px-2.5 py-1", only === s.id && "border-brand bg-brand-soft")}>
            {s.alias} · {sourceLabel(s)} ({view.claims.filter((c) => c.sourceId === s.id).length})
          </button>
        ))}
      </div>
      {[...groups].map(([cat, list]) => (
        <section key={cat} className="space-y-3">
          <h3 className="font-medium">{CATEGORY_TEXT[cat] ?? cat} <span className="text-sm font-normal text-muted-foreground">({list.length})</span></h3>
          <div className="grid gap-3 lg:grid-cols-2">
            {list.map((c) => (
              <Card key={c.id} accent="border-l-emerald-400">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium">{c.text}</p>
                  {c.date && <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{c.date.slice(0, 10)}</span>}
                </div>
                <EvidenceItem evidence={{ claimId: c.id, sourceId: c.sourceId, quote: c.quote }} view={view} />
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ----------------------------------- Gaps ------------------------------------ */

export function GapsPanel({ view }: { view: SessionView }) {
  if (view.gaps.length === 0) {
    return (
      <EmptyState
        icon={CircleDashed}
        title={view.coverage.length ? "No gaps found" : "Gap detection hasn't run"}
        description={view.coverage.length ? "Every topic the question needs was covered by at least one reviewed source." : "Information your question needs that the reviewed sources don't state. Requires an AI key."}
      />
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">“Not found in the reviewed sources” means exactly that: it may still exist elsewhere.</p>
      {[...view.gaps].sort(bySeverity).map((g) => (
        <Card key={g.id} accent={g.label === "not_found_in_sources" ? "border-l-zinc-400" : "border-l-orange-400"}>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">{g.title}</h3>
            <FindingBadge kind={g.label === "not_found_in_sources" ? "not_found" : "gap"} />
            <SeverityPill severity={g.severity} />
          </div>
          <p className="text-sm"><span className="font-medium">Missing: </span>{g.missingInformation}</p>
          {g.whyItMatters && <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">Why it matters: </span>{g.whyItMatters}</p>}
          {g.whatToInvestigate && (
            <div className="rounded-md border border-violet-200 bg-violet-50/60 p-3 text-sm text-violet-900">
              <FindingBadge kind="ai_suggestion" label="AI suggestion: what to investigate" className="mb-1.5" />
              <p>{g.whatToInvestigate}</p>
            </div>
          )}
          <WhyDetected>
            {g.label === "not_found_in_sources"
              ? "the question needs this topic and no verified claim from any reviewed source addresses it."
              : "related claims exist (below) but they leave part of this topic open."}
          </WhyDetected>
          {g.evidence.length > 0 && (
            <div className="space-y-3 border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground">What the sources do say</p>
              {g.evidence.slice(0, 4).map((e, i) => <EvidenceItem key={i} evidence={e} view={view} />)}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

/* ------------------------------- Contradictions ------------------------------- */

export function ContradictionsPanel({ view }: { view: SessionView }) {
  if (view.contradictions.length === 0) {
    return (
      <EmptyState
        icon={GitCompareArrows}
        title={view.stages.contradictions ? "No contradictions detected" : "Contradiction check hasn't run"}
        description="Claims on the same topic from different sources are compared. GapLens shows both sides and never picks a winner arbitrarily."
      />
    );
  }
  return (
    <div className="space-y-4">
      {[...view.contradictions].sort(bySeverity).map((c) => (
        <Card key={c.id} accent="border-l-red-400">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">{c.topic}</h3>
            <FindingBadge kind="contradiction" />
            <SeverityPill severity={c.severity} />
          </div>
          <p className="text-sm">{c.description}</p>
          <div className={cn("grid gap-3", c.positions.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3")}>
            {c.positions.map((p, i) => (
              <div key={i} className="space-y-2 rounded-lg border border-red-100 bg-red-50/30 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Position {String.fromCharCode(65 + i)}</p>
                <p className="text-sm font-medium">{p.statement}</p>
                {p.evidence.slice(0, 3).map((e, j) => <EvidenceItem key={j} evidence={e} view={view} />)}
              </div>
            ))}
          </div>
          <WhyDetected>these claims are about the same topic, come from different sources, and cannot all be true as stated.</WhyDetected>
          {c.possibleExplanations.length > 0 && (
            <div className="rounded-md border border-violet-200 bg-violet-50/60 p-3 text-sm text-violet-900">
              <FindingBadge kind="ai_suggestion" label="AI suggestion: possible explanations" className="mb-1.5" />
              <ul className="list-disc space-y-0.5 pl-5">{c.possibleExplanations.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
          )}
          {c.authorityNote && (
            <div className="rounded-md border border-sky-200 bg-sky-50/60 p-3 text-sm text-sky-900">
              <FindingBadge kind="info" label="Authority signals" className="mb-1.5" />
              <p>{c.authorityNote}</p>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

/* --------------------------------- Freshness --------------------------------- */

export function FreshnessPanel({ view }: { view: SessionView }) {
  if (view.freshness.length === 0) {
    return <EmptyState icon={Clock} title={view.stages.freshness ? "No freshness warnings" : "Freshness check hasn't run"} description="Sources tied to old dates, past cycles or passed deadlines are flagged here. Undated sources are labelled undated, not outdated." />;
  }
  const dated = view.freshness.filter((f) => f.reason !== "undated").sort(bySeverity);
  const undated = view.freshness.filter((f) => f.reason === "undated");
  const block = (f: SessionView["freshness"][number]) => {
    const s = view.sources.find((x) => x.id === f.sourceId);
    return (
      <Card key={f.id} accent={f.reason === "undated" ? "border-l-slate-400" : "border-l-amber-400"}>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-medium">{FRESHNESS_REASON_TEXT[f.reason] ?? f.reason}</h3>
          <FindingBadge kind={f.reason === "undated" ? "requires_verification" : "outdated"} />
          <SeverityPill severity={f.severity} />
          {f.origin === "ai" ? <FindingBadge kind="ai_suggestion" label="AI-assisted" /> : <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">Rule-based check</span>}
        </div>
        <SourceChip source={s} />
        <WhyDetected>{f.description}</WhyDetected>
        {f.evidence.map((e, i) => <EvidenceItem key={i} evidence={e} view={view} />)}
      </Card>
    );
  };
  return (
    <div className="space-y-6">
      {dated.length > 0 && <div className="space-y-3"><h3 className="text-sm font-medium">Potentially outdated ({dated.length})</h3>{dated.map(block)}</div>}
      {undated.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Undated sources ({undated.length})</h3>
          <p className="text-xs text-muted-foreground">Undated is not the same as outdated: these simply state no date, so their currency needs checking.</p>
          {undated.map(block)}
        </div>
      )}
    </div>
  );
}

/* --------------------------------- Questions --------------------------------- */

export function QuestionsPanel({ view }: { view: SessionView }) {
  if (view.questions.length === 0) {
    return <EmptyState icon={HelpCircle} title={view.stages.questions ? "No open questions" : "Questions haven't been generated"} description="Concrete questions the sources leave open, each tied to the findings that raised it. Requires an AI key." />;
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">These are AI suggestions for what to ask next. They differ from gaps, which record information confirmed missing from the reviewed sources.</p>
      {view.questions.map((q, i) => (
        <Card key={q.id} accent="border-l-violet-400">
          <div className="flex flex-wrap items-start gap-2">
            <span className="font-mono text-xs text-violet-700">Q{i + 1}</span>
            <h3 className="flex-1 font-medium">{q.question}</h3>
            <FindingBadge kind="ai_suggestion" />
          </div>
          <p className="text-sm text-muted-foreground">{q.whyItMatters}</p>
          {q.suggestedSourceType && <p className="text-xs"><span className="font-medium">Where to look: </span>{q.suggestedSourceType}</p>}
          <LinkedFindings ids={q.relatedFindingIds} view={view} />
        </Card>
      ))}
    </div>
  );
}

/* --------------------------------- Checklist --------------------------------- */

export function ChecklistPanel({ view, onToggle }: { view: SessionView; onToggle: (id: string, done: boolean) => Promise<void> }) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (view.checklist.length === 0) {
    return <EmptyState icon={ListChecks} title={view.stages.checklist ? "Nothing to verify" : "Checklist hasn't been generated"} description="A prioritised (high / medium / low) list of what to confirm, with the reason and linked findings for each item. Requires an AI key." />;
  }
  const done = view.checklist.filter((c) => c.done).length;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-emerald-500 transition-all" style={{ width: `${(done / view.checklist.length) * 100}%` }} /></div>
        <span className="text-xs tabular-nums text-muted-foreground">{done}/{view.checklist.length} verified</span>
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      {(["high", "medium", "low"] as const).map((p) => {
        const items = view.checklist.filter((c) => c.priority === p);
        if (!items.length) return null;
        return (
          <section key={p} className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-medium"><SeverityPill severity={p} /> {p === "high" ? "Could change the answer" : p === "medium" ? "Affects preparation" : "Good to confirm"}</h3>
            <ul className="space-y-2">
              {items.map((c) => (
                <li key={c.id} className={cn("rounded-xl border bg-card p-4", c.done && "opacity-70")}>
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 size-4 accent-emerald-600"
                      checked={c.done}
                      disabled={pending === c.id}
                      onChange={async (e) => {
                        setPending(c.id);
                        setError(null);
                        try {
                          await onToggle(c.id, e.target.checked);
                        } catch {
                          setError("Couldn't save that change. Try again.");
                        } finally {
                          setPending(null);
                        }
                      }}
                    />
                    <span className="min-w-0 space-y-1.5">
                      <span className={cn("block text-sm font-medium", c.done && "line-through")}>{c.action}</span>
                      <span className="block text-xs text-muted-foreground"><span className="font-medium text-foreground">Why: </span>{c.rationale}</span>
                    </span>
                  </label>
                  <div className="mt-2 pl-7"><LinkedFindings ids={c.findingIds} view={view} /></div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Sparkles className="size-3.5" /> Checklist items are AI suggestions built from the findings above; ticks are saved.</p>
    </div>
  );
}

/* ---------------------------------- Sources ---------------------------------- */

export function SourcesPanel({ view }: { view: SessionView }) {
  if (view.sources.length === 0) return <EmptyState icon={FileStack} title="No sources" description="This session has no sources." />;
  return (
    <div className="space-y-3">
      {view.sources.map((s) => {
        const claims = view.claims.filter((c) => c.sourceId === s.id);
        return (
          <Card key={s.id} accent={s.status === "failed" ? "border-l-red-400" : s.status === "extracted" ? "border-l-sky-400" : "border-l-zinc-300"}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-mono text-xs text-brand">{s.alias} · {s.type.toUpperCase()}{s.official ? " · official domain" : ""}</p>
                <h3 className="font-medium">{s.title ?? <span className="text-muted-foreground">No title found in source</span>}</h3>
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex max-w-full items-center gap-1 truncate text-xs text-brand hover:underline">{s.url} <ExternalLink className="size-3 shrink-0" /></a>
                ) : (
                  <p className="text-xs text-muted-foreground">{s.fileName} (uploaded PDF; only its extracted text is stored)</p>
                )}
              </div>
              <StatusPill status={s.status} />
            </div>
            <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2 lg:grid-cols-4">
              <div><dt className="text-muted-foreground">Date</dt><dd>{sourceDateText(s)}</dd></div>
              <div><dt className="text-muted-foreground">Retrieved</dt><dd>{formatDate(s.retrievedAt)}</dd></div>
              <div><dt className="text-muted-foreground">Extracted via</dt><dd>{s.provider ?? "—"}{s.charCount ? ` · ${s.charCount.toLocaleString("en-IN")} chars` : ""}</dd></div>
              <div><dt className="text-muted-foreground">Verified claims</dt><dd>{claims.length}{s.claimsStatus?.rejected ? ` (${s.claimsStatus.rejected} unverifiable discarded)` : ""}</dd></div>
            </dl>
            {s.dateEvidence.length > 0 && <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Date source: </span>{s.dateEvidence.join("; ")}</p>}
            {s.error && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-800">{s.error}</p>}
            {s.warnings.length > 0 && <ul className="list-disc space-y-0.5 pl-5 text-xs text-amber-800">{s.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
            {claims.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-xs font-medium text-brand">Quotes cited from this source ({claims.length})</summary>
                <div className="mt-3 space-y-2">
                  {claims.map((c) => (
                    <div key={c.id} className="space-y-1">
                      <HighlightedQuote context={c.context} quote={c.quote} />
                      {s.url && <a className="text-xs text-brand hover:underline" href={originalLink(s.url, c.quote)} target="_blank" rel="noopener noreferrer nofollow">Open at this passage</a>}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </Card>
        );
      })}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    extracted: "bg-emerald-50 text-emerald-800 border-emerald-200",
    failed: "bg-red-50 text-red-800 border-red-200",
    extracting: "bg-sky-50 text-sky-800 border-sky-200",
    pending: "bg-muted text-muted-foreground",
  };
  const text: Record<string, string> = { extracted: "Extracted", failed: "Failed", extracting: "Extracting…", pending: "Pending" };
  return <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-xs", map[status] ?? map.pending)}>{text[status] ?? status}</span>;
}
