import "server-only";
import { randomUUID } from "node:crypto";
import { buildClaimExtractionPrompt } from "@/server/ai/prompts";
import { claimsLlmSchema, type Claim, type Source } from "@/server/ai/schemas";
import { ConfigError } from "@/server/ai/errors";
import { parseLooseDate } from "@/server/extract/dates";
import { verifyQuoteInSource } from "./provenance";
import type { StageContext } from "./types";

/** ~6k tokens per chunk keeps each Gemini call well inside the 60s function budget. */
export const CLAIM_CHUNK_CHARS = 24_000;
export const CLAIM_CHUNK_OVERLAP = 400;
/** 14 × 24k covers the 300k-character MAX_SOURCE_CHARS cap, so no stored text goes unread. */
export const MAX_CLAIM_CHUNKS = 14;
const MAX_CLAIMS_PER_CHUNK = 40;

export type TextChunk = { index: number; start: number; end: number; text: string };

/** Split text into overlapping chunks, preferring paragraph / line / sentence boundaries. */
export function chunkText(text: string, size = CLAIM_CHUNK_CHARS, overlap = CLAIM_CHUNK_OVERLAP): TextChunk[] {
  if (text.length <= size) return [{ index: 0, start: 0, end: text.length, text }];
  const chunks: TextChunk[] = [];
  let start = 0;
  while (start < text.length && chunks.length < MAX_CLAIM_CHUNKS) {
    let end = Math.min(start + size, text.length);
    if (end < text.length) {
      const window = text.slice(start + Math.floor(size * 0.6), end);
      const cut = Math.max(window.lastIndexOf("\n\n"), window.lastIndexOf("\n"), window.lastIndexOf(". "));
      if (cut > 0) end = start + Math.floor(size * 0.6) + cut + 1;
    }
    chunks.push({ index: chunks.length, start, end, text: text.slice(start, end) });
    if (end >= text.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}

export type RejectedClaim = { text: string; quote: string; reason: "quote_not_found" | "duplicate" };
export type ClaimExtractionResult = {
  claims: Claim[];
  /** Claims the model returned whose quote could not be found in the source text (dropped). */
  rejected: RejectedClaim[];
  chunkIndex: number;
  chunksTotal: number;
};

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Verify a model quote against the full stored text. If the model joined fragments with an ellipsis,
 * the longest fragment (≥30 chars) is accepted only if IT is verbatim; the shown quote is then that
 * fragment, so nothing unverified is ever displayed.
 */
export function verifyModelQuote(quote: string, fullText: string): { quote: string; start: number; end: number } | null {
  const direct = verifyQuoteInSource(quote, fullText);
  if (direct.verified) return { quote: fullText.slice(direct.start, direct.end), start: direct.start, end: direct.end };
  const parts = quote.split(/\s*(?:\.{3}|…)\s*/).filter((p) => p.trim().length >= 30).sort((a, b) => b.length - a.length);
  for (const p of parts) {
    const r = verifyQuoteInSource(p, fullText);
    if (r.verified) return { quote: fullText.slice(r.start, r.end), start: r.start, end: r.end };
  }
  return null;
}

/** Extract claims from one chunk of one source. Quotes are verified; unverifiable claims are dropped. */
export async function extractClaims(source: Source, ctx: StageContext, chunkIndex = 0, alreadySeenQuotes: Set<string> = new Set()): Promise<ClaimExtractionResult> {
  if (!ctx.llm) throw new ConfigError("Configuration required: an AI provider key is needed for claim extraction.", ["GEMINI_API_KEY"]);
  const text = source.contentText ?? "";
  const chunks = chunkText(text);
  const chunk = chunks[chunkIndex];
  if (!chunk) return { claims: [], rejected: [], chunkIndex, chunksTotal: chunks.length };

  const out = await ctx.llm.generate(
    buildClaimExtractionPrompt(ctx.brief, { id: "S", title: source.title, text: chunk.text, part: { index: chunkIndex, total: chunks.length } }),
    claimsLlmSchema,
    { label: "Claim extraction", signal: ctx.signal, maxOutputTokens: 8192 },
  );

  const claims: Claim[] = [];
  const rejected: RejectedClaim[] = [];
  for (const c of out.claims.slice(0, MAX_CLAIMS_PER_CHUNK)) {
    const v = verifyModelQuote(c.quote, text);
    if (!v) {
      rejected.push({ text: c.text.slice(0, 300), quote: c.quote.slice(0, 300), reason: "quote_not_found" });
      continue;
    }
    const key = norm(v.quote);
    if (alreadySeenQuotes.has(key)) {
      rejected.push({ text: c.text.slice(0, 300), quote: v.quote.slice(0, 300), reason: "duplicate" });
      continue;
    }
    alreadySeenQuotes.add(key);
    const date = parseLooseDate(c.date ?? null)?.iso;
    claims.push({
      id: randomUUID(),
      sourceId: source.id,
      text: c.text.trim().slice(0, 1000),
      quote: v.quote.slice(0, 2000),
      category: c.category,
      ...(date ? { date } : {}),
      charStart: v.start,
      charEnd: v.end,
    });
  }
  return { claims, rejected, chunkIndex, chunksTotal: chunks.length };
}
