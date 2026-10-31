import { describe, expect, it } from "vitest";
import { verifyQuoteInSource } from "./provenance";

describe("verifyQuoteInSource", () => {
  const text = "Notice:\n  Applications   close on 15 November.\nRenewal “may be granted” annually.";
  it("finds quotes despite whitespace, case and smart quotes and returns original offsets", () => {
    const r = verifyQuoteInSource("applications close on 15 November.", text);
    expect(r.verified).toBe(true);
    if (r.verified) expect(text.slice(r.start, r.end)).toBe("Applications   close on 15 November.");
    expect(verifyQuoteInSource('Renewal "may be granted"', text).verified).toBe(true);
  });
  it("rejects quotes not present (fabricated citations)", () => {
    expect(verifyQuoteInSource("Applications close on 30 November.", text).verified).toBe(false);
    expect(verifyQuoteInSource("   ", text).verified).toBe(false);
  });
});
