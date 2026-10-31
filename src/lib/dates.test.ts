import { describe, expect, it } from "vitest";
import { ageBucket, parseIsoDate } from "./dates";

describe("ageBucket", () => {
  const now = new Date("2026-10-31T00:00:00Z");
  it("treats a missing date as undated, never stale", () => {
    expect(ageBucket(null, now)).toBe("undated");
  });
  it("buckets by age", () => {
    expect(ageBucket(new Date("2026-09-01"), now)).toBe("recent");
    expect(ageBucket(new Date("2026-03-01"), now)).toBe("aging");
    expect(ageBucket(new Date("2025-01-01"), now)).toBe("stale");
  });
  it("parseIsoDate returns null for junk", () => {
    expect(parseIsoDate("not a date")).toBeNull();
  });
});
