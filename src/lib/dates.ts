/**
 * Date helpers. Provenance rule: an UNDATED source is never treated as OUTDATED.
 * Missing dates are represented as `null` and surfaced as "Undated", not guessed.
 */

export function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Whole days between two dates (b - a), floored. */
export function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}

export type AgeBucket = "undated" | "recent" | "aging" | "stale";

/**
 * Bucket a source's age relative to `now`. Thresholds are defaults; the freshness analyser
 * will make them topic-aware in Phase 3. `undated` is a distinct state, NOT `stale`.
 */
export function ageBucket(
  publishedAt: Date | null,
  now: Date = new Date(),
  thresholds = { agingDays: 180, staleDays: 365 },
): AgeBucket {
  if (!publishedAt) return "undated";
  const age = daysBetween(publishedAt, now);
  if (age >= thresholds.staleDays) return "stale";
  if (age >= thresholds.agingDays) return "aging";
  return "recent";
}

export function formatDate(value: string | Date | null | undefined, fallback = "—"): string {
  const d = value instanceof Date ? value : parseIsoDate(value ?? null);
  if (!d) return fallback;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(d);
}
