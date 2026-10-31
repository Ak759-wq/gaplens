import { describe, expect, it } from "vitest";
import type { Claim, Source, TopicCoverage } from "@/server/ai/schemas";
import { chunkText, verifyModelQuote } from "./claimExtractor";
import { authorityNote, buildContradictionCandidates } from "./contradictionDetector";
import { analyzeFreshnessRules, currentCycleStart, findCycleMentions, sentenceAround } from "./freshnessAnalyzer";
import { normalizeTopics } from "./gapDetector";
import { AliasMap } from "./corpus";

const NOW = new Date("2026-10-31T00:00:00Z");
const src = (id: string, o: Partial<Source> = {}): Source => ({
  id, sourceType: "url", url: `https://${id}.example.org/`, fileName: null, title: id, publishedAt: null, retrievedAt: NOW.toISOString(),
  extractionStatus: "extracted", contentText: "", ...o,
});
const claim = (id: string, sourceId: string, o: Partial<Claim> = {}): Claim => ({ id, sourceId, text: id, quote: id, category: "fact", ...o });

describe("quote verification for model output", () => {
  const text = "Eligibility\nStudents with gross parental income up to Rs. 4.5 lakh per annum are eligible. Income certificate is required only for fresh applicants.";
  it("accepts verbatim quotes (whitespace/case-insensitive) and returns original offsets", () => {
    const r = verifyModelQuote("students with gross parental income up to Rs. 4.5 lakh per annum are eligible.", text);
    expect(r && text.slice(r.start, r.end)).toBe("Students with gross parental income up to Rs. 4.5 lakh per annum are eligible.");
  });
  it("rejects paraphrased or fabricated quotes", () => {
    expect(verifyModelQuote("Family income must be below 4.5 lakh.", text)).toBeNull();
    expect(verifyModelQuote("Students with gross parental income up to Rs. 6 lakh per annum are eligible.", text)).toBeNull();
  });
  it("salvages only a verbatim fragment from an ellipsis-joined quote", () => {
    const r = verifyModelQuote("Students with gross parental income up to Rs. 4.5 lakh … made-up continuation that is not in the text at all", text);
    expect(r?.quote).toBe("Students with gross parental income up to Rs. 4.5 lakh");
  });
});

describe("chunkText", () => {
  it("splits long text with overlap on boundaries and covers everything", () => {
    const para = "Sentence about eligibility and documents. ".repeat(40) + "\n\n";
    const text = para.repeat(30);
    const chunks = chunkText(text, 5000, 200);
    expect(chunks.length).toBeGreaterThan(5);
    expect(chunks[0]!.start).toBe(0);
    expect(chunks.at(-1)!.end).toBe(text.length);
    for (let i = 1; i < chunks.length; i++) expect(chunks[i]!.start).toBeLessThan(chunks[i - 1]!.end);
  });
  it("keeps short text in one chunk", () => {
    expect(chunkText("short")).toHaveLength(1);
  });
});

describe("contradiction pairing", () => {
  const claims = [
    claim("a1", "A", { category: "date_deadline" }),
    claim("a2", "A"),
    claim("b1", "B", { category: "date_deadline" }),
    claim("c1", "C"),
    claim("c2", "C", { category: "date_deadline" }),
  ];
  const topic = (key: string, ids: string[]): TopicCoverage => ({ id: key, key, label: key, whyItMatters: "", status: "covered", claimIds: ids, sourceIds: [] });

  it("only pairs claims across different sources, per topic", () => {
    const groups = buildContradictionCandidates([topic("amount", ["a2", "c1"]), topic("single", ["a1", "a2"])], claims);
    const amount = groups.find((g) => g.topicKey === "amount")!;
    expect(amount.pairCount).toBe(1);
    expect(groups.find((g) => g.topicKey === "single")).toBeUndefined(); // same source only
  });
  it("groups otherwise-unassigned deadline claims as a catch-all", () => {
    const groups = buildContradictionCandidates([topic("amount", ["a2", "c1"])], claims);
    const dates = groups.find((g) => g.topicKey === "dates_and_deadlines")!;
    expect(dates.claims.map((c) => c.id).sort()).toEqual(["a1", "b1", "c2"]);
    expect(dates.pairCount).toBe(3);
  });
  it("returns nothing when there is a single source", () => {
    expect(buildContradictionCandidates([topic("t", ["a1", "a2"])], claims.filter((c) => c.sourceId === "A"))).toEqual([]);
  });
  it("authority note states signals, never a verdict", () => {
    const note = authorityNote([src("A", { url: "https://scholarships.gov.in/x", publishedAt: "2026-06-01" }), src("B", { url: "https://blog.example.com/x", publishedAt: "2025-01-01" })]);
    expect(note).toMatch(/scholarships\.gov\.in is an official/);
    expect(note).toMatch(/most recent date \(2026-06-01\)/);
    expect(note).toMatch(/does not decide which source is correct/);
  });
});

describe("gap normalisation", () => {
  const ca = new AliasMap([claim("x1", "A"), claim("x2", "B")], "C");
  it("downgrades 'covered' without valid evidence and upgrades 'missing' with evidence", () => {
    const r = normalizeTopics(
      [
        { key: "Deadline", label: "Deadline", whyItMatters: "w", status: "covered", claimIds: ["C99"], severity: "high" },
        { key: "amount", label: "Amount", whyItMatters: "w", status: "missing", claimIds: ["C1"], severity: "medium" },
        { key: "income", label: "Income", whyItMatters: "w", status: "covered", claimIds: ["C2"], severity: "low" },
      ],
      ca,
    );
    expect(r.coverage.map((t) => [t.key, t.status])).toEqual([["deadline", "missing"], ["amount", "partial"], ["income", "covered"]]);
    expect(r.gaps.map((g) => g.label)).toEqual(["not_found_in_sources", "potential_gap"]);
    expect(r.gaps[0]!.description).toMatch(/Not found in the reviewed sources/);
    expect(r.gaps[1]!.evidence[0]!.claimId).toBe("x1");
  });
});

describe("freshness rules", () => {
  it("knows the current academic cycle", () => {
    expect(currentCycleStart(NOW)).toBe(2026);
    expect(currentCycleStart(new Date("2026-03-01T00:00:00Z"))).toBe(2025);
  });
  it("finds academic-year mentions but not ISO dates or unrelated ranges", () => {
    const m = findCycleMentions("For 2024-25 and 2025–2026. Dated 2024-12-01. Pages 2010-2015.");
    expect(m.map((x) => x.label)).toEqual(["2024-25", "2025-26"]);
    expect(findCycleMentions("applicable for academic year 2022-23 onwards")[0]!.openEnded).toBe(true);
  });
  it("labels undated sources as undated (never outdated)", () => {
    const w = analyzeFreshnessRules({ sources: [src("A", { contentText: "General info." })], claims: [] }, NOW);
    expect(w).toHaveLength(1);
    expect(w[0]!.reason).toBe("undated");
    expect(w[0]!.description).toMatch(/not the same as outdated/);
  });
  it("flags old dates, past cycles, expired deadlines and archival wording with verbatim evidence", () => {
    const text = "Applications for the academic year 2024-25 are invited.\nThe last date to apply is 31 October 2024.\nThis page has been superseded by the 2026 notice.";
    const w = analyzeFreshnessRules({ sources: [src("A", { publishedAt: "2024-07-01", contentText: text })], claims: [] }, NOW);
    const reasons = w.map((x) => x.reason).sort();
    expect(reasons).toEqual(["dated_old", "expired_deadline", "old_version", "references_past_cycle"]);
    for (const x of w) for (const e of x.evidence) expect(text).toContain(e.quote);
    expect(w.find((x) => x.reason === "references_past_cycle")!.severity).toBe("high");
  });
  it("does not flag a source whose deadlines include a future one, or an open-ended rule", () => {
    const text = "Applicable for academic year 2022-23 onwards.\nLast date for 2025-26 was 31 October 2025. Last date for 2026-27 is 30 November 2026.";
    const w = analyzeFreshnessRules({ sources: [src("A", { publishedAt: "2026-07-01", contentText: text })], claims: [] }, NOW);
    expect(w.map((x) => x.reason)).toEqual([]);
  });
  it("sentenceAround returns an exact substring", () => {
    const t = "First sentence. The deadline is 31 Oct 2024 for everyone. Last.";
    const s = sentenceAround(t, t.indexOf("deadline"), 8);
    expect(t).toContain(s);
    expect(s).toBe("The deadline is 31 Oct 2024 for everyone.");
  });
});
