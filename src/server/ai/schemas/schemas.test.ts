import { describe, expect, it } from "vitest";
import {
  checklistItemSchema,
  claimExtractionOutputSchema,
  claimSchema,
  contradictionSchema,
  freshnessWarningSchema,
  gapSchema,
  reportSchema,
  sourceSchema,
} from "./index";

const ev = { claimId: "c1", sourceId: "s1", quote: "Applications close on 15 November." };

describe("sourceSchema", () => {
  it("allows null title/date (never invented)", () => {
    const r = sourceSchema.safeParse({
      id: "s1", sourceType: "url", url: "https://example.com", fileName: null,
      title: null, publishedAt: null, retrievedAt: null, extractionStatus: "pending", contentText: null,
    });
    expect(r.success).toBe(true);
  });
  it("requires a url for url sources and a fileName for pdf sources", () => {
    const base = { id: "s1", title: null, publishedAt: null, retrievedAt: null, extractionStatus: "pending", contentText: null };
    expect(sourceSchema.safeParse({ ...base, sourceType: "url", url: null, fileName: "x.pdf" }).success).toBe(false);
    expect(sourceSchema.safeParse({ ...base, sourceType: "pdf", url: null, fileName: null }).success).toBe(false);
  });
});

describe("claimSchema", () => {
  it("accepts every category and an optional date", () => {
    for (const category of ["fact", "claim", "date_deadline", "requirement", "condition", "procedure", "evidence"]) {
      expect(claimSchema.safeParse({ id: "c1", sourceId: "s1", text: "t", quote: "q", category }).success).toBe(true);
    }
    expect(claimSchema.safeParse({ id: "c1", sourceId: "s1", text: "t", quote: "q", category: "date_deadline", date: "2026-11-15" }).success).toBe(true);
  });
  it("rejects unknown categories, empty quotes and bad dates", () => {
    expect(claimSchema.safeParse({ id: "c1", sourceId: "s1", text: "t", quote: "q", category: "opinion" }).success).toBe(false);
    expect(claimSchema.safeParse({ id: "c1", sourceId: "s1", text: "t", quote: "", category: "fact" }).success).toBe(false);
    expect(claimSchema.safeParse({ id: "c1", sourceId: "s1", text: "t", quote: "q", category: "fact", date: "15th Nov" }).success).toBe(false);
  });
  it("LLM extraction output omits ids", () => {
    expect(claimExtractionOutputSchema.safeParse({ claims: [{ text: "t", quote: "q", category: "fact" }] }).success).toBe(true);
  });
});

describe("findings schemas", () => {
  it("contradiction needs at least two evidenced positions", () => {
    const one = { id: "x1", topic: "Deadline", description: "d", severity: "high", positions: [{ statement: "15 Nov", evidence: [ev] }] };
    expect(contradictionSchema.safeParse(one).success).toBe(false);
    const two = { ...one, positions: [...one.positions, { statement: "30 Nov", evidence: [{ ...ev, claimId: "c2", sourceId: "s2" }] }] };
    const parsed = contradictionSchema.parse(two);
    expect(parsed.possibleExplanations).toEqual([]);
  });
  it("freshness distinguishes undated from outdated", () => {
    expect(freshnessWarningSchema.safeParse({ id: "f1", sourceId: "s1", reason: "undated", description: "No date", sourceDate: null, evidence: [] }).success).toBe(true);
    expect(freshnessWarningSchema.safeParse({ id: "f1", sourceId: "s1", reason: "old", description: "x", sourceDate: null, evidence: [] }).success).toBe(false);
  });
  it("gap and checklist item validate", () => {
    expect(gapSchema.safeParse({ id: "g1", title: "Renewal", description: "d", missingInformation: "GPA", severity: "medium", evidence: [], label: "potential_gap" }).success).toBe(true);
    expect(checklistItemSchema.safeParse({ id: "k1", action: "Confirm", priority: "high", rationale: "r", findingIds: [] }).success).toBe(false);
  });
  it("an empty report validates", () => {
    expect(
      reportSchema.safeParse({
        id: "r1", sessionId: "s", generatedAt: "2026-10-31T00:00:00Z", model: "m",
        brief: { topic: "t", question: "q", objective: "" }, coverageOverview: "",
        sources: [], claims: [], gaps: [], contradictions: [], freshnessWarnings: [], questions: [], checklist: [],
      }).success,
    ).toBe(true);
  });
});
