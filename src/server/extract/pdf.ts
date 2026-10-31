import "server-only";
import { findLabelledDates, pickDates, type PickedDates } from "./dates";
import { normalizeText } from "./html";

export type PdfDocument = { title: string | null; text: string; dates: PickedDates; pages: number };

/**
 * Extract text + metadata from a PDF with pdf-parse v2 (pdf.js). Dates come from visible
 * "Dated:/Last updated" text first, then the PDF Info dictionary (ModDate/CreationDate),
 * which records when the FILE was produced and is labelled as such.
 */
export async function extractPdf(bytes: Uint8Array, opts: { now?: Date } = {}): Promise<PdfDocument> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: bytes });
  try {
    const textResult = await parser.getText();
    type InfoLike = { info?: Record<string, unknown>; getDateNode?: () => Record<string, Date | null | undefined> };
    let info: InfoLike | null = null;
    try {
      info = (await parser.getInfo()) as unknown as InfoLike;
    } catch {
      info = null;
    }
    // pdf-parse appends "-- n of m --" page markers; drop them.
    const text = normalizeText(textResult.text.replace(/^-- \d+ of \d+ --$/gm, ""));
    const rawTitle = typeof info?.info?.Title === "string" ? (info.info.Title as string).trim() : "";
    const dn = info?.getDateNode?.() ?? {};
    const iso = (d: Date | null | undefined) => (d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString() : null);

    const candidates: Parameters<typeof pickDates>[0] = [];
    for (const hit of findLabelledDates(text).slice(0, 10)) {
      candidates.push({ kind: hit.kind, iso: hit.parsed.iso, evidence: `document text "${hit.match.slice(0, 80)}"` });
    }
    candidates.push({ kind: "published", iso: iso(dn.CreationDate ?? dn.XmpCreateDate), evidence: "PDF metadata CreationDate (file creation)" });
    candidates.push({ kind: "updated", iso: iso(dn.ModDate ?? dn.XmpModifyDate), evidence: "PDF metadata ModDate (file modification)" });

    return {
      title: rawTitle && !/^(untitled|microsoft word|document\d*)/i.test(rawTitle) ? rawTitle.slice(0, 500) : null,
      text,
      dates: pickDates(candidates, opts.now),
      pages: textResult.total,
    };
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}
