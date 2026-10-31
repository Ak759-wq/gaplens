import "server-only";
import { AIProviderError } from "./errors";
import type { ChatMessage } from "./openrouter";
import type { GeminiSchema } from "./zodToGeminiSchema";

export const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
export const GEMINI_FALLBACK_MODEL = "gemini-2.0-flash";

export type GeminiOptions = {
  apiKey: string;
  model: string;
  temperature?: number;
  maxOutputTokens?: number;
  responseSchema?: GeminiSchema | null;
  /** JSON mode (responseMimeType application/json). Default true. */
  json?: boolean;
  maxRetries?: number;
  baseDelayMs?: number;
  /** Longest single wait we'll sleep inside one request (keeps API routes under the 60s cap). */
  maxWaitMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
};

export type GeminiResult = { text: string; model: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

/** Parse google.rpc.RetryInfo.retryDelay ("23s" / "1.5s") or a Retry-After header. */
export function parseGeminiRetryAfter(body: unknown, header: string | null): number | undefined {
  const h = header ? Number(header) : NaN;
  if (Number.isFinite(h) && h > 0) return h;
  const details = (body as { error?: { details?: { "@type"?: string; retryDelay?: string }[] } })?.error?.details ?? [];
  for (const d of details) {
    if (d["@type"]?.endsWith("RetryInfo") && typeof d.retryDelay === "string") {
      const n = parseFloat(d.retryDelay);
      if (Number.isFinite(n)) return Math.ceil(n);
    }
  }
  return undefined;
}

export function toGeminiContents(messages: ChatMessage[]) {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  return { systemInstruction: system ? { parts: [{ text: system }] } : undefined, contents };
}

/**
 * Gemini generateContent over REST. Auth is ONLY the `x-goog-api-key` header (no Authorization
 * header). Falls back to gemini-2.0-flash once if the configured model 404s; drops responseSchema
 * once if Gemini rejects it (400 mentioning schema). Handles 429 RESOURCE_EXHAUSTED with RetryInfo.
 */
export async function geminiGenerate(messages: ChatMessage[], opts: GeminiOptions): Promise<GeminiResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const maxRetries = opts.maxRetries ?? 2;
  const base = opts.baseDelayMs ?? 1500;
  const maxWaitMs = opts.maxWaitMs ?? 12_000;
  let model = opts.model;
  let schema = opts.responseSchema ?? null;
  let triedFallback = model === GEMINI_FALLBACK_MODEL;
  const { systemInstruction, contents } = toGeminiContents(messages);

  for (let attempt = 0; ; attempt++) {
    const generationConfig: Record<string, unknown> = {
      temperature: opts.temperature ?? 0.1,
      maxOutputTokens: opts.maxOutputTokens ?? 8192,
      ...(opts.json !== false ? { responseMimeType: "application/json" } : {}),
      ...(opts.json !== false && schema ? { responseSchema: schema } : {}),
    };
    // 2.5 Flash "thinking" adds latency; analysis prompts are explicit, so keep it off for speed.
    if (/2\.5-flash/.test(model)) generationConfig.thinkingConfig = { thinkingBudget: 0 };

    const signals = [AbortSignal.timeout(opts.timeoutMs ?? 50_000), ...(opts.signal ? [opts.signal] : [])];
    let res: Response;
    try {
      res = await fetchImpl(`${GEMINI_BASE_URL}/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": opts.apiKey },
        body: JSON.stringify({ contents, ...(systemInstruction ? { systemInstruction } : {}), generationConfig }),
        signal: AbortSignal.any(signals),
      });
    } catch (err) {
      const timedOut = (err as Error).name === "TimeoutError" || (err as Error).name === "AbortError";
      if (!timedOut && attempt < maxRetries) {
        await sleep(base * 2 ** attempt);
        continue;
      }
      throw new AIProviderError(timedOut ? "Gemini request timed out." : `Gemini request failed: ${(err as Error).message}`, undefined, { code: timedOut ? "timeout" : "provider" });
    }

    if (res.ok) {
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
        promptFeedback?: { blockReason?: string };
      };
      if (data.promptFeedback?.blockReason) {
        throw new AIProviderError(`Gemini blocked the prompt (${data.promptFeedback.blockReason}).`, undefined, { code: "blocked" });
      }
      const cand = data.candidates?.[0];
      const text = (cand?.content?.parts ?? []).map((p) => p.text ?? "").join("");
      if (!text.trim()) {
        throw new AIProviderError(`Gemini returned no text (finishReason ${cand?.finishReason ?? "unknown"}).`, undefined, {
          code: cand?.finishReason === "SAFETY" || cand?.finishReason === "RECITATION" ? "blocked" : "invalid_output",
        });
      }
      return { text, model };
    }

    const bodyText = await res.text().catch(() => "");
    let body: unknown = null;
    try {
      body = JSON.parse(bodyText);
    } catch {
      /* non-JSON error body */
    }
    const message = (body as { error?: { message?: string } })?.error?.message ?? bodyText.slice(0, 300);

    if (res.status === 404 && !triedFallback) {
      triedFallback = true;
      model = GEMINI_FALLBACK_MODEL;
      continue;
    }
    if (res.status === 400 && schema && /schema|responseSchema|response_schema/i.test(message)) {
      schema = null;
      continue;
    }
    if (RETRYABLE.has(res.status) && attempt < maxRetries) {
      const ra = parseGeminiRetryAfter(body, res.headers.get("retry-after"));
      const wait = ra !== undefined ? ra * 1000 : base * 2 ** attempt + Math.floor(Math.random() * base);
      if (wait <= maxWaitMs) {
        await sleep(wait);
        continue;
      }
      throw new AIProviderError(`Gemini rate limit reached: ${message.slice(0, 200)}`, res.status, { code: "rate_limited", retryAfterSec: Math.ceil(wait / 1000) });
    }
    const retryAfterSec = res.status === 429 ? parseGeminiRetryAfter(body, res.headers.get("retry-after")) : undefined;
    const authProblem = /api key|API_KEY_INVALID|permission|unauthenticated/i.test(message) && [400, 401, 403].includes(res.status);
    throw new AIProviderError(`Gemini error ${res.status}: ${message.slice(0, 300)}`, res.status, { retryAfterSec, ...(authProblem ? { code: "auth" as const } : {}) });
  }
}
