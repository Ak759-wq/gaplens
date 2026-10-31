import { describe, expect, it } from "vitest";
import { MAX_PDF_BYTES, checkPdfFile, researchBriefSchema, safeUrlSchema } from "./validation";

describe("researchBriefSchema", () => {
  it("accepts a valid brief and defaults objective", () => {
    const r = researchBriefSchema.parse({ topic: "Scholarships", question: "What is the deadline for 2026?" });
    expect(r.objective).toBe("");
  });
  it("rejects a too-short question", () => {
    expect(researchBriefSchema.safeParse({ topic: "Scholarships", question: "When?" }).success).toBe(false);
  });
});

describe("safeUrlSchema", () => {
  it("normalises valid URLs and rejects SSRF targets", () => {
    expect(safeUrlSchema.parse("  https://example.com/a#b ")).toBe("https://example.com/a");
    expect(safeUrlSchema.safeParse("http://169.254.169.254/").success).toBe(false);
  });
});

describe("checkPdfFile", () => {
  it("accepts PDFs within the size limit", () => {
    expect(checkPdfFile({ name: "a.pdf", type: "application/pdf", size: 1000 }).ok).toBe(true);
    expect(checkPdfFile({ name: "a.PDF", type: "", size: 1000 }).ok).toBe(true);
  });
  it("rejects wrong types, empty and oversized files", () => {
    expect(checkPdfFile({ name: "a.docx", type: "application/msword", size: 1000 }).ok).toBe(false);
    expect(checkPdfFile({ name: "a.pdf", type: "application/pdf", size: 0 }).ok).toBe(false);
    expect(checkPdfFile({ name: "a.pdf", type: "application/pdf", size: MAX_PDF_BYTES + 1 }).ok).toBe(false);
  });
});
