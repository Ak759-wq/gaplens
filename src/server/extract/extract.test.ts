import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findLabelledDates, parseLooseDate, pickDates } from "./dates";
import { htmlToDocument } from "./html";

const fixture = (n: string) => readFileSync(join(process.cwd(), "tests/fixtures", n), "utf8");
const NOW = new Date("2026-10-31T00:00:00Z");

describe("parseLooseDate", () => {
  it("parses common formats", () => {
    expect(parseLooseDate("2025-03-12")?.iso).toBe("2025-03-12");
    expect(parseLooseDate("2025-03-12T09:00:00+05:30")?.iso).toBe("2025-03-12");
    expect(parseLooseDate("12 March 2025")?.iso).toBe("2025-03-12");
    expect(parseLooseDate("12th Mar, 2025")?.iso).toBe("2025-03-12");
    expect(parseLooseDate("March 12, 2025")?.iso).toBe("2025-03-12");
    expect(parseLooseDate("12.03.2025")?.iso).toBe("2025-03-12");
  });
  it("reads DD/MM/YYYY by default and MM/DD only when forced, noting ambiguity", () => {
    const amb = parseLooseDate("05/03/2025");
    expect(amb?.iso).toBe("2025-03-05");
    expect(amb?.note).toMatch(/DD\/MM/);
    expect(parseLooseDate("03/25/2025")?.iso).toBe("2025-03-25");
  });
  it("rejects garbage and impossible dates", () => {
    expect(parseLooseDate("31/02/2025")).toBeNull();
    expect(parseLooseDate("soon")).toBeNull();
    expect(parseLooseDate("")).toBeNull();
  });
  it("finds labelled dates in text", () => {
    const hits = findLabelledDates("Footer\nLast Updated On: 10 Sep 2024\nPublished on 2024-01-05");
    expect(hits.map((h) => [h.kind, h.parsed.iso])).toEqual([
      ["updated", "2024-09-10"],
      ["published", "2024-01-05"],
    ]);
  });
  it("ignores future-dated metadata", () => {
    const d = pickDates([{ kind: "published", iso: "2030-01-01", evidence: "meta" }], NOW);
    expect(d.publishedAt).toBeNull();
  });
});

describe("htmlToDocument (fixtures)", () => {
  it("extracts main text, title and dates from a government page", () => {
    const doc = htmlToDocument(fixture("gov-scholarship.html"), { now: NOW });
    expect(doc.title).toBe("Post Matric Scholarship for SC Students");
    expect(doc.text).toContain("does not exceed Rs. 2,50,000 are eligible.");
    expect(doc.text).toContain("Group I | Rs. 13,500 | Rs. 7,000");
    expect(doc.text).not.toContain("Hidden promo");
    expect(doc.text).not.toContain("tracking");
    expect(doc.text).not.toContain("Screen Reader Access");
    expect(doc.text).not.toContain("Related links");
    expect(doc.dates.publishedAt).toBe("2024-07-01");
    // JSON-LD dateModified and footer "Last Updated: 12/03/2025" agree.
    expect(doc.dates.modifiedAt).toBe("2025-03-12");
    expect(doc.dates.evidence.join(" ")).toMatch(/article:published_time/);
  });
  it("leaves undated pages undated (never guesses)", () => {
    const doc = htmlToDocument(fixture("undated-blog.html"), { now: NOW });
    expect(doc.title).toBe("Top 10 Scholarships for Engineering Students");
    expect(doc.dates.publishedAt).toBeNull();
    expect(doc.dates.modifiedAt).toBeNull();
    expect(doc.text).toContain("income limit is Rs. 2.5 lakh per annum");
  });
  it("uses HTTP Last-Modified only as a last resort", () => {
    const undated = htmlToDocument(fixture("undated-blog.html"), { now: NOW, lastModifiedHeader: "Tue, 04 Feb 2025 10:00:00 GMT" });
    expect(undated.dates.modifiedAt).toBe("2025-02-04");
    expect(undated.dates.evidence[0]).toMatch(/weak evidence/);
    const dated = htmlToDocument(fixture("gov-scholarship.html"), { now: NOW, lastModifiedHeader: "Tue, 04 Feb 2026 10:00:00 GMT" });
    expect(dated.dates.modifiedAt).toBe("2025-03-12");
  });
});
