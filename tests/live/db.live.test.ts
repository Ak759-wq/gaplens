/**
 * Live Supabase integration test (service role). Skipped unless LIVE_DB=1:
 *   LIVE_DB=1 NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npx vitest run tests/live/db.live.test.ts
 * Creates one session, exercises every repository, then deletes it (cascade).
 */
import { describe, expect, it } from "vitest";
import { createSupabaseRepositories } from "@/server/db/supabaseRepositories";

describe.skipIf(process.env.LIVE_DB !== "1")("live Supabase repositories", () => {
  it("round-trips a session through every table and cascades on delete", async () => {
    const repos = createSupabaseRepositories();
    const s = await repos.sessions.create({ owner_id: null, topic: "GapLens live DB test", question: "Does the database round-trip work?", objective: "", status: "draft", error_message: null } as never);
    try {
      const [src] = await repos.sources.addMany([
        { session_id: s.id, source_type: "url", url: "https://example.org/live-test", file_name: null, title: null, published_at: null, retrieved_at: null, extraction_status: "pending", extraction_provider: null, extraction_error: null, content_text: null, content_sha256: null },
      ]);
      const updated = await repos.sources.update(src!.id, {
        extraction_status: "extracted", extraction_provider: "direct", content_text: "Applications close on 31 October 2026.", title: "Live test", metadata: { provider: "direct", dateEvidence: [] },
      });
      expect(updated.extraction_status).toBe("extracted");
      const [c] = await repos.claims.addMany([{ session_id: s.id, source_id: src!.id, text: "Deadline", quote: "Applications close on 31 October 2026.", category: "date_deadline", claim_date: "2026-10-31", char_start: 0, char_end: 38, quote_verified: true }]);
      const f = await repos.findings.replaceType(s.id, "gap", [{ session_id: s.id, type: "gap", label: "potential_gap", severity: "high", title: "t", description: "d", evidence: { claim_ids: [c!.id] }, payload: { kind: "topic" } }]);
      const [item] = await repos.checklist.replaceForSession(s.id, [{ session_id: s.id, action: "Confirm", priority: "high", rationale: "r", finding_ids: [f[0]!.id], done: false, position: 0 }]);
      expect(await repos.checklist.setDone(s.id, item!.id, true)).toBe(true);
      await repos.reports.save({ session_id: s.id, model: "test", coverage_overview: "", report: { ok: true } });
      await repos.sessions.updateStatus(s.id, "complete");
      const list = await repos.sessions.list({ limit: 5 });
      const mine = list.find((x) => x.id === s.id)!;
      expect(mine.source_count).toBe(1);
      expect(mine.finding_count).toBe(1);
      expect((await repos.reports.latestForSession(s.id))?.model).toBe("test");
    } finally {
      expect(await repos.sessions.delete(s.id)).toBe(true);
    }
    expect(await repos.claims.listBySession(s.id)).toEqual([]);
  }, 60_000);
});
