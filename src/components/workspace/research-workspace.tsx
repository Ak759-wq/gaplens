"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleDashed, Loader2, Sparkles, XCircle } from "lucide-react";
import { apiFetch, ApiClientError } from "@/lib/client/api";
import { checkUrl, urlDedupKey } from "@/lib/url-safety";
import { AiSettings } from "./ai-settings";
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
  const addedSourceCount = sources.filter((s) => (s.kind === "url" || Boolean(s.file)) && !s.extractionError).length;
  const extractedSourceCount = 0;
  const atCapacity = sources.length >= MAX_SOURCES;
  const missingPdfFiles = sources.some((s) => s.kind === "pdf" && !s.file);

  const readiness = [
    { ok: briefResult.success, label: briefResult.success ? "Research brief is complete" : "Research brief is incomplete" },
    { ok: addedSourceCount >= MIN_SOURCES, label: `At least ${MIN_SOURCES} sources added (${addedSourceCount}/${MAX_SOURCES}); extraction runs next` },
    { ok: !missingPdfFiles, label: "All PDF files attached" },
    { ok: integrations.llm.verified, label: integrations.llm.verified ? "AI provider connected" : integrations.llm.error ?? "AI provider is not verified" },
    { ok: integrations.supabaseVerified, label: integrations.supabaseVerified ? "Database connected (Supabase)" : "Database is not connected" },
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
      if (r.ok) urlSources.push({ id: newId(), kind: "url", url: r.normalized, dedupKey: urlDedupKey(r.url), addedAt: now, example: true });
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
    <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.85fr)]">
      <div className="min-w-0 space-y-6">
        <Card className="gap-4 rounded-2xl border-[#e3e3de] bg-white shadow-[0_18px_45px_-30px_rgba(32,35,34,0.2)]">
          <CardHeader className="gap-3 px-5 pt-5 sm:px-6 sm:pt-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1.5">
                <CardTitle className="font-serif text-xl font-normal tracking-tight text-[#202322]">Research brief</CardTitle>
                <CardDescription className="text-[#6b706f]">What are you trying to find out, and what decision does it support?</CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" className="border-[#e3e3de] bg-[#faf9f6] text-[#202322] hover:border-[#202322]/30 hover:bg-white" onClick={loadExample} title="Pre-fill a sample brief about the Central Sector Scheme of Scholarship with 5 real public sources">
                <Sparkles className="size-4" aria-hidden="true" /> Load example
              </Button>
            </div>
            {exampleLoaded && (
              <p className="rounded-lg border border-[#d6e3d3] bg-[#eaf0e6] px-3 py-2 text-xs text-[#536d53]">
                Sample loaded: a CSSS scholarship brief with 5 real public sources (NSP guidelines, a CBSE notice, The Hindu, a third-party aggregator and the NSP announcements page). Nothing is pre-analysed; edit anything before you run it.
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4 px-5 pb-5 sm:px-6 sm:pb-6">
            <div className="grid gap-4 md:grid-cols-2">
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="objective" className="text-[#202322]">
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

        <Card className="gap-4 rounded-2xl border-[#e3e3de] bg-white shadow-[0_18px_45px_-30px_rgba(32,35,34,0.2)]">
          <CardHeader className="gap-3 px-5 pt-5 sm:px-6 sm:pt-6">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="font-serif text-xl font-normal tracking-tight text-[#202322]">Sources</CardTitle>
              <span className="rounded-full border border-[#d6e3d3] bg-[#eaf0e6] px-2.5 py-1 text-[11px] font-medium text-[#536d53]">
                {extractedSourceCount} extracted · {addedSourceCount} added
              </span>
            </div>
            <CardDescription>
              Add pages and documents to cross-examine. Extraction status, titles, and dates are confirmed by the real pipeline.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 px-5 pb-5 sm:px-6 sm:pb-6">
            <div className="grid gap-4 md:grid-cols-2">
              <UrlInput existingKeys={existingKeys} onAdd={addUrls} disabled={atCapacity} />
              <PdfDropzone existingKeys={dropzoneKeys} onAdd={addPdfs} disabled={atCapacity && !missingPdfFiles} />
            </div>
            <WebSearch
              configured={integrations.search}
              existing={new Set(sources.filter((s) => s.kind === "url").map((s) => s.url))}
              onAdd={(url) => {
                const r = checkUrl(url);
                if (r.ok && !existingKeys.has(urlDedupKey(r.url)) && !atCapacity) addUrls([{ url: r.normalized, dedupKey: urlDedupKey(r.url) }]);
              }}
            />
            {atCapacity && <p className="text-xs text-muted-foreground">Maximum of {MAX_SOURCES} sources reached.</p>}
            {missingPdfFiles && (
              <p className="rounded-lg border border-[#eadfc7] bg-[#fbf6e9] px-3 py-2 text-xs text-[#8b6a33]">
                Some PDFs were restored from your saved draft by name only. Browsers can&apos;t keep files between visits, so drop them in again to re-attach.
              </p>
            )}
            <SourceTable sources={sources} onRemove={(id) => setSources((prev) => prev.filter((s) => s.id !== id))} />
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start" aria-label="Analysis status">
        <Card className="gap-4 rounded-2xl border-[#e3e3de] bg-white shadow-[0_18px_45px_-30px_rgba(32,35,34,0.2)]">
          <CardHeader className="gap-2 px-5 pt-5 sm:px-6 sm:pt-6">
            <CardTitle className="font-serif text-xl font-normal tracking-tight text-[#202322]">Analysis readiness</CardTitle>
            <CardDescription className="text-[#6b706f]">A live readiness check before GapLens runs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 px-5 pb-5 sm:px-6 sm:pb-6">
            <ul className="space-y-3 text-sm" aria-live="polite">
              {readiness.map((r) => (
                <li key={r.label} className="flex items-start gap-2.5">
                  {r.ok ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#536d53]" aria-label="Done" />
                  ) : (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-[#b58a42]" aria-label="Not yet" />
                  )}
                  <span className={r.ok ? "text-[#202322]" : "text-[#6b706f]"}>{r.label}</span>
                </li>
              ))}
            </ul>

            <div className="grid gap-2 border-y border-[#e3e3de] py-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#6b706f]">AI provider connection</span>
                <span className={integrations.llm.verified ? "text-[#536d53]" : "text-[#b58a42]"}>{integrations.llm.verified ? "Connected" : "Not configured"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#6b706f]">Source extraction</span>
                <span className="text-[#202322]">{addedSourceCount ? `${extractedSourceCount} extracted; verified after analysis` : "Waiting for sources"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#6b706f]">Database connection</span>
                <span className={integrations.supabaseVerified ? "text-[#536d53]" : "text-[#b58a42]"}>{integrations.supabaseVerified ? "Connected" : integrations.supabase ? "Not reachable" : "Not configured"}</span>
              </div>
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                {/* span wrapper so the tooltip works while the button is disabled */}
                <span tabIndex={canAnalyse ? -1 : 0} className="block rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40" aria-describedby="analyse-why">
                  <Button type="button" variant="default" size="lg" className="w-full bg-[#202322] text-white hover:bg-[#2f3431] disabled:bg-[#d8d9d4] disabled:text-[#8a8e8b]" disabled={!canAnalyse} onClick={analyse}>
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

            <div className="rounded-lg border border-[#e3e3de] bg-[#faf9f6] p-4" role="status">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CircleDashed className="size-4 text-[#6b706f]" aria-hidden="true" />
                <span className="text-[#202322]">Status:</span> <span className="font-normal text-[#6b706f]">Draft, not analysed</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-[#6b706f]">
                {integrations.llm.verified
                  ? "GapLens will read each source, extract verified claims, then look for gaps, contradictions and outdated information. Progress appears on the next page."
                  : "A verified server AI provider is required before analysis can start. Configure the provider in the deployment environment, then reload this workspace."}
              </p>
            </div>
            <div className="[&_div.rounded-lg.border]:border-[#e3e3de] [&_div.rounded-lg.border]:bg-[#faf9f6] [&_p]:text-[#6b706f]">
              <AiSettings server={integrations.llm} />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[#e3e3de] bg-white shadow-[0_18px_45px_-30px_rgba(32,35,34,0.16)]">
          <CardHeader className="gap-1 px-5 pt-5 sm:px-6 sm:pt-6">
            <CardTitle className="font-serif text-lg font-normal text-[#202322]">What GapLens checks</CardTitle>
            <CardDescription className="text-xs text-[#6b706f]">Every result stays tied to source evidence.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 px-5 pb-5 sm:px-6 sm:pb-6">
            {[
              { label: "Verified in source", detail: "Claims supported by an extracted passage.", dot: "bg-[#536d53]" },
              { label: "Potential gap", detail: "Important context not found in reviewed sources.", dot: "bg-[#b58a42]" },
              { label: "Possible contradiction", detail: "Sources make materially different claims.", dot: "bg-[#c77f76]" },
              { label: "Potentially outdated", detail: "Dates or cycles require a freshness check.", dot: "bg-[#9a9e99]" },
            ].map(({ label, detail, dot }) => (
              <div key={label} className="flex items-start gap-3 rounded-lg border border-[#e3e3de] px-3 py-2.5">
                <span className={`mt-0.5 size-2 shrink-0 rounded-full ${dot}`} />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[#202322]">{label}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-[#6b706f]">{detail}</p>
                </div>
              </div>
            ))}
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
