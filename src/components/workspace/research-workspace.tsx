"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleDashed, Loader2, Sparkles, XCircle } from "lucide-react";
import { apiFetch, ApiClientError } from "@/lib/client/api";
import { checkUrl, urlDedupKey } from "@/lib/url-safety";
import { AiSettings, useByoSettings } from "./ai-settings";
import { WebSearch } from "./web-search";
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
import { EXAMPLE_BRIEF, EXAMPLE_URLS } from "./example";
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
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [exampleLoaded, setExampleLoaded] = useState(false);
  const router = useRouter();
  const byo = useByoSettings();

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

  const aiReady = !!byo || !!integrations.llm.activeProvider;
  const readiness = [
    { ok: briefResult.success, label: "Topic and question filled in" },
    { ok: sources.length >= MIN_SOURCES, label: `At least ${MIN_SOURCES} sources (${sources.length}/${MAX_SOURCES})` },
    { ok: !missingPdfFiles, label: "All PDF files attached" },
    { ok: integrations.supabase, label: "Database configured (Supabase)" },
  ];
  const canAnalyse = readiness.every((r) => r.ok) && !submitting;
  const blockers = readiness.filter((r) => !r.ok).map((r) => r.label);

  /** Replace the brief and URL sources with the CSSS sample (uploaded PDFs are kept). */
  function loadExample() {
    const hasWork = brief.topic || brief.question || sources.some((s) => s.kind === "url");
    if (hasWork && !window.confirm("Replace the current brief and URLs with the CSSS sample?")) return;
    setBrief({ ...EXAMPLE_BRIEF });
    setTouched({});
    const now = new Date().toISOString();
    const urlSources: DraftSource[] = [];
    for (const u of EXAMPLE_URLS) {
      const r = checkUrl(u);
      if (r.ok) urlSources.push({ id: newId(), kind: "url", url: r.normalized, dedupKey: urlDedupKey(r.url), addedAt: now });
    }
    setSources((prev) => [...prev.filter((s) => s.kind === "pdf"), ...urlSources].slice(0, MAX_SOURCES));
    setExampleLoaded(true);
  }

  async function analyse() {
    if (!briefResult.success) return;
    setSubmitError(null);
    setSubmitting("Creating session…");
    try {
      const urls = sources.filter((s) => s.kind === "url").map((s) => (s as { url: string }).url);
      const pdfs = sources.filter((s): s is Extract<DraftSource, { kind: "pdf" }> => s.kind === "pdf");
      const { session } = await apiFetch<{ session: { id: string } }>("/api/sessions", {
        method: "POST",
        json: { brief: briefResult.data, urls, pdfCount: pdfs.length },
      });
      for (const [i, p] of pdfs.entries()) {
        setSubmitting(`Uploading PDF ${i + 1} of ${pdfs.length}…`);
        const fd = new FormData();
        fd.append("file", p.file!);
        // A failed PDF is recorded on its source row; the session continues.
        await apiFetch(`/api/sessions/${session.id}/sources`, { method: "POST", body: fd }).catch(() => undefined);
      }
      setSubmitting("Starting analysis…");
      clearDraft();
      router.push(`/research/${session.id}?run=1`);
    } catch (e) {
      setSubmitError(e instanceof ApiClientError ? e.message : "Could not start the analysis.");
      setSubmitting(null);
    }
  }

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
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1.5">
                <CardTitle className="text-base">Research brief</CardTitle>
                <CardDescription>What are you trying to find out, and what decision does it support?</CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={loadExample} title="Pre-fill a sample brief about the Central Sector Scheme of Scholarship with 5 real public sources">
                <Sparkles className="size-4" aria-hidden="true" /> Load example
              </Button>
            </div>
            {exampleLoaded && (
              <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
                Sample loaded: a CSSS scholarship brief with 5 real public sources (NSP guidelines, a CBSE notice, The Hindu, a third-party aggregator and the NSP announcements page). Nothing is pre-analysed; edit anything before you run it.
              </p>
            )}
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
            <WebSearch
              configured={integrations.search}
              existing={new Set(sources.filter((s) => s.kind === "url").map((s) => (s as { url: string }).url))}
              onAdd={(url) => {
                const r = checkUrl(url);
                if (r.ok && !existingKeys.has(urlDedupKey(r.url)) && !atCapacity) addUrls([{ url: r.normalized, dedupKey: urlDedupKey(r.url) }]);
              }}
            />
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
                  <Button type="button" variant="brand" size="lg" className="w-full" disabled={!canAnalyse} onClick={analyse}>
                    {submitting ? <Loader2 className="animate-spin" /> : <Sparkles />} {submitting ?? "Analyse sources"}
                  </Button>
                </span>
              </TooltipTrigger>
              {!canAnalyse && !submitting && <TooltipContent side="bottom">{`Not ready yet: ${blockers.join("; ")}.`}</TooltipContent>}
            </Tooltip>
            <p id="analyse-why" className="sr-only">
              {canAnalyse ? "Ready to analyse." : `Analysis disabled. Outstanding: ${blockers.join("; ")}.`}
            </p>
            {submitError && <p role="alert" className="text-xs text-destructive">{submitError}</p>}

            <div className="rounded-lg border bg-muted/40 p-4" role="status">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CircleDashed className="size-4 text-muted-foreground" aria-hidden="true" />
                Status: <span className="font-normal text-muted-foreground">Draft, not analysed</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {aiReady
                  ? "GapLens will read each source, extract verified claims, then look for gaps, contradictions and outdated information. Progress appears on the next page."
                  : "No AI key yet: GapLens can still read your sources and run the rule-based date checks, but claims, gaps, contradictions and the checklist show “Configuration required” until you add a key."}
              </p>
            </div>
            <AiSettings server={integrations.llm} />
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
