"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Circle, Loader2, Play, RotateCcw, Settings2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch, ApiClientError } from "@/lib/client/api";
import { loadByoSettings } from "@/lib/client/llm-settings";
import { cn } from "@/lib/utils";
import type { SessionView, SourceView } from "@/lib/view-types";

type StepStatus = "idle" | "running" | "done" | "failed" | "config" | "skipped";
type StepKey = "extract" | "claims" | "gaps" | "contradictions" | "freshness" | "questions" | "checklist" | "report";
type Step = { key: StepKey; label: string; status: StepStatus; detail?: string };

const STEPS: { key: StepKey; label: string; ai: boolean }[] = [
  { key: "extract", label: "Read sources", ai: false },
  { key: "claims", label: "Extract & verify claims", ai: true },
  { key: "gaps", label: "Detect information gaps", ai: true },
  { key: "contradictions", label: "Compare sources for contradictions", ai: true },
  { key: "freshness", label: "Check freshness (rules + AI)", ai: false },
  { key: "questions", label: "List unanswered questions", ai: true },
  { key: "checklist", label: "Build verification checklist", ai: true },
  { key: "report", label: "Assemble report", ai: false },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const MAX_RATE_RETRIES = 6;

/**
 * Drives the pipeline from the browser, one short API call per step (each fits a 60s serverless
 * function). Stages are idempotent server-side, so "Run again" simply re-runs them.
 */
export function PipelineRunner({
  view,
  serverAi,
  autoStart,
  onRefresh,
}: {
  view: SessionView;
  serverAi: boolean;
  autoStart: boolean;
  onRefresh: () => Promise<SessionView | null>;
}) {
  const [steps, setSteps] = useState<Step[]>(() => STEPS.map((s) => ({ key: s.key, label: s.label, status: "idle" })));
  const [sources, setSources] = useState<SourceView[]>(view.sources);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const started = useRef(false);
  const id = view.session.id;

  const set = useCallback((key: StepKey, status: StepStatus, detail?: string) => {
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, status, detail } : s)));
  }, []);

  /** Call with automatic waiting on provider rate limits (free-tier friendly). */
  const withRateLimit = useCallback(async <T,>(key: StepKey, fn: () => Promise<T>): Promise<T> => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await fn();
      } catch (e) {
        if (e instanceof ApiClientError && e.code === "rate_limited" && attempt < MAX_RATE_RETRIES) {
          const wait = Math.min(Math.max(e.retryAfterSec ?? 20, 5), 90);
          for (let s = wait; s > 0; s--) {
            set(key, "running", `AI rate limit reached. Retrying in ${s}s…`);
            await sleep(1000);
          }
          continue;
        }
        throw e;
      }
    }
  }, [set]);

  const run = useCallback(async () => {
    setRunning(true);
    setNotice(null);
    const hasAi = serverAi || !!loadByoSettings();
    let current = sources;
    try {
      // 1. Extraction (3 at a time; PDFs were extracted at upload)
      set("extract", "running");
      const todo = current.filter((s) => s.type === "url" && (s.status === "pending" || s.status === "extracting" || s.status === "failed"));
      let i = 0;
      const worker = async () => {
        while (i < todo.length) {
          const src = todo[i++]!;
          setSources((prev) => prev.map((x) => (x.id === src.id ? { ...x, status: "extracting", error: null } : x)));
          try {
            const r = await apiFetch<{ source: SourceView }>(`/api/sessions/${id}/sources/${src.id}/extract`, { method: "POST" });
            setSources((prev) => prev.map((x) => (x.id === src.id ? { ...r.source, alias: x.alias } : x)));
          } catch (e) {
            setSources((prev) => prev.map((x) => (x.id === src.id ? { ...x, status: "failed", error: e instanceof Error ? e.message : "Failed" } : x)));
          }
        }
      };
      await Promise.all([worker(), worker(), worker()]);
      const fresh = await onRefresh();
      if (fresh) {
        current = fresh.sources;
        setSources(fresh.sources);
      }
      const readable = current.filter((s) => s.status === "extracted");
      const failed = current.filter((s) => s.status === "failed").length;
      set("extract", readable.length ? "done" : "failed", `${readable.length} of ${current.length} readable${failed ? `, ${failed} failed` : ""}`);
      if (!readable.length) {
        setNotice("None of the sources could be read, so there is nothing to analyse. Check the errors in Sources & Evidence, then add other sources or try again.");
        for (const s of STEPS.slice(1)) set(s.key, "skipped");
        return;
      }

      // 2. Claims per source, chunk by chunk
      if (!hasAi) {
        for (const s of STEPS.filter((x) => x.ai)) set(s.key, "config", "Configuration required: add a Gemini or OpenRouter key");
      } else {
        set("claims", "running");
        let added = 0;
        let rejected = 0;
        let claimFailures = 0;
        for (const [n, s] of readable.entries()) {
          let chunk: number | null = 0;
          while (chunk !== null) {
            set("claims", "running", `${s.alias} (${n + 1}/${readable.length})${chunk ? `, part ${chunk + 1}` : ""}…`);
            try {
              const r: { added: number; rejectedUnverified: number; nextChunk: number | null } = await withRateLimit("claims", () =>
                apiFetch(`/api/sessions/${id}/claims`, { method: "POST", ai: true, json: { sourceId: s.id, chunk } }),
              );
              added += r.added;
              rejected += r.rejectedUnverified;
              chunk = r.nextChunk;
            } catch (e) {
              if (e instanceof ApiClientError && (e.code === "llm_auth" || e.code === "config_required")) throw e;
              claimFailures++;
              chunk = null;
            }
          }
        }
        set("claims", claimFailures === readable.length ? "failed" : "done", `${added} verified claims${rejected ? `, ${rejected} unverifiable discarded` : ""}${claimFailures ? `, ${claimFailures} source(s) failed` : ""}`);
      }

      // 3+. Analysis stages
      const stage = async (key: Exclude<StepKey, "extract" | "claims">, describe: (r: Record<string, unknown>) => string) => {
        const needsAi = STEPS.find((s) => s.key === key)!.ai;
        if (needsAi && !hasAi) return;
        set(key, "running");
        try {
          const r = await withRateLimit(key, () => apiFetch<{ result: Record<string, unknown> }>(`/api/sessions/${id}/stages/${key}`, { method: "POST", ai: true }));
          set(key, "done", describe(r.result));
        } catch (e) {
          if (e instanceof ApiClientError && e.code === "llm_auth") throw e;
          set(key, e instanceof ApiClientError && e.code === "config_required" ? "config" : "failed", e instanceof Error ? e.message : "Failed");
        }
      };
      await stage("gaps", (r) => `${r.topics} topics, ${r.gaps} gaps`);
      await stage("contradictions", (r) => `${r.contradictions} found (${r.pairsCompared} cross-source pairs compared)`);
      await stage("freshness", (r) => `${r.warnings} warnings${r.aiUsed ? "" : " (rules only)"}`);
      await stage("questions", (r) => `${r.questions} questions`);
      await stage("checklist", (r) => `${r.items} items`);
      await stage("report", () => "Ready");
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : "The analysis stopped unexpectedly.";
      setNotice(msg);
      setSteps((prev) => prev.map((s) => (s.status === "running" ? { ...s, status: "failed", detail: msg } : s)));
    } finally {
      const fresh = await onRefresh().catch(() => null);
      if (fresh) setSources(fresh.sources);
      setRunning(false);
    }
  }, [id, onRefresh, serverAi, set, sources, withRateLimit]);

  useEffect(() => {
    if (autoStart && !started.current) {
      started.current = true;
      void run();
    }
  }, [autoStart, run]);

  const finished = steps.every((s) => s.status !== "idle" && s.status !== "running");

  return (
    <section className="mb-8 rounded-xl border bg-card p-4 shadow-xs sm:p-5 print:hidden" aria-labelledby="runner-h" aria-live="polite">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="runner-h" className="font-medium">Analysis progress</h2>
          <p className="text-xs text-muted-foreground">{running ? "Keep this tab open while GapLens works." : finished ? "Finished. Results are below." : "Run the analysis to read the sources and look for what's missing."}</p>
        </div>
        <Button type="button" variant={finished ? "outline" : "brand"} size="sm" onClick={() => void run()} disabled={running}>
          {running ? <Loader2 className="animate-spin" /> : finished ? <RotateCcw /> : <Play />} {running ? "Running…" : finished ? "Run again" : "Run analysis"}
        </Button>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <ol className="space-y-2">
          {steps.map((s) => (
            <li key={s.key} className="flex items-start gap-2.5 text-sm">
              <StepIcon status={s.status} />
              <div className="min-w-0">
                <p className={cn(s.status === "idle" && "text-muted-foreground")}>{s.label}</p>
                {s.detail && <p className={cn("text-xs", s.status === "failed" ? "text-destructive" : s.status === "config" ? "text-amber-700" : "text-muted-foreground")}>{s.detail}</p>}
              </div>
            </li>
          ))}
        </ol>
        <ul className="space-y-1.5 text-xs">
          {sources.map((s) => (
            <li key={s.id} className="flex items-start gap-2 rounded-md border px-2.5 py-1.5">
              <span className="font-mono font-semibold text-brand">{s.alias}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{s.title ?? s.url ?? s.fileName}</span>
                {s.error && <span className="block text-destructive">{s.error}</span>}
              </span>
              <span className={cn("shrink-0", s.status === "failed" ? "text-destructive" : s.status === "extracted" ? "text-emerald-700" : "text-muted-foreground")}>
                {s.status === "extracting" ? <Loader2 className="inline size-3 animate-spin" /> : s.status}
              </span>
            </li>
          ))}
        </ul>
      </div>
      {notice && <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{notice}</p>}
    </section>
  );
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "running") return <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-brand" aria-label="Running" />;
  if (status === "done") return <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-label="Done" />;
  if (status === "failed") return <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-label="Failed" />;
  if (status === "config") return <Settings2 className="mt-0.5 size-4 shrink-0 text-amber-600" aria-label="Configuration required" />;
  return <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" aria-label={status === "skipped" ? "Skipped" : "Waiting"} />;
}
