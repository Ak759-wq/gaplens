"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleDashed, Sparkles, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MAX_SOURCES, researchBriefSchema } from "@/lib/validation";
import { PdfDropzone } from "./pdf-dropzone";
import { SourceTable } from "./source-table";
import { UrlInput } from "./url-input";
import { newId, type Brief, type ClientIntegrationStatus, type DraftSource } from "./types";

const DRAFT_KEY = "gaplens:workspace-draft:v1";
const MIN_SOURCES = 2;

type StoredDraft = { brief: Brief; sources: DraftSource[] };

function loadDraft(): StoredDraft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft;
    if (!parsed || typeof parsed !== "object" || !parsed.brief || !Array.isArray(parsed.sources)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function ResearchWorkspace({ integrations }: { integrations: ClientIntegrationStatus }) {
  const [brief, setBrief] = useState<Brief>({ topic: "", question: "", objective: "" });
  const [sources, setSources] = useState<DraftSource[]>([]);
  const [touched, setTouched] = useState<Partial<Record<keyof Brief, boolean>>>({});
  const [hydrated, setHydrated] = useState(false);

  // Restore draft (brief + URLs + PDF names; File objects cannot be persisted and must be re-attached).
  useEffect(() => {
    const d = loadDraft();
    if (d) {
      setBrief({ topic: d.brief.topic ?? "", question: d.brief.question ?? "", objective: d.brief.objective ?? "" });
      setSources(d.sources);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const toStore: StoredDraft = {
      brief,
      sources: sources.map((s) => (s.kind === "pdf" ? { ...s, file: undefined } : s)),
    };
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(toStore));
    } catch {
      /* storage full or disabled; draft just won't persist */
    }
  }, [brief, sources, hydrated]);

  const existingKeys = useMemo(() => new Set(sources.map((s) => s.dedupKey)), [sources]);
  const briefResult = researchBriefSchema.safeParse(brief);
  const fieldError = (k: keyof Brief) =>
    !briefResult.success && touched[k] ? briefResult.error.issues.find((i) => i.path[0] === k)?.message : undefined;
  const atCapacity = sources.length >= MAX_SOURCES;
  const missingPdfFiles = sources.some((s) => s.kind === "pdf" && !s.file);

  const readiness = [
    { ok: briefResult.success, label: "Topic and question filled in" },
    { ok: sources.length >= MIN_SOURCES, label: `At least ${MIN_SOURCES} sources (${sources.length}/${MAX_SOURCES})` },
    { ok: !missingPdfFiles, label: "All PDF files attached" },
    { ok: integrations.openrouter, label: "AI provider configured (OPENROUTER_API_KEY)" },
    { ok: integrations.supabase, label: "Database configured (Supabase)" },
    { ok: integrations.pipelineReady, label: "Analysis pipeline wired (Phase 2/3)" },
  ];
  const canAnalyse = readiness.every((r) => r.ok);
  const blockers = readiness.filter((r) => !r.ok).map((r) => r.label);

  function addUrls(items: { url: string; dedupKey: string }[]) {
    setSources((prev) => {
      const room = MAX_SOURCES - prev.length;
      const now = new Date().toISOString();
      return [...prev, ...items.slice(0, room).map((i) => ({ id: newId(), kind: "url" as const, url: i.url, dedupKey: i.dedupKey, addedAt: now }))];
    });
  }
  function addPdfs(items: { file: File; dedupKey: string }[]) {
    setSources((prev) => {
      const room = MAX_SOURCES - prev.length;
      const now = new Date().toISOString();
      // Re-attaching a file that was restored from a draft fills in its File object.
      const next = prev.map((s) => {
        if (s.kind !== "pdf" || s.file) return s;
        const match = items.find((i) => i.dedupKey === s.dedupKey);
        return match ? { ...s, file: match.file } : s;
      });
      const fresh = items
        .filter((i) => !prev.some((s) => s.dedupKey === i.dedupKey))
        .slice(0, room)
        .map((i) => ({ id: newId(), kind: "pdf" as const, fileName: i.file.name, size: i.file.size, file: i.file, dedupKey: i.dedupKey, addedAt: now }));
      return [...next, ...fresh];
    });
  }
  // Allow re-attaching restored PDFs even though their key is "already added".
  const dropzoneKeys = useMemo(
    () => new Set(sources.filter((s) => s.kind !== "pdf" || s.file).map((s) => s.dedupKey)),
    [sources],
  );

  function clearDraft() {
    setBrief({ topic: "", question: "", objective: "" });
    setSources([]);
    setTouched({});
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Research brief</CardTitle>
            <CardDescription>What are you trying to find out, and what decision does it support?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="topic">Research topic</Label>
              <Input
                id="topic"
                placeholder="e.g. State merit scholarship for engineering students"
                value={brief.topic}
                maxLength={200}
                onChange={(e) => setBrief({ ...brief, topic: e.target.value })}
                onBlur={() => setTouched((t) => ({ ...t, topic: true }))}
                aria-invalid={!!fieldError("topic") || undefined}
                aria-describedby={fieldError("topic") ? "topic-err" : undefined}
              />
              {fieldError("topic") && <p id="topic-err" className="text-xs text-destructive">{fieldError("topic")}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="question">Specific question</Label>
              <Textarea
                id="question"
                placeholder="e.g. What is the application deadline for the current cycle, and what are the renewal conditions?"
                value={brief.question}
                maxLength={1000}
                rows={3}
                onChange={(e) => setBrief({ ...brief, question: e.target.value })}
                onBlur={() => setTouched((t) => ({ ...t, question: true }))}
                aria-invalid={!!fieldError("question") || undefined}
                aria-describedby={fieldError("question") ? "question-err" : undefined}
              />
              {fieldError("question") && <p id="question-err" className="text-xs text-destructive">{fieldError("question")}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="objective">
                Objective <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="objective"
                placeholder="e.g. Decide whether to apply this cycle and what documents to prepare."
                value={brief.objective}
                maxLength={1000}
                rows={2}
                onChange={(e) => setBrief({ ...brief, objective: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sources</CardTitle>
            <CardDescription>
              Add the pages and documents you want cross-examined. Titles and dates appear only after extraction, and are never guessed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <UrlInput existingKeys={existingKeys} onAdd={addUrls} disabled={atCapacity} />
              <PdfDropzone existingKeys={dropzoneKeys} onAdd={addPdfs} disabled={atCapacity && !missingPdfFiles} />
            </div>
            {atCapacity && <p className="text-xs text-muted-foreground">Maximum of {MAX_SOURCES} sources reached.</p>}
            {missingPdfFiles && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Some PDFs were restored from your saved draft by name only. Browsers can&apos;t keep files between visits, so drop them in again to re-attach.
              </p>
            )}
            <SourceTable sources={sources} onRemove={(id) => setSources((prev) => prev.filter((s) => s.id !== id))} />
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start" aria-label="Analysis status">
        <Card className="gap-4">
          <CardHeader>
            <CardTitle className="text-base">Analysis</CardTitle>
            <CardDescription>Checks that must pass before GapLens can run.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <ul className="space-y-2.5 text-sm" aria-live="polite">
              {readiness.map((r) => (
                <li key={r.label} className="flex items-start gap-2.5">
                  {r.ok ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-label="Done" />
                  ) : (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label="Not yet" />
                  )}
                  <span className={r.ok ? "" : "text-muted-foreground"}>{r.label}</span>
                </li>
              ))}
            </ul>

            <Tooltip>
              <TooltipTrigger asChild>
                {/* span wrapper so the tooltip works while the button is disabled */}
                <span tabIndex={canAnalyse ? -1 : 0} className="block rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40" aria-describedby="analyse-why">
                  <Button type="button" variant="brand" size="lg" className="w-full" disabled={!canAnalyse}>
                    <Sparkles /> Analyse sources
                  </Button>
                </span>
              </TooltipTrigger>
              {!canAnalyse && (
                <TooltipContent side="bottom">
                  {integrations.pipelineReady
                    ? `Not ready yet: ${blockers.join("; ")}.`
                    : "Analysis isn't available yet. Source extraction (Phase 2) and gap analysis (Phase 3) aren't wired up in this build."}
                </TooltipContent>
              )}
            </Tooltip>
            <p id="analyse-why" className="sr-only">
              {canAnalyse ? "Ready to analyse." : `Analysis disabled. Outstanding: ${blockers.join("; ")}.`}
            </p>

            <div className="rounded-lg border bg-muted/40 p-4" role="status">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CircleDashed className="size-4 text-muted-foreground" aria-hidden="true" />
                Status: <span className="font-normal text-muted-foreground">Draft, not analysed</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Progress for extraction, claim analysis and report generation will appear here once the pipeline is connected.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
          <span>{hydrated ? "Draft saved in this browser" : "Loading draft…"}</span>
          <button type="button" onClick={clearDraft} className="underline-offset-4 hover:text-foreground hover:underline">
            Clear draft
          </button>
        </div>
      </aside>
    </div>
  );
}
