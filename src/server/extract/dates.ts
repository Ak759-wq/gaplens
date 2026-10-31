/**
 * Loose date parsing for dates stated IN a source (metadata or visible text).
 * Never invents a date: anything that can't be parsed unambiguously-enough returns null.
 *
 * Numeric dates like 05/03/2025 are interpreted as DD/MM/YYYY (the convention on Indian sites,
 * GapLens' primary audience) unless the second part is > 12, in which case MM/DD/YYYY is the only
 * valid reading. Ambiguous interpretations are reported back in `note`.
 */

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11,
  dec: 12, december: 12,
};

export type ParsedDate = { iso: string; date: Date; note?: string };

function mk(y: number, m: number, d: number, note?: string): ParsedDate | null {
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1) return null; // e.g. 31 Feb
  return { iso: date.toISOString().slice(0, 10), date, note };
}

const MONTH_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";

/** Parse a single date expression. Returns null when not a recognisable full date. */
export function parseLooseDate(input: string | null | undefined): ParsedDate | null {
  if (!input) return null;
  const s = input.trim().replace(/\s+/g, " ");
  if (!s) return null;

  // ISO 8601 (date or datetime)
  let m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ][\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)?$/.exec(s);
  if (m) {
    const d = new Date(s.length > 10 ? s : `${s}T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) return mk(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()) ?? null;
  }
  // 12 March 2025 / 12th Mar, 2025 / 12-Mar-2025
  m = new RegExp(`^(\\d{1,2})(?:st|nd|rd|th)?[\\s\\-.,]+${MONTH_RE}\\.?[\\s\\-.,]+(\\d{4})$`, "i").exec(s);
  if (m) return mk(Number(m[3]), MONTHS[m[2]!.toLowerCase()]!, Number(m[1]));
  // March 12, 2025
  m = new RegExp(`^${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})$`, "i").exec(s);
  if (m) return mk(Number(m[3]), MONTHS[m[1]!.toLowerCase()]!, Number(m[2]));
  // 2025/03/12
  m = /^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/.exec(s);
  if (m) return mk(Number(m[1]), Number(m[2]), Number(m[3]));
  // 12/03/2025, 12-03-2025, 12.03.2025
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (b > 12 && a <= 12) return mk(Number(m[3]), a, b, "interpreted as MM/DD/YYYY");
    return mk(Number(m[3]), b, a, a <= 12 && b <= 12 && a !== b ? "interpreted as DD/MM/YYYY" : undefined);
  }
  // RFC 2822 / HTTP-date: "Tue, 12 Mar 2025 10:00:00 GMT"
  if (/^[a-z]{3}, \d{1,2} [a-z]{3} \d{4}/i.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return mk(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  return null;
}

/** A date-shaped token anywhere in text (used by the pattern scanners below). */
export const DATE_TOKEN_SRC = `(\\d{4}-\\d{2}-\\d{2}|\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{4}|\\d{1,2}(?:st|nd|rd|th)?[\\s\\-.,]+${MONTH_RE}\\.?[\\s\\-.,]+\\d{4}|${MONTH_RE}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4})`;

export type TextDateHit = {
  kind: "updated" | "published";
  parsed: ParsedDate;
  /** Exact substring of the input text (usable as verified evidence). */
  match: string;
  index: number;
};

const LABEL_PATTERNS: { kind: TextDateHit["kind"]; re: RegExp }[] = [
  { kind: "updated", re: new RegExp(`\\b(?:last\\s+(?:updated|modified|reviewed)|updated|modified|page\\s+last\\s+updated)(?:\\s+(?:on|at))?\\s*[:\\-–]?\\s*${DATE_TOKEN_SRC}`, "gi") },
  { kind: "published", re: new RegExp(`\\b(?:published|posted|released|issued|dated)(?:\\s+(?:on|at))?\\s*[:\\-–]?\\s*${DATE_TOKEN_SRC}`, "gi") },
];

/** Find explicitly labelled "Last updated: …" / "Published on …" dates in visible text. */
export function findLabelledDates(text: string): TextDateHit[] {
  const hits: TextDateHit[] = [];
  const sample = text.length > 400_000 ? text.slice(0, 200_000) + "\n" + text.slice(-200_000) : text;
  for (const { kind, re } of LABEL_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(sample))) {
      const parsed = parseLooseDate(m[1]);
      if (parsed) hits.push({ kind, parsed, match: m[0], index: m.index });
      if (hits.length > 50) break;
    }
  }
  return hits;
}

export type PickedDates = {
  publishedAt: string | null;
  modifiedAt: string | null;
  evidence: string[];
};

/**
 * Combine candidate dates. `now` guards against future-dated metadata (a common CMS artefact):
 * anything more than 2 days in the future is ignored rather than trusted.
 */
export function pickDates(
  candidates: { kind: "published" | "updated"; iso: string | null | undefined; evidence: string }[],
  now: Date = new Date(),
): PickedDates {
  const limit = now.getTime() + 2 * 86_400_000;
  let published: { iso: string; ev: string } | null = null;
  let modified: { iso: string; ev: string } | null = null;
  const evidence: string[] = [];
  for (const c of candidates) {
    const p = parseLooseDate(c.iso ?? null);
    if (!p || p.date.getTime() > limit) continue;
    const ev = p.note ? `${c.evidence} (${p.note})` : c.evidence;
    if (c.kind === "published" && !published) published = { iso: p.iso, ev };
    if (c.kind === "updated" && (!modified || p.iso > modified.iso)) modified = { iso: p.iso, ev };
  }
  if (published) evidence.push(`Published ${published.iso}: ${published.ev}`);
  if (modified) evidence.push(`Updated ${modified.iso}: ${modified.ev}`);
  return { publishedAt: published?.iso ?? null, modifiedAt: modified?.iso ?? null, evidence };
}
