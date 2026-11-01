"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, BadgeCheck, CheckCircle2, CircleDashed, Clock3, Loader2, Sparkles } from "lucide-react";
import { apiFetch, ApiClientError } from "@/lib/client/api";
import { checkUrl, urlDedupKey } from "@/lib/url-safety";
import { AiSettings } from "./ai-settings";
import { Landscape } from "./landscape";
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

  /**
   * Five live checks. `note` is shown to the right of the row for the integration
   * items, in muted amber when unconfigured, so the reason is visible without
   * guessing. Nothing here reports success unless the real status says so.
   */
  const readiness: { ok: boolean; label: string; note?: string }[] = [
    {
      ok: briefResult.success,
      label: briefResult.success ? "Research brief completed" : "Research brief incomplete",
    },
    {
      ok: addedSourceCount >= MIN_SOURCES,
      label: `At least ${MIN_SOURCES} usable sources (${addedSourceCount}/${MAX_SOURCES})`,
    },
    {
      ok: !missingPdfFiles,
      label: missingPdfFiles ? "PDF files need re-attaching" : "PDF extraction ready",
    },
    {
      ok: integrations.supabaseVerified,
      label: "Database connection",
      note: integrations.supabaseVerified ? "Connected" : integrations.supabase ? "Not reachable" : "Not configured",
    },
    {
      ok: integrations.llm.verified,
      label: "AI provider",
      note: integrations.llm.verified ? "Connected" : integrations.llm.error ?? "Not configured",
    },
  ];
  const canAnalyse = readiness.every((r) => r.ok) && !submitting;
  const blockers = readiness
    .filter((r) => !r.ok)
    .map((r) => (r.note ? `${r.label} (${r.note})` : r.label));

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
    <div className="relative">
      {/* Watercolour hills sit behind everything and never overlap the controls. */}
      <Landscape />

      <div className="relative z-10 grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.85fr)]">
        <div className="min-w-0 space-y-6">
          <Card className="gap-4 rounded-xl border-[#e3e3de] bg-white py-6 shadow-none">
            <CardHeader className="gap-3 px-5 pt-0 sm:px-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <CardTitle className="font-display text-[22px] font-medium tracking-[-0.01em] text-[#202322]">
                    Research brief
                  </CardTitle>
                  <CardDescription className="text-[14px] text-[#6b706f]">
                    What are you trying to find out, and what decision does it support?
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-full border-[#e3e3de] bg-white text-[13px] text-[#202322] shadow-none hover:border-[#202322]/25 hover:bg-[#faf9f6]"
                  onClick={loadExample}
                  title="Pre-fill a sample brief about the Central Sector Scheme of Scholarship with 5 real public sources"
                >
                  <Sparkles className="size-3.5" aria-hidden="true" /> Load example
                </Button>
              </div>
              {exampleLoaded && (
                <p className="rounded-lg border border-[#d6e3d3] bg-[#eaf0e6] px-3 py-2 text-xs text-[#536d53]">
                  Sample loaded: a CSSS scholarship brief with 5 real public sources (NSP guidelines, a CBSE notice, The
                  Hindu, a third-party aggregator and the NSP announcements page). Nothing is pre-analysed; edit anything
                  before you run it.
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-5 px-5 pb-0 sm:px-6">
              <div className="space-y-2">
                <Label htmlFor="topic" className="text-[13px] font-medium text-[#202322]">
                  Research topic
                </Label>
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
                {fieldError("topic") && <p id="topic-err" className="text-xs text-[#c77f76]">{fieldError("topic")}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="question" className="text-[13px] font-medium text-[#202322]">
                  Specific question
                </Label>
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
                {fieldError("question") && <p id="question-err" className="text-xs text-[#c77f76]">{fieldError("question")}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="objective" className="text-[13px] font-medium text-[#202322]">
                  Objective <span className="font-normal text-[#6b706f]">(optional)</span>
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

        <Card className="gap-4 rounded-xl border-[#e3e3de] bg-white py-6 shadow-none">
          <CardHeader className="gap-3 px-5 pt-0 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="font-display text-[22px] font-medium tracking-[-0.01em] text-[#202322]">
                Sources
              </CardTitle>
              <span className="rounded-full border border-[#d6e3d3] bg-[#eaf0e6] px-2.5 py-1 text-[11px] font-medium text-[#536d53]">
                {extractedSourceCount} extracted · {addedSourceCount} added
              </span>
            </div>
            <CardDescription className="text-[14px] text-[#6b706f]">
              Add pages and documents to cross-examine. Extraction status, titles, and dates are confirmed by the real
              pipeline.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 px-5 pb-0 sm:px-6">
            <UrlInput existingKeys={existingKeys} onAdd={addUrls} disabled={atCapacity} />
            <PdfDropzone existingKeys={dropzoneKeys} onAdd={addPdfs} disabled={atCapacity && !missingPdfFiles} />
            <WebSearch
              configured={integrations.search}
              existing={new Set(sources.filter((s) => s.kind === "url").map((s) => s.url))}
              onAdd={(url) => {
                const r = checkUrl(url);
                if (r.ok && !existingKeys.has(urlDedupKey(r.url)) && !atCapacity) addUrls([{ url: r.normalized, dedupKey: urlDedupKey(r.url) }]);
              }}
            />
            {atCapacity && <p className="text-xs text-[#6b706f]">Maximum of {MAX_SOURCES} sources reached.</p>}
            {missingPdfFiles && (
              <p className="rounded-lg border border-[#eadfc7] bg-[#fbf6e9] px-3 py-2 text-xs text-[#8b6a33]">
                Some PDFs were restored from your saved draft by name only. Browsers can&apos;t keep files between
                visits, so drop them in again to re-attach.
              </p>
            )}
            <SourceTable sources={sources} onRemove={(id) => setSources((prev) => prev.filter((s) => s.id !== id))} />
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start" aria-label="Analysis status">
        <Card className="gap-4 rounded-xl border-[#e3e3de] bg-white py-6 shadow-none">
          <CardHeader className="gap-2 px-5 pt-0 sm:px-6">
            <CardTitle className="font-display text-[22px] font-medium tracking-[-0.01em] text-[#202322]">
              Analysis readiness
            </CardTitle>
            <CardDescription className="text-[14px] text-[#6b706f]">A live check before GapLens runs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 px-5 pb-0 sm:px-6">
            <ul className="space-y-3.5 text-sm" aria-live="polite">
              {readiness.map((r) => (
                <li key={r.label} className="flex items-start gap-3">
                  <span
                    className={
                      r.ok
                        ? "mt-px flex size-[18px] shrink-0 items-center justify-center rounded-full border border-[#536d53]/35 bg-[#eaf0e6]"
                        : "mt-px flex size-[18px] shrink-0 items-center justify-center rounded-full border border-[#e3e3de] bg-white"
                    }
                    aria-hidden="true"
                  >
                    {r.ok ? (
                      <CheckCircle2 className="size-3 text-[#536d53]" />
                    ) : (
                      <span className="size-1.5 rounded-full bg-[#d5d6d1]" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 text-[13.5px] leading-snug text-[#202322]">
                    {r.label}
                    {r.note && (
                      <span className={r.ok ? "ml-1.5 text-[#536d53]" : "ml-1.5 text-[#b58a42]"}>· {r.note}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>

            <div className="border-t border-[#e3e3de] pt-5" />

            <Tooltip>
              <TooltipTrigger asChild>
                {/* span wrapper so the tooltip works while the button is disabled */}
                <span
                  tabIndex={canAnalyse ? -1 : 0}
                  className="block rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
                  aria-describedby="analyse-why"
                >
                  <Button
                    type="button"
                    size="lg"
                    className="w-full rounded-lg bg-[#202725] text-[14px] font-medium text-white shadow-none hover:bg-[#2f3633] disabled:bg-[#d8d9d4] disabled:text-[#8a8e8b]"
                    disabled={!canAnalyse}
                    onClick={analyse}
                  >
                    {submitting ? <Loader2 className="animate-spin" /> : <Sparkles />} {submitting ?? "Analyse sources"}
                  </Button>
                </span>
              </TooltipTrigger>
              {!canAnalyse && !submitting && (
                <TooltipContent side="bottom">{`Not ready yet: ${blockers.join("; ")}.`}</TooltipContent>
              )}
            </Tooltip>
            <p id="analyse-why" className="sr-only">
              {canAnalyse ? "Ready to analyse." : `Analysis disabled. Outstanding: ${blockers.join("; ")}.`}
            </p>
            {submitError && (
              <p role="alert" className="text-xs text-[#c77f76]">
                {submitError}
              </p>
            )}

            <div className="rounded-xl border border-[#e3e3de] bg-[#faf9f6] p-4" role="status">
              <p className="text-[13px] text-[#202322]">
                <span className="font-medium">Status:</span> <span className="text-[#6b706f]">Draft, not analysed</span>
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-[#6b706f]">
                Add sources and configure integrations to begin evidence analysis.
              </p>
            </div>
            <div className="[&_div.rounded-lg.border]:border-[#e3e3de] [&_div.rounded-lg.border]:bg-[#faf9f6] [&_p]:text-[#6b706f]">
              <AiSettings server={integrations.llm} />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-[#e3e3de] bg-white py-6 shadow-none">
          <CardHeader className="gap-1 px-5 pt-0 sm:px-6">
            <CardTitle className="font-display text-[19px] font-medium tracking-[-0.01em] text-[#202322]">
              What GapLens checks
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 px-5 pb-0 sm:px-6">
            {[
              {
                icon: BadgeCheck,
                title: "Verified in source",
                detail: "A claim supported by one or more sources.",
              },
              {
                icon: CircleDashed,
                title: "Potential gap",
                detail: "Important information not found in reviewed sources.",
              },
              {
                icon: ArrowLeftRight,
                title: "Possible contradiction",
                detail: "Conflicting claims across different sources.",
              },
              {
                icon: Clock3,
                title: "Potentially outdated",
                detail: "Information that may no longer be current.",
              },
            ].map(({ icon: Icon, title, detail }) => (
              <div key={title} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-[#e3e3de] bg-white">
                  <Icon className="size-3.5 text-[#6b706f]" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="font-display text-[14px] font-medium text-[#202322]">{title}</p>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-[#6b706f]">{detail}</p>
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
    </div>
  );
}
