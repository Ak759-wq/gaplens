import { describe, expect, it } from "vitest";
import { analysisStageSchema, checklistPatchSchema, claimsStageSchema, createSessionSchema } from "@/lib/api-schemas";
import { AIProviderError, ConfigError } from "@/server/ai/errors";
import { ApiError, errorResponse, parseId, readJson, readLlmOverride } from "./http";

const brief = { topic: "CSSS scholarship", question: "What is the deadline for 2026-27?", objective: "" };

describe("API request validation", () => {
  it("accepts a valid session and normalises URLs", () => {
    const r = createSessionSchema.parse({ brief, urls: ["https://scholarships.gov.in/x#frag"] });
    expect(r.urls).toEqual(["https://scholarships.gov.in/x"]);
    expect(r.pdfCount).toBe(0);
  });
  it("rejects unsafe, duplicate or too many URLs and bad briefs", () => {
    expect(createSessionSchema.safeParse({ brief, urls: ["http://127.0.0.1/admin"] }).success).toBe(false);
    expect(createSessionSchema.safeParse({ brief, urls: ["https://a.example.org/", "https://a.example.org/"] }).success).toBe(false);
    expect(createSessionSchema.safeParse({ brief, urls: Array.from({ length: 13 }, (_, i) => `https://s${i}.example.org/`) }).success).toBe(false);
    expect(createSessionSchema.safeParse({ brief, urls: ["https://a.example.org/"], pdfCount: 12 }).success).toBe(false);
    expect(createSessionSchema.safeParse({ brief: { ...brief, question: "short" }, urls: [] }).success).toBe(false);
  });
  it("validates stage names, claim requests and checklist patches", () => {
    expect(analysisStageSchema.safeParse("gaps").success).toBe(true);
    expect(analysisStageSchema.safeParse("summarise").success).toBe(false);
    expect(claimsStageSchema.safeParse({ sourceId: "not-a-uuid" }).success).toBe(false);
    expect(claimsStageSchema.parse({ sourceId: "0b5f6a43-1c38-4e3e-9d7f-4f7d9a0c1d2e" }).chunk).toBe(0);
    expect(checklistPatchSchema.safeParse({ done: "yes" }).success).toBe(false);
  });
  it("rejects non-UUID ids as not found and non-JSON bodies as bad requests", async () => {
    expect(() => parseId("../etc")).toThrow(ApiError);
    await expect(readJson(new Request("http://x", { method: "POST", body: "nope" }), checklistPatchSchema)).rejects.toMatchObject({ code: "bad_request" });
  });
});

describe("BYO key headers", () => {
  const req = (h: Record<string, string>) => new Request("http://x", { headers: h });
  it("reads provider, key and model; ignores absent keys", () => {
    expect(readLlmOverride(req({}))).toBeNull();
    expect(readLlmOverride(req({ "x-gaplens-llm-key": "AIza123" }))).toEqual({ provider: "gemini", apiKey: "AIza123", model: undefined });
    expect(readLlmOverride(req({ "x-gaplens-llm-key": "sk-or", "x-gaplens-llm-provider": "openrouter", "x-gaplens-llm-model": "openai/gpt-4o-mini" }))?.provider).toBe("openrouter");
  });
  it("rejects malformed values", () => {
    expect(() => readLlmOverride(req({ "x-gaplens-llm-key": "k", "x-gaplens-llm-provider": "anthropic" }))).toThrow(ApiError);
    expect(() => readLlmOverride(req({ "x-gaplens-llm-key": "k", "x-gaplens-llm-model": "bad model id!" }))).toThrow(ApiError);
  });
});

describe("error mapping", () => {
  it("maps config, rate-limit and auth errors without leaking details", async () => {
    const cfg = errorResponse(new ConfigError("Configuration required: x", ["GEMINI_API_KEY"]));
    expect(cfg.status).toBe(503);
    expect((await cfg.json()).error.code).toBe("config_required");
    const rl = errorResponse(new AIProviderError("quota", 429, { retryAfterSec: 40 }));
    expect(rl.status).toBe(429);
    expect((await rl.json()).error.retryAfterSec).toBe(40);
    const auth = errorResponse(new AIProviderError("API key not valid AIzaSECRET", 400, { code: "auth" }));
    const body = await auth.json();
    expect(body.error.code).toBe("llm_auth");
    expect(JSON.stringify(body)).not.toContain("AIzaSECRET");
    const other = errorResponse(new Error("db password=hunter2"));
    expect(other.status).toBe(500);
    expect(JSON.stringify(await other.json())).not.toContain("hunter2");
  });
});
