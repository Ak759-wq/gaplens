import { ExternalLink, FileText, Globe, Landmark } from "lucide-react";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { evidenceKey, type QuoteContext, type SessionView, type SourceView } from "@/lib/view-types";
import type { EvidenceRef } from "@/server/ai/schemas";
import { FindingBadge } from "./finding-badge";

/** Encode text for a URL text fragment (#:~:text=). '-', ',' and '&' must be percent-encoded. */
function fragmentPart(s: string) {
  return encodeURIComponent(s).replace(/-/g, "%2D").replace(/,/g, "%2C");
}

/** Link to the original page that scrolls to + highlights the quote in supporting browsers. */
export function originalLink(url: string, quote?: string): string {
  if (!quote) return url;
  const words = quote.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (words.length < 3) return url;
  const base = url.split("#")[0];
  const frag = words.length <= 8 ? fragmentPart(words.join(" ")) : `${fragmentPart(words.slice(0, 4).join(" "))},${fragmentPart(words.slice(-4).join(" "))}`;
  return `${base}#:~:text=${frag}`;
}

export function sourceLabel(s: SourceView | undefined): string {
  if (!s) return "Unknown source";
  if (s.title) return s.title;
  if (s.url) {
    try {
      return new URL(s.url).hostname.replace(/^www\./, "");
    } catch {
      return s.url;
    }
  }
  return s.fileName ?? s.alias;
}

export function sourceDateText(s: SourceView): string {
  if (s.modifiedAt && s.publishedAt && s.modifiedAt.slice(0, 10) !== s.publishedAt.slice(0, 10)) return `Published ${formatDate(s.publishedAt)} · updated ${formatDate(s.modifiedAt)}`;
  if (s.publishedAt) return `Dated ${formatDate(s.publishedAt)}`;
  if (s.modifiedAt) return `Updated ${formatDate(s.modifiedAt)}`;
  return "Undated";
}

export function SourceChip({ source, className }: { source: SourceView | undefined; className?: string }) {
  if (!source) return null;
  const Icon = source.type === "pdf" ? FileText : source.official ? Landmark : Globe;
  return (
    <span className={cn("inline-flex max-w-full items-center gap-1.5 rounded-md border bg-muted/50 px-2 py-0.5 text-xs", className)} title={source.url ?? source.fileName ?? undefined}>
      <span className="font-mono text-[10px] font-semibold text-brand">{source.alias}</span>
      <Icon className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="truncate">{sourceLabel(source)}</span>
      <span className="shrink-0 text-muted-foreground">· {sourceDateText(source)}</span>
    </span>
  );
}

export function HighlightedQuote({ context, quote }: { context: QuoteContext | null; quote: string }) {
  return (
    <blockquote className="rounded-md border-l-2 border-emerald-400 bg-emerald-50/40 px-3 py-2 text-[13px] leading-relaxed text-muted-foreground">
      {context ? (
        <>
          {context.before}
          <mark className="rounded-sm bg-emerald-100 px-0.5 text-foreground">{context.match}</mark>
          {context.after}
        </>
      ) : (
        <mark className="rounded-sm bg-emerald-100 px-0.5 text-foreground">{quote}</mark>
      )}
    </blockquote>
  );
}

/** One piece of evidence: which source, the verified quote highlighted in context, and a link to the original. */
export function EvidenceItem({ evidence, view, compact = false }: { evidence: EvidenceRef; view: SessionView; compact?: boolean }) {
  const source = view.sources.find((s) => s.id === evidence.sourceId);
  const claim = evidence.claimId ? view.claims.find((c) => c.id === evidence.claimId) : undefined;
  const context = claim?.context ?? view.evidenceContext[evidenceKey(evidence.sourceId, evidence.quote)] ?? null;
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <SourceChip source={source} />
        {context && <FindingBadge kind="verified" className="py-0 text-[11px]" />}
        {source?.url && (
          <a href={originalLink(source.url, evidence.quote)} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-xs text-brand hover:underline">
            Open original <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        )}
      </div>
      {!compact && <HighlightedQuote context={context} quote={evidence.quote} />}
      {compact && <p className="text-xs italic text-muted-foreground">“{evidence.quote}”</p>}
    </div>
  );
}

export function SeverityPill({ severity }: { severity: "high" | "medium" | "low" | null | undefined }) {
  if (!severity) return null;
  const cls = severity === "high" ? "bg-red-600 text-white" : severity === "medium" ? "bg-amber-500 text-white" : "bg-zinc-200 text-zinc-700";
  return <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", cls)}>{severity}</span>;
}
