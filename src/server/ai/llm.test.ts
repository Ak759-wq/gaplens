import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ConfigError } from "./errors";
import { geminiGenerate, parseGeminiRetryAfter } from "./gemini";
import { createLlmClient, resolveLlmConfig } from "./llm";
import { zodToGeminiSchema } from "./zodToGeminiSchema";

const env = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;
const gemOk = (text: string) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }] }), { status: 200, headers: { "content-type": "application/json" } });

describe("resolveLlmConfig", () => {
  it("prefers Gemini when both keys exist (auto)", () => {
    expect(resolveLlmConfig(env({ GEMINI_API_KEY: "g", OPENROUTER_API_KEY: "o" })).provider).toBe("gemini");
  });
  it("honours LLM_PROVIDER when that key exists", () => {
    expect(resolveLlmConfig(env({ LLM_PROVIDER: "openrouter", GEMINI_API_KEY: "g", OPENROUTER_API_KEY: "o" })).provider).toBe("openrouter");
    expect(resolveLlmConfig(env({ LLM_PROVIDER: "openrouter", GEMINI_API_KEY: "g" })).provider).toBe("gemini");
  });
  it("uses GEMINI_MODEL or the default", () => {
    expect(resolveLlmConfig(env({ GEMINI_API_KEY: "g" })).model).toBe("gemini-2.5-flash");
    expect(resolveLlmConfig(env({ GEMINI_API_KEY: "g", GEMINI_MODEL: "gemini-2.0-flash" })).model).toBe("gemini-2.0-flash");
  });
  it("BYO key overrides server config", () => {
    const c = resolveLlmConfig(env({ GEMINI_API_KEY: "server" }), { provider: "openrouter", apiKey: "mine" });
    expect(c).toMatchObject({ provider: "openrouter", apiKey: "mine", keySource: "byo" });
  });
  it("throws a ConfigError (configuration required) with no keys", () => {
    expect(() => resolveLlmConfig(env({}))).toThrow(ConfigError);
    expect(() => resolveLlmConfig(env({}))).toThrow(/Configuration required/);
  });
});

describe("geminiGenerate", () => {
  it("authenticates with x-goog-api-key only and sends JSON mode + schema", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(gemOk('{"a":1}'));
    await geminiGenerate([{ role: "system", content: "sys" }, { role: "user", content: "hi" }], {
      apiKey: "KEY", model: "gemini-2.5-flash", responseSchema: { type: "OBJECT", properties: { a: { type: "NUMBER" } } }, fetchImpl,
    });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent");
    const headers = init!.headers as Record<string, string>;
    expect(headers["x-goog-api-key"]).toBe("KEY");
    expect(Object.keys(headers).map((h) => h.toLowerCase())).not.toContain("authorization");
    const body = JSON.parse(String(init!.body));
    expect(body.systemInstruction.parts[0].text).toBe("sys");
    expect(body.contents).toEqual([{ role: "user", parts: [{ text: "hi" }] }]);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.responseSchema.type).toBe("OBJECT");
    expect(body.generationConfig.temperature).toBeLessThanOrEqual(0.2);
  });

  it("falls back to gemini-2.0-flash on 404", async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('{"error":{"message":"model not found"}}', { status: 404 }))
      .mockResolvedValueOnce(gemOk("{}"));
    const r = await geminiGenerate([{ role: "user", content: "x" }], { apiKey: "k", model: "gemini-9", fetchImpl });
    expect(r.model).toBe("gemini-2.0-flash");
    expect(String(fetchImpl.mock.calls[1]![0])).toContain("gemini-2.0-flash:generateContent");
  });

  it("retries 429 RESOURCE_EXHAUSTED using RetryInfo, then surfaces long waits as rate_limited", async () => {
    const r429 = (delay: string) =>
      new Response(JSON.stringify({ error: { code: 429, status: "RESOURCE_EXHAUSTED", message: "quota", details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: delay }] } }), { status: 429 });
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(r429("0s")).mockResolvedValueOnce(gemOk("{}"));
    await expect(geminiGenerate([{ role: "user", content: "x" }], { apiKey: "k", model: "m", fetchImpl, baseDelayMs: 1 })).resolves.toBeTruthy();
    const slow = vi.fn<typeof fetch>().mockResolvedValue(r429("45s"));
    await expect(geminiGenerate([{ role: "user", content: "x" }], { apiKey: "k", model: "m", fetchImpl: slow, maxWaitMs: 1000 })).rejects.toMatchObject({ code: "rate_limited", retryAfterSec: 45 });
  });

  it("drops responseSchema once if Gemini rejects it", async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('{"error":{"message":"Invalid JSON payload: responseSchema unsupported"}}', { status: 400 }))
      .mockResolvedValueOnce(gemOk("{}"));
    await geminiGenerate([{ role: "user", content: "x" }], { apiKey: "k", model: "m", responseSchema: { type: "OBJECT" }, fetchImpl });
    expect(JSON.parse(String(fetchImpl.mock.calls[1]![1]!.body)).generationConfig.responseSchema).toBeUndefined();
  });

  it("maps an invalid key to an auth error", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response('{"error":{"message":"API key not valid. Please pass a valid API key."}}', { status: 400 }));
    await expect(geminiGenerate([{ role: "user", content: "x" }], { apiKey: "bad", model: "m", fetchImpl })).rejects.toMatchObject({ code: "auth" });
  });

  it("parses RetryInfo", () => {
    expect(parseGeminiRetryAfter({ error: { details: [{ "@type": "x.RetryInfo", retryDelay: "12.3s" }] } }, null)).toBe(13);
    expect(parseGeminiRetryAfter(null, "7")).toBe(7);
  });
});

describe("createLlmClient.generate", () => {
  it("validates with zod and retries once with the error fed back", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(gemOk('{"n":"three"}')).mockResolvedValueOnce(gemOk('{"n":3}'));
    const client = createLlmClient({ provider: "gemini", apiKey: "k", model: "gemini-2.5-flash", keySource: "server" }, { fetchImpl });
    await expect(client.generate([{ role: "user", content: "x" }], z.object({ n: z.number() }))).resolves.toEqual({ n: 3 });
    const second = JSON.parse(String(fetchImpl.mock.calls[1]![1]!.body));
    expect(second.contents.at(-1).parts[0].text).toMatch(/did not match the required schema/);
  });
});

describe("zodToGeminiSchema", () => {
  it("converts objects, enums, optionals and arrays", () => {
    const s = zodToGeminiSchema(z.object({ a: z.string(), b: z.enum(["x", "y"]).optional(), c: z.array(z.number().int()), d: z.string().nullable() }));
    expect(s).toEqual({
      type: "OBJECT",
      properties: { a: { type: "STRING" }, b: { type: "STRING", format: "enum", enum: ["x", "y"] }, c: { type: "ARRAY", items: { type: "INTEGER" } }, d: { type: "STRING", nullable: true } },
      required: ["a", "c", "d"],
      propertyOrdering: ["a", "b", "c", "d"],
    });
    expect(zodToGeminiSchema(z.union([z.string(), z.number()]))).toBeNull();
  });
});
