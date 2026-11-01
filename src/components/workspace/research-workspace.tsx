"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  Loader2,
  Sparkles,
} from "lucide-react";
import { apiFetch, ApiClientError } from "@/lib/client/api";
import { checkUrl, urlDedupKey } from "@/lib/url-safety";
import { AiSettings } from "./ai-settings";
import { Landscape } from "./landscape";
import { WebSearch } from "./web-search";
import { Button } from "@/components/ui/button";
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

/** Shared surface: white card, hairline border, 12px radius, no shadow. */
const CARD = "rounded-xl border border-[#e3e3de] bg-white shadow-none";

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
      label: "Research brief completed",
    },
    {
      ok: addedSourceCount >= MIN_SOURCES,
      label: `At least ${MIN_SOURCES} usable sources (${addedSourceCount}/${MAX_SOURCES})`,
    },
    {
      ok: !missingPdfFiles,
      label: "PDF extraction ready",
    },
    {
      ok: integrations.supabaseVerified,
      label: "Database connection",
      note: integrations.supabaseVerified ? "Connected" : integrations.supabase ? "Not reachable" : "Not configured",
    },
    {
      ok: integrations.llm.verified,
      label: "AI provider",
      note: integrations.llm.verified ? "Connected" : "Not configured",
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
      {/* Watercolour hills: viewport-wide and fixed, so they stay behind the cards
          without adding horizontal overflow. The page footer is opaque and stacks
          above them at the end of the document. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 bottom-0 h-[clamp(200px,28vh,320px)] overflow-hidden"
      >
        <Landscape />
      </div>

      <div className="relative z-10 grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(340px,1.15fr)]">
        <div className="min-w-0 space-y-6">
          {/* ── Research brief ─────────────────────────────────────────── */}
          <section className={`${CARD} p-6 sm:p-7`} aria-labelledby="brief-heading">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 id="brief-heading" className="font-display text-[24px] leading-tight font-medium tracking-[-0.01em] text-[#202322]">
                  Research brief
                </h2>
                <p className="mt-1.5 text-[13.5px] text-[#6b706f]">
                  What are you trying to find out, and what decision does it support?
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 shrink-0 rounded-full border-[#e3e3de] bg-white px-4 text-[12.5px] font-medium text-[#202322] shadow-none hover:border-[#202322]/25 hover:bg-[#f7f6f2]"
                onClick={loadExample}
                title="Pre-fill a sample brief about the Central Sector Scheme of Scholarship with 5 real public sources"
              >
                <Sparkles className="size-3.5" aria-hidden="true" /> Load example
              </Button>
            </div>

            {exampleLoaded && (
              <p className="mt-4 border-l-2 border-[#c9d8c4] pl-3 text-[12px] leading-relaxed text-[#536d53]">
                Sample loaded: a CSSS scholarship brief with 5 real public sources. Nothing is pre-analysed; edit
                anything before you run it.
              </p>
            )}

            <div className="mt-5 space-y-[18px]">
              <div className="space-y-1.5">
                <Label htmlFor="topic" className="text-[12.5px] font-semibold text-[#202322]">
                  Research topic
                </Label>
                <Input
                  id="topic"
                  placeholder="e.g. State merit scholarship for engineering students"
                  value={brief.topic}
                  maxLength={200}
                  className="h-10 rounded-lg border-[#e3e3de] bg-white px-3 text-[13.5px] shadow-none placeholder:text-[#9a9e99] focus-visible:border-[#202725]/30 focus-visible:ring-[#202725]/10"
                  onChange={(e) => setBrief({ ...brief, topic: e.target.value })}
                  onBlur={() => setTouched((t) => ({ ...t, topic: true }))}
                  aria-invalid={!!fieldError("topic") || undefined}
                  aria-describedby={fieldError("topic") ? "topic-err" : undefined}
                />
                {fieldError("topic") && (
                  <p id="topic-err" className="text-[12px] text-[#c77f76]">
                    {fieldError("topic")}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="question" className="text-[12.5px] font-semibold text-[#202322]">
                  Specific question
                </Label>
                <Textarea
                  id="question"
                  placeholder="e.g. What is the application deadline for the current cycle, and what are the renewal conditions?"
                  value={brief.question}
                  maxLength={1000}
                  rows={3}
                  className="min-h-[74px] rounded-lg border-[#e3e3de] bg-white px-3 py-2.5 text-[13.5px] shadow-none placeholder:text-[#9a9e99] focus-visible:border-[#202725]/30 focus-visible:ring-[#202725]/10"
                  onChange={(e) => setBrief({ ...brief, question: e.target.value })}
                  onBlur={() => setTouched((t) => ({ ...t, question: true }))}
                  aria-invalid={!!fieldError("question") || undefined}
                  aria-describedby={fieldError("question") ? "question-err" : undefined}
                />
                {fieldError("question") && (
                  <p id="question-err" className="text-[12px] text-[#c77f76]">
                    {fieldError("question")}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="objective" className="text-[12.5px] font-semibold text-[#202322]">
                  Objective <span className="font-normal text-[#6b706f]">(optional)</span>
                </Label>
                <Textarea
                  id="objective"
                  placeholder="e.g. Decide whether to apply this cycle and what documents to prepare."
                  value={brief.objective}
                  maxLength={1000}
                  rows={2}
                  className="min-h-[58px] rounded-lg border-[#e3e3de] bg-white px-3 py-2.5 text-[13.5px] shadow-none placeholder:text-[#9a9e99] focus-visible:border-[#202725]/30 focus-visible:ring-[#202725]/10"
                  onChange={(e) => setBrief({ ...brief, objective: e.target.value })}
                />
              </div>
            </div>
          </section>

          {/* ── Sources ────────────────────────────────────────────────── */}
          <section className={`${CARD} p-6 sm:p-7`} aria-labelledby="sources-heading">
            <h2 id="sources-heading" className="font-display text-[24px] leading-tight font-medium tracking-[-0.01em] text-[#202322]">
              Sources
            </h2>

            <div className="mt-5 space-y-4">
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

              {atCapacity && (
                <p className="text-[12px] text-[#6b706f]">Maximum of {MAX_SOURCES} sources reached.</p>
              )}
              {missingPdfFiles && (
                <p className="rounded-lg border border-[#eadfc7] bg-[#fbf6e9] px-3 py-2 text-[12px] leading-relaxed text-[#8b6a33]">
                  Some PDFs were restored from your saved draft by name only. Browsers can&apos;t keep files between
                  visits, so drop them in again to re-attach.
                </p>
              )}

              <SourceTable sources={sources} onRemove={(id) => setSources((prev) => prev.filter((s) => s.id !== id))} />
            </div>
          </section>
        </div>

        {/* ── Right rail: one card, as in the reference ───────────────── */}
        <aside className="min-w-0 lg:sticky lg:top-[88px] lg:self-start" aria-label="Analysis status">
          <div className={`${CARD} p-6 sm:p-7`}>
            <h2 className="font-display text-[24px] leading-tight font-medium tracking-[-0.01em] text-[#202322]">
              Analysis readiness
            </h2>
            <p className="mt-1.5 text-[13.5px] text-[#6b706f]">A live check before GapLens runs.</p>

            <ul className="mt-5 space-y-3" aria-live="polite">
              {readiness.map((r) => (
                <li key={r.label} className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={
                        r.ok
                          ? "flex size-[18px] shrink-0 items-center justify-center rounded-full border-transparent bg-[#536d53] text-white"
                          : "flex size-[18px] shrink-0 items-center justify-center rounded-full border border-[#cfd1ca] text-transparent"
                      }
                      aria-hidden="true"
                    >
                      {r.ok ? <Check className="size-3" strokeWidth={3.5} /> : <Circle className="size-0" />}
                    </span>
                    <span className="min-w-0 truncate text-[13px] text-[#202322]">{r.label}</span>
                  </span>
                  {r.note && (
                    <span
                      className={`shrink-0 text-right text-[12px] font-medium whitespace-nowrap ${r.ok ? "text-[#4a4f4d]" : "text-[#b58a42]"}`}
                    >
                      {r.note}
                    </span>
                  )}
                </li>
              ))}
            </ul>

            <div className="mt-5 border-t border-[#e3e3de] pt-5">
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
                      className="h-10 w-full rounded-lg bg-[#202725] text-[13.5px] font-medium text-white shadow-none hover:bg-[#2f3633] disabled:bg-[#dcdcd7] disabled:text-[#8f938f]"
                      disabled={!canAnalyse}
                      onClick={analyse}
                    >
                      {submitting ? <Loader2 className="animate-spin" /> : <Sparkles className="size-4" />}
                      {submitting ?? "Analyse sources"}
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
                <p role="alert" className="mt-2 text-[12px] text-[#c77f76]">
                  {submitError}
                </p>
              )}
            </div>

            <div className="mt-4 rounded-lg border border-[#eceae4] bg-[#f7f6f2] px-4 py-3.5" role="status">
              <p className="text-[12.5px] text-[#202322]">
                <span className="font-semibold">Status:</span>{" "}
                <span className="text-[#4a4f4d]">Draft, not analysed</span>
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-[#6b706f]">
                Add sources and configure integrations to begin evidence analysis.
              </p>
            </div>

            <div className="mt-4">
              <AiSettings server={integrations.llm} />
            </div>

            <div className="mt-6 border-t border-[#e3e3de] pt-5">
              <h3 className="font-display text-[17px] leading-tight font-medium tracking-[-0.01em] text-[#202322]">
                What GapLens checks
              </h3>
              <ul className="mt-4 space-y-[14px]">
                {[
                  { icon: CheckCircle2, title: "Verified in source", detail: "A claim supported by one or more sources." },
                  { icon: Circle, title: "Potential gap", detail: "Important information not found in reviewed sources." },
                  { icon: ArrowLeftRight, title: "Possible contradiction", detail: "Conflicting claims across different sources." },
                  { icon: Clock3, title: "Potentially outdated", detail: "Information that may no longer be current." },
                ].map(({ icon: Icon, title, detail }) => (
                  <li key={title} className="flex items-start gap-2.5">
                    <Icon className="mt-[3px] size-4 shrink-0 text-[#6b706f]" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="font-display text-[13.5px] font-medium text-[#202322]">{title}</p>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-[#6b706f]">{detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between px-1 text-[11.5px] text-[#9a9e99]">
            <span>{hydrated ? "Draft saved in this browser" : "Loading draft…"}</span>
            <button
              type="button"
              onClick={clearDraft}
              className="underline-offset-4 transition-colors hover:text-[#202322] hover:underline"
            >
              Clear draft
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
