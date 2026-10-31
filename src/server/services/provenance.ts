/**
 * Citation verification: a quote is only shown as evidence if it is found in the stored source text.
 * Matching is whitespace-, case- and quote-style-insensitive, and returns character offsets into the
 * ORIGINAL text so the UI can highlight the passage.
 */

function normalizeChar(c: string): string {
  if (/[\u2018\u2019\u201A\u201B\u2032]/.test(c)) return "'";
  if (/[\u201C\u201D\u201E\u201F\u2033]/.test(c)) return '"';
  if (/[\u2010-\u2015\u2212]/.test(c)) return "-";
  return c.toLowerCase();
}

/** Builds a normalised string plus a map from normalised index -> original index. */
function normalizeWithMap(text: string): { norm: string; map: number[] } {
  let norm = "";
  const map: number[] = [];
  let prevSpace = true;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (/\s/.test(ch)) {
      if (!prevSpace) {
        norm += " ";
        map.push(i);
        prevSpace = true;
      }
      continue;
    }
    norm += normalizeChar(ch);
    map.push(i);
    prevSpace = false;
  }
  if (norm.endsWith(" ")) {
    norm = norm.slice(0, -1);
    map.pop();
  }
  return { norm, map };
}

export type QuoteVerification =
  | { verified: true; start: number; end: number }
  | { verified: false };

export function verifyQuoteInSource(quote: string, sourceText: string): QuoteVerification {
  const q = normalizeWithMap(quote).norm;
  if (q.length === 0) return { verified: false };
  const { norm, map } = normalizeWithMap(sourceText);
  const idx = norm.indexOf(q);
  if (idx === -1) return { verified: false };
  const start = map[idx]!;
  const end = map[idx + q.length - 1]! + 1;
  return { verified: true, start, end };
}
