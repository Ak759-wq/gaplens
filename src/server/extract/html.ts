import * as cheerio from "cheerio";
import type { AnyNode, Element } from "domhandler";
import { findLabelledDates, pickDates, type PickedDates } from "./dates";

/**
 * Readability-style HTML → text extraction (no network, pure, unit-tested with fixtures).
 * - Drops scripts, styles, navigation, headers/footers, forms and hidden elements.
 * - Prefers <main>/<article>/[role=main] when it holds most of the text.
 * - Keeps tables as "cell | cell" rows (eligibility/amount tables matter for gap detection).
 * - Title: og:title → <title> → first <h1>. Never invented; null when absent.
 * - Dates: meta (article:published_time, article:modified_time, og:updated_time, DC.date, date,
 *   last-modified), itemprop, JSON-LD datePublished/dateModified (incl. @graph), then visible
 *   "Last updated: …" / "Published on …" text.
 */

export type HtmlDocument = {
  title: string | null;
  text: string;
  dates: PickedDates;
  lang: string | null;
};

const DROP = "script,style,noscript,template,svg,canvas,iframe,form,button,select,input,textarea,nav,header,footer,aside,[hidden],[aria-hidden=true],.skip-link,.sr-only,.visually-hidden,#cookie-banner,.cookie-banner";
const BLOCK = new Set([
  "p", "div", "section", "article", "main", "li", "ul", "ol", "dl", "dt", "dd", "h1", "h2", "h3", "h4", "h5", "h6",
  "blockquote", "pre", "table", "tr", "thead", "tbody", "tfoot", "br", "hr", "figure", "figcaption", "address", "details", "summary",
]);

function collapse(s: string): string {
  return s.replace(/[\u00a0\t ]+/g, " ").trim();
}

function nodeText($: cheerio.CheerioAPI, root: AnyNode): string {
  const out: string[] = [];
  const walk = (node: AnyNode) => {
    if (node.type === "text") {
      out.push((node as unknown as { data: string }).data);
      return;
    }
    if (node.type !== "tag") return;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    if (tag === "table") {
      out.push("\n");
      $(el)
        .find("tr")
        .each((_, tr) => {
          const cells = $(tr)
            .children("th,td")
            .map((__, c) => collapse($(c).text()))
            .get()
            .filter(Boolean);
          if (cells.length) out.push(cells.join(" | ") + "\n");
        });
      out.push("\n");
      return;
    }
    const block = BLOCK.has(tag);
    if (block) out.push("\n");
    if (tag === "li") out.push("- ");
    for (const child of el.children) walk(child);
    if (block) out.push("\n");
  };
  walk(root);
  return out.join("");
}

export function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => collapse(l))
    .filter((l, i, arr) => l.length > 0 || (i > 0 && arr[i - 1] !== ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function jsonLdDates($: cheerio.CheerioAPI): { published?: string; modified?: string } {
  const out: { published?: string; modified?: string } = {};
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).text());
      const items: unknown[] = Array.isArray(data) ? data : [data];
      const stack = [...items];
      while (stack.length) {
        const it = stack.pop() as Record<string, unknown> | null;
        if (!it || typeof it !== "object") continue;
        if (Array.isArray(it["@graph"])) stack.push(...(it["@graph"] as unknown[]));
        if (!out.published && typeof it.datePublished === "string") out.published = it.datePublished;
        if (!out.modified && typeof it.dateModified === "string") out.modified = it.dateModified;
      }
    } catch {
      /* malformed JSON-LD is common; ignore */
    }
  });
  return out;
}

export function htmlToDocument(html: string, opts: { now?: Date; lastModifiedHeader?: string | null } = {}): HtmlDocument {
  const $ = cheerio.load(html);
  const meta = (sel: string) => $(sel).first().attr("content")?.trim() || null;

  const title =
    collapse(meta('meta[property="og:title"]') ?? "") ||
    collapse($("title").first().text()) ||
    collapse($("h1").first().text()) ||
    null;

  const ld = jsonLdDates($);
  const candidates: { kind: "published" | "updated"; iso: string | null | undefined; evidence: string }[] = [
    { kind: "published", iso: meta('meta[property="article:published_time"]'), evidence: "meta article:published_time" },
    { kind: "published", iso: ld.published, evidence: "JSON-LD datePublished" },
    { kind: "published", iso: $('[itemprop="datePublished"]').first().attr("content") ?? $('[itemprop="datePublished"]').first().attr("datetime"), evidence: "itemprop datePublished" },
    { kind: "published", iso: meta('meta[name="DC.date.issued"]') ?? meta('meta[name="dc.date"]') ?? meta('meta[name="DC.date"]'), evidence: "meta DC.date" },
    { kind: "published", iso: meta('meta[name="date"]') ?? meta('meta[name="publish-date"]') ?? meta('meta[name="pubdate"]'), evidence: "meta date" },
    { kind: "updated", iso: meta('meta[property="article:modified_time"]'), evidence: "meta article:modified_time" },
    { kind: "updated", iso: meta('meta[property="og:updated_time"]'), evidence: "meta og:updated_time" },
    { kind: "updated", iso: ld.modified, evidence: "JSON-LD dateModified" },
    { kind: "updated", iso: $('[itemprop="dateModified"]').first().attr("content") ?? $('[itemprop="dateModified"]').first().attr("datetime"), evidence: "itemprop dateModified" },
    { kind: "updated", iso: meta('meta[name="last-modified"]') ?? meta('meta[http-equiv="last-modified"]') ?? meta('meta[name="dcterms.modified"]'), evidence: "meta last-modified" },
  ];

  const lang = $("html").attr("lang")?.trim() || null;

  // Visible-text "Last updated" lines are often inside the footer we're about to drop; scan the full body first.
  const fullText = normalizeText(nodeText($, $("body").get(0) ?? $.root().get(0)!));
  for (const hit of findLabelledDates(fullText).slice(0, 10)) {
    candidates.push({ kind: hit.kind, iso: hit.parsed.iso, evidence: `page text "${hit.match.slice(0, 80)}"` });
  }

  $(DROP).remove();
  $("[style]").each((_, el) => {
    const st = ($(el).attr("style") ?? "").replace(/\s/g, "").toLowerCase();
    if (st.includes("display:none") || st.includes("visibility:hidden")) $(el).remove();
  });

  const bodyText = normalizeText(nodeText($, $("body").get(0) ?? $.root().get(0)!));
  let text = bodyText;
  const mainEl = $("main, article, [role=main]").toArray().sort((a, b) => $(b).text().length - $(a).text().length)[0];
  if (mainEl) {
    const mainText = normalizeText(nodeText($, mainEl));
    if (mainText.length >= 400 && mainText.length >= bodyText.length * 0.4) text = mainText;
  }
  if (!text) text = fullText;

  let dates = pickDates(candidates, opts.now);
  if (!dates.publishedAt && !dates.modifiedAt && opts.lastModifiedHeader) {
    // HTTP Last-Modified is weak evidence (often the server's build time): last resort only.
    dates = pickDates([{ kind: "updated", iso: opts.lastModifiedHeader, evidence: "HTTP Last-Modified header (weak evidence)" }], opts.now);
  }
  return { title: title ? title.slice(0, 500) : null, text, dates, lang };
}
