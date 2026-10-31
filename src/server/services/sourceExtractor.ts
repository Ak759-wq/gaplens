import "server-only";
import { createHash } from "node:crypto";
import { checkUrl } from "@/lib/url-safety";
import { MAX_PDF_BYTES } from "@/lib/validation";
import { findLabelledDates, pickDates, type PickedDates } from "@/server/extract/dates";
import { htmlToDocument, normalizeText } from "@/server/extract/html";
import { extractPdf } from "@/server/extract/pdf";
import { assertPublicHost, decodeBody, FetchBlockedError, safeFetch } from "@/server/net/safeFetch";

export { assertPublicHost };

export type ExtractionProvider = "firecrawl" | "jina" | "direct" | "pdf-parse";

/** Hard cap on stored text per source (characters). Longer documents are truncated with a warning. */
export const MAX_SOURCE_CHARS = 300_000;
/** Below this many characters an extraction is treated as failed (JS-only shells, error pages). */
export const MIN_SOURCE_CHARS = 200;

export type ExtractedDocument = {
  provider: ExtractionProvider;
  finalUrl: string | null;
  title: string | null;
  text: string;
  publishedAt: string | null;
  modifiedAt: string | null;
  /** Where each date came from (e.g. 'meta article:modified_time'). Empty when undated. */
  dateEvidence: string[];
  contentSha256: string;
  retrievedAt: string;
  warnings: string[];
  pages?: number;
};

export class ExtractionError extends Error {
  readonly attempts: string[];
  constructor(message: string, attempts: string[] = []) {
    super(message);
    this.name = "ExtractionError";
    this.attempts = attempts;
  }
}

export type ExtractDeps = {
  env?: NodeJS.ProcessEnv;
  now?: Date;
  /** Test seam for provider HTTP calls (Firecrawl/Jina) and direct fetches. */
  fetchImpl?: typeof fetch;
  lookupImpl?: Parameters<typeof assertPublicHost>[1];
  timeoutMs?: number;
};

type Partial = { provider: ExtractionProvider; title: string | null; text: string; dates: PickedDates; finalUrl: string | null; pages?: number; warnings?: string[] };

function finalize(p: Partial, now: Date): ExtractedDocument {
  const warnings = [...(p.warnings ?? [])];
  let text = p.text;
  if (text.length > MAX_SOURCE_CHARS) {
    text = text.slice(0, MAX_SOURCE_CHARS);
    warnings.push(`Text truncated to the first ${MAX_SOURCE_CHARS.toLocaleString("en")} characters.`);
  }
  if (!p.dates.publishedAt && !p.dates.modifiedAt) warnings.push("No publication or update date found in the source (undated, not necessarily outdated).");
  if (!p.title) warnings.push("No title found in the source.");
  const today = now.toISOString().slice(0, 10);
  if ([p.dates.publishedAt, p.dates.modifiedAt].some((d) => d?.slice(0, 10) === today)) {
    warnings.push("The stated date equals the retrieval day; some sites generate this dynamically, so treat it with caution.");
  }
  return {
    provider: p.provider,
    finalUrl: p.finalUrl,
    title: p.title,
    text,
    publishedAt: p.dates.publishedAt,
    modifiedAt: p.dates.modifiedAt,
    dateEvidence: p.dates.evidence,
    contentSha256: createHash("sha256").update(text).digest("hex"),
    retrievedAt: now.toISOString(),
    warnings,
    pages: p.pages,
  };
}

/** Strip markdown link/image/emphasis syntax so verbatim quotes match what a reader sees. */
export function markdownToText(md: string): string {
  return normalizeText(
    md
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]*)\]\((?:[^()]|\([^)]*\))*\)/g, "$1")
      .replace(/^\s{0,3}#{1,6}\s+/gm, "")
      .replace(/(\*\*|__)(.+?)\1/g, "$2")
      .replace(/^\s*[-*_]{3,}\s*$\n?/gm, "")
      .replace(/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$\n?/gm, ""),
  );
}

function textDates(text: string, extra: Parameters<typeof pickDates>[0], now: Date): PickedDates {
  const c = [...extra];
  for (const hit of findLabelledDates(text).slice(0, 10)) c.push({ kind: hit.kind, iso: hit.parsed.iso, evidence: `page text "${hit.match.slice(0, 80)}"` });
  return pickDates(c, now);
}

async function viaFirecrawl(url: string, key: string, deps: ExtractDeps, now: Date): Promise<Partial> {
  const f = deps.fetchImpl ?? fetch;
  const res = await f("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true, timeout: 20_000 }),
    signal: AbortSignal.timeout(deps.timeoutMs ?? 25_000),
  });
  if (!res.ok) throw new Error(`Firecrawl HTTP ${res.status}`);
  const body = (await res.json()) as { success?: boolean; data?: { markdown?: string; metadata?: Record<string, unknown> } };
  const md = body.data?.markdown ?? "";
  const meta = body.data?.metadata ?? {};
  const s = (k: string) => (typeof meta[k] === "string" ? (meta[k] as string) : null);
  const text = markdownToText(md);
  return {
    provider: "firecrawl",
    title: s("title") ?? s("ogTitle"),
    text,
    finalUrl: s("sourceURL") ?? url,
    dates: textDates(text, [
      { kind: "published", iso: s("publishedTime") ?? s("article:published_time"), evidence: "Firecrawl metadata publishedTime" },
      { kind: "updated", iso: s("modifiedTime") ?? s("article:modified_time"), evidence: "Firecrawl metadata modifiedTime" },
    ], now),
  };
}

async function viaJina(url: string, key: string | undefined, deps: ExtractDeps, now: Date): Promise<Partial> {
  const f = deps.fetchImpl ?? fetch;
  const headers: Record<string, string> = { Accept: "application/json", "X-Return-Format": "markdown", "X-Timeout": "20" };
  if (key) headers.Authorization = `Bearer ${key}`;
  const res = await f(`https://r.jina.ai/${url}`, { headers, signal: AbortSignal.timeout(deps.timeoutMs ?? 25_000) });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Jina Reader HTTP ${res.status}${/bad IP reputation/i.test(detail) ? " (anonymous access blocked; set JINA_API_KEY)" : ""}`);
  }
  const body = (await res.json()) as { data?: { title?: string; content?: string; url?: string; publishedTime?: string } };
  const text = markdownToText(body.data?.content ?? "");
  // Some sites stamp every response with the current time; a "published" date equal to the
  // retrieval day is treated as unknown rather than as evidence the page is fresh.
  let published = body.data?.publishedTime ?? null;
  const warnings: string[] = [];
  if (published && published.slice(0, 10) === now.toISOString().slice(0, 10)) {
    warnings.push(`Ignored a reader-reported publication date equal to the retrieval day (${published.slice(0, 10)}); it is probably generated dynamically.`);
    published = null;
  }
  return {
    provider: "jina",
    title: body.data?.title?.trim() || null,
    text,
    finalUrl: body.data?.url ?? url,
    dates: textDates(text, [{ kind: "published", iso: published, evidence: "Jina Reader publishedTime" }], now),
    warnings,
  };
}

async function viaDirect(url: string, deps: ExtractDeps, now: Date): Promise<Partial> {
  const r = await safeFetch(url, { fetchImpl: deps.fetchImpl, lookupImpl: deps.lookupImpl, timeoutMs: deps.timeoutMs ?? 20_000, maxBytes: MAX_PDF_BYTES });
  const ct = r.contentType.toLowerCase();
  const isPdf = ct.includes("application/pdf") || (r.bytes[0] === 0x25 && r.bytes[1] === 0x50 && r.bytes[2] === 0x44 && r.bytes[3] === 0x46);
  if (isPdf) {
    if (r.truncated) throw new Error(`PDF exceeds ${Math.round(MAX_PDF_BYTES / 1024 / 1024)} MB.`);
    const pdf = await extractPdf(r.bytes, { now });
    return { provider: "pdf-parse", title: pdf.title, text: pdf.text, dates: pdf.dates, finalUrl: r.finalUrl, pages: pdf.pages };
  }
  if (!ct.includes("html") && !ct.includes("xml") && !ct.startsWith("text/") && ct !== "") {
    throw new Error(`Unsupported content type "${ct.split(";")[0]}".`);
  }
  const html = decodeBody(r.bytes, ct);
  if (ct.startsWith("text/plain")) {
    const text = normalizeText(html);
    return { provider: "direct", title: null, text, finalUrl: r.finalUrl, dates: textDates(text, [], now) };
  }
  const doc = htmlToDocument(html, { now, lastModifiedHeader: r.headers.get("last-modified") });
  return { provider: "direct", title: doc.title, text: doc.text, dates: doc.dates, finalUrl: r.finalUrl, warnings: r.truncated ? ["Page larger than the download cap; only the first part was read."] : [] };
}

/**
 * Extract one URL. Order: Firecrawl (if FIRECRAWL_API_KEY) → Jina Reader (JINA_API_KEY optional)
 * → direct fetch with the SSRF-guarded client. PDF links go direct first (pdf-parse gives better
 * metadata). When a reader service returns text without any date, a best-effort direct fetch
 * looks for metadata dates only.
 */
export async function extractUrl(input: string, deps: ExtractDeps = {}): Promise<ExtractedDocument> {
  const env = deps.env ?? process.env;
  const now = deps.now ?? new Date();
  const checked = checkUrl(input);
  if (!checked.ok) throw new ExtractionError(checked.reason);
  const url = checked.normalized;
  // DNS-level SSRF check up front, for every provider (reader services fetch on our behalf).
  try {
    await assertPublicHost(checked.url.hostname, deps.lookupImpl);
  } catch (e) {
    throw new ExtractionError((e as Error).message);
  }

  const firecrawlKey = env.FIRECRAWL_API_KEY?.trim();
  const jinaKey = env.JINA_API_KEY?.trim();
  const looksPdf = /\.pdf($|\?)/i.test(checked.url.pathname + checked.url.search);
  const order: ExtractionProvider[] = looksPdf
    ? ["direct", ...(firecrawlKey ? (["firecrawl"] as const) : []), "jina"]
    : [...(firecrawlKey ? (["firecrawl"] as const) : []), "jina", "direct"];

  const attempts: string[] = [];
  for (const p of order) {
    try {
      const r =
        p === "firecrawl" ? await viaFirecrawl(url, firecrawlKey!, deps, now)
        : p === "jina" ? await viaJina(url, jinaKey, deps, now)
        : await viaDirect(url, deps, now);
      if (r.text.length < MIN_SOURCE_CHARS) {
        attempts.push(`${p}: only ${r.text.length} characters of text (page may need JavaScript or be empty)`);
        continue;
      }
      if (!r.dates.publishedAt && !r.dates.modifiedAt && (p === "jina" || p === "firecrawl")) {
        try {
          const d = await viaDirect(url, { ...deps, timeoutMs: 8_000 }, now);
          if (d.dates.publishedAt || d.dates.modifiedAt) {
            r.dates = { ...d.dates, evidence: d.dates.evidence.map((e) => `${e} (from a direct fetch of the page)`) };
          }
        } catch {
          /* best effort */
        }
      }
      return finalize(r, now);
    } catch (e) {
      if (e instanceof FetchBlockedError) throw new ExtractionError(e.message, attempts);
      attempts.push(`${p}: ${(e as Error).message}`);
    }
  }
  throw new ExtractionError(`Could not extract readable text. ${attempts.join("; ")}`, attempts);
}

/** Extract an uploaded PDF. */
export async function extractPdfUpload(bytes: Uint8Array, deps: { now?: Date } = {}): Promise<ExtractedDocument> {
  const now = deps.now ?? new Date();
  if (bytes.byteLength > MAX_PDF_BYTES) throw new ExtractionError(`PDF exceeds ${Math.round(MAX_PDF_BYTES / 1024 / 1024)} MB.`);
  if (!(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) {
    throw new ExtractionError("File is not a valid PDF (missing %PDF header).");
  }
  let pdf;
  try {
    pdf = await extractPdf(bytes, { now });
  } catch (e) {
    throw new ExtractionError(`Could not read PDF: ${(e as Error).message}`);
  }
  if (pdf.text.length < MIN_SOURCE_CHARS) {
    throw new ExtractionError("PDF has little or no extractable text (it may be a scanned image; OCR is not supported).");
  }
  return finalize({ provider: "pdf-parse", title: pdf.title, text: pdf.text, dates: pdf.dates, finalUrl: null, pages: pdf.pages }, now);
}
