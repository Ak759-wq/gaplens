/**
 * Live extraction check against real public pages. Skipped unless LIVE=1:
 *   LIVE=1 npx vitest run tests/live/extract.live.test.ts
 * Writes a JSON summary to work/demo-extract.json (git-ignored) when DEMO_OUT is set.
 */
import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { analyzeFreshnessRules } from "@/server/services/freshnessAnalyzer";
import { extractUrl } from "@/server/services/sourceExtractor";

const URLS = (process.env.DEMO_URLS ?? "").split(/\s+/).filter(Boolean);

describe.skipIf(process.env.LIVE !== "1")("live extraction", () => {
  it("extracts real pages and runs deterministic freshness rules", async () => {
    const now = new Date();
    const results = [];
    for (const url of URLS) {
      try {
        const d = await extractUrl(url, { timeoutMs: 30_000 });
        results.push({ url, ok: true, provider: d.provider, title: d.title, publishedAt: d.publishedAt, modifiedAt: d.modifiedAt, dateEvidence: d.dateEvidence, chars: d.text.length, warnings: d.warnings, text: d.text });
      } catch (e) {
        results.push({ url, ok: false, error: (e as Error).message });
      }
    }
    const sources = results.map((r, i) => ({
      id: `s${i + 1}`,
      sourceType: "url" as const,
      url: r.url,
      fileName: null,
      title: "title" in r ? (r.title ?? null) : null,
      publishedAt: "publishedAt" in r ? (r.publishedAt ?? null) : null,
      modifiedAt: "modifiedAt" in r ? (r.modifiedAt ?? null) : null,
      retrievedAt: now.toISOString(),
      extractionStatus: r.ok ? ("extracted" as const) : ("failed" as const),
      contentText: "text" in r ? (r.text ?? null) : null,
      dateEvidence: "dateEvidence" in r ? r.dateEvidence : [],
    }));
    const warnings = analyzeFreshnessRules({ sources: sources.filter((s) => s.extractionStatus === "extracted"), claims: [] }, now);
    const summary = {
      ranAt: now.toISOString(),
      sources: results.map((r) => ({ ...r, text: undefined, excerpt: "text" in r ? r.text?.slice(0, 400) : undefined })),
      freshness: warnings.map((w) => ({ source: w.sourceId, reason: w.reason, severity: w.severity, description: w.description, evidence: w.evidence.map((e) => e.quote) })),
    };
    if (process.env.DEMO_OUT) writeFileSync(process.env.DEMO_OUT, JSON.stringify(summary, null, 2));
    expect(results.length).toBe(URLS.length);
  }, 300_000);
});
