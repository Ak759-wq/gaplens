import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ConfigError } from "./errors";
import { chatCompletion, extractJson, getOpenRouterConfig, structuredCompletion } from "./openrouter";

const okResponse = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200, headers: { "content-type": "application/json" } });

describe("openrouter client", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("throws a clear ConfigError when OPENROUTER_API_KEY is missing", () => {
    expect(() => getOpenRouterConfig({} as NodeJS.ProcessEnv)).toThrow(ConfigError);
    expect(() => getOpenRouterConfig({} as NodeJS.ProcessEnv)).toThrow(/OPENROUTER_API_KEY/);
  });

  it("uses OPENROUTER_MODEL when set", () => {
    const cfg = getOpenRouterConfig({ OPENROUTER_API_KEY: "k", OPENROUTER_MODEL: "x/y" } as unknown as NodeJS.ProcessEnv);
    expect(cfg.model).toBe("x/y");
  });

  it("retries on 429 then succeeds", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("rate limited", { status: 429, headers: { "retry-after": "0" } }))
      .mockResolvedValueOnce(okResponse("hello"));
    await expect(chatCompletion([{ role: "user", content: "hi" }], { fetchImpl, baseDelayMs: 1 })).resolves.toBe("hello");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("validates structured output with zod and sends JSON mode", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(okResponse('```json\n{"n": 3}\n```'));
    const out = await structuredCompletion([{ role: "user", content: "x" }], z.object({ n: z.number() }), { fetchImpl });
    expect(out).toEqual({ n: 3 });
    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("extractJson handles fenced and padded output", () => {
    expect(extractJson('Sure! {"a":1} thanks')).toEqual({ a: 1 });
  });
});
