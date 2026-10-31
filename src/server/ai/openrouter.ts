import "server-only";
import type { z } from "zod";
import { DEFAULT_OPENROUTER_MODEL } from "@/lib/env";
import { AIProviderError, ConfigError } from "./errors";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type OpenRouterOptions = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  maxRetries?: number;
  /** Base backoff in ms; doubled each retry with jitter. */
  baseDelayMs?: number;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
};

export function getOpenRouterConfig(env: NodeJS.ProcessEnv = process.env) {
  const apiKey = env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new ConfigError(
      "OPENROUTER_API_KEY is not set. Add it to .env.local to enable AI analysis (see docs/ENV.md).",
      ["OPENROUTER_API_KEY"],
    );
  }
  return {
    apiKey,
    model: env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL,
    siteUrl: env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000",
  };
}

const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function retryDelay(attempt: number, base: number, retryAfter: string | null): number {
  const ra = retryAfter ? Number(retryAfter) : NaN;
  if (Number.isFinite(ra) && ra > 0) return Math.min(ra * 1000, 30_000);
  return Math.min(base * 2 ** attempt + Math.floor(Math.random() * base), 30_000);
}

/** Low-level chat completion. Returns the assistant message content string. */
export async function chatCompletion(
  messages: ChatMessage[],
  opts: OpenRouterOptions & { jsonMode?: boolean } = {},
): Promise<string> {
  const cfg = getOpenRouterConfig();
  const fetchImpl = opts.fetchImpl ?? fetch;
  const maxRetries = opts.maxRetries ?? 4;
  const base = opts.baseDelayMs ?? 800;

  const body = {
    model: opts.model ?? cfg.model,
    messages,
    temperature: opts.temperature ?? 0,
    max_tokens: opts.maxTokens ?? 4000,
    ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
  };

  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetchImpl(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": cfg.siteUrl,
          "X-Title": "GapLens",
        },
        body: JSON.stringify(body),
        signal: opts.signal,
      });
    } catch (err) {
      if (attempt < maxRetries && !opts.signal?.aborted) {
        await sleep(retryDelay(attempt, base, null));
        continue;
      }
      throw new AIProviderError(`OpenRouter request failed: ${(err as Error).message}`);
    }

    if (res.ok) {
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) {
        throw new AIProviderError("OpenRouter returned an empty completion.");
      }
      return content;
    }

    if (RETRYABLE.has(res.status) && attempt < maxRetries) {
      await sleep(retryDelay(attempt, base, res.headers.get("retry-after")));
      continue;
    }
    const detail = await res.text().catch(() => "");
    throw new AIProviderError(`OpenRouter error ${res.status}: ${detail.slice(0, 500)}`, res.status);
  }
}

/** Strip ```json fences some models add even in JSON mode. */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? text).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start !== -1 && end > start) return JSON.parse(candidate.slice(start, end + 1));
    throw new AIProviderError("Model output was not valid JSON.");
  }
}

/**
 * Structured completion: JSON mode + Zod validation. On a schema failure, retries once with
 * the validation error fed back to the model.
 */
export async function structuredCompletion<T extends z.ZodTypeAny>(
  messages: ChatMessage[],
  schema: T,
  opts: OpenRouterOptions = {},
): Promise<z.infer<T>> {
  let convo = messages;
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await chatCompletion(convo, { ...opts, jsonMode: true });
    const parsed = schema.safeParse(extractJson(raw));
    if (parsed.success) return parsed.data;
    convo = [
      ...messages,
      { role: "assistant", content: raw },
      {
        role: "user",
        content: `Your JSON did not match the required schema. Errors: ${parsed.error.message.slice(0, 1500)}. Return corrected JSON only.`,
      },
    ];
  }
  throw new AIProviderError("Model output failed schema validation twice.");
}
