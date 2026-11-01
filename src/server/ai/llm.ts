import "server-only";
import type { z } from "zod";
import { DEFAULT_OPENROUTER_MODEL } from "@/lib/env";
import type { LlmProviderId } from "@/lib/api-schemas";
import { AIProviderError, ConfigError } from "./errors";
import { DEFAULT_GEMINI_MODEL, geminiGenerate } from "./gemini";
import { chatCompletion, extractJson, type ChatMessage } from "./openrouter";
import { zodToGeminiSchema } from "./zodToGeminiSchema";

/**
 * Provider abstraction. Gemini (Google AI Studio key) is the default; OpenRouter is optional.
 *
 * Resolution order:
 *   1. A bring-your-own key sent by the browser for this request (never stored or logged).
 *   2. LLM_PROVIDER=gemini|openrouter, if that provider's key is set.
 *   3. Auto: GEMINI_API_KEY first, then OPENROUTER_API_KEY.
 * No key at all → ConfigError ("Configuration required"); results are never simulated.
 */

export type LlmProvider = LlmProviderId;
export type LlmOverride = { provider: LlmProvider; apiKey: string; model?: string };
export type LlmConfig = { provider: LlmProvider; apiKey: string; model: string; keySource: "server" | "byo" };

const has = (v: string | undefined) => typeof v === "string" && v.trim().length > 0;

export function defaultModel(provider: LlmProvider, env: NodeJS.ProcessEnv = process.env): string {
  return provider === "gemini"
    ? env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL
    : env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL;
}

export function resolveServerProvider(env: NodeJS.ProcessEnv = process.env): LlmProvider | null {
  const pref = env.LLM_PROVIDER?.trim().toLowerCase();
  if (pref && pref !== "auto" && pref !== "gemini" && pref !== "openrouter") return null;
  if (pref === "gemini" && has(env.GEMINI_API_KEY)) return "gemini";
  if (pref === "openrouter" && has(env.OPENROUTER_API_KEY)) return "openrouter";
  if (has(env.GEMINI_API_KEY)) return "gemini";
  if (has(env.OPENROUTER_API_KEY)) return "openrouter";
  return null;
}

export function resolveLlmConfig(env: NodeJS.ProcessEnv = process.env, override?: LlmOverride | null): LlmConfig {
  if (override && has(override.apiKey)) {
    return { provider: override.provider, apiKey: override.apiKey.trim(), model: override.model?.trim() || defaultModel(override.provider, env), keySource: "byo" };
  }
  const provider = resolveServerProvider(env);
  if (!provider) {
    throw new ConfigError(
      "Configuration required: no AI provider key. Set GEMINI_API_KEY (or OPENROUTER_API_KEY) on the server, or add your own key in the workspace (AI settings).",
      ["GEMINI_API_KEY", "OPENROUTER_API_KEY"],
    );
  }
  const apiKey = (provider === "gemini" ? env.GEMINI_API_KEY : env.OPENROUTER_API_KEY)!.trim();
  return { provider, apiKey, model: defaultModel(provider, env), keySource: "server" };
}

export type GenerateOptions = {
  maxOutputTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  /** Stage label, used only in error messages. */
  label?: string;
};

export interface LlmClient {
  readonly provider: LlmProvider;
  readonly model: string;
  /** JSON generation validated with `schema`; one corrective retry on schema mismatch. */
  generate<T extends z.ZodTypeAny>(messages: ChatMessage[], schema: T, opts?: GenerateOptions): Promise<z.infer<T>>;
}

export function createLlmClient(cfg: LlmConfig, deps: { fetchImpl?: typeof fetch } = {}): LlmClient {
  let usedModel = cfg.model;
  const raw = async (messages: ChatMessage[], schema: z.ZodTypeAny, opts: GenerateOptions): Promise<string> => {
    if (cfg.provider === "gemini") {
      const r = await geminiGenerate(messages, {
        apiKey: cfg.apiKey,
        model: usedModel,
        responseSchema: zodToGeminiSchema(schema),
        maxOutputTokens: opts.maxOutputTokens,
        temperature: opts.temperature,
        signal: opts.signal,
        fetchImpl: deps.fetchImpl,
      });
      usedModel = r.model; // sticky fallback (e.g. 2.5-flash → 2.0-flash)
      return r.text;
    }
    return chatCompletion(messages, {
      apiKey: cfg.apiKey,
      model: usedModel,
      jsonMode: true,
      maxTokens: opts.maxOutputTokens,
      temperature: opts.temperature,
      signal: opts.signal,
      fetchImpl: deps.fetchImpl,
      maxRetries: 2,
      maxWaitMs: 12_000,
    });
  };

  return {
    provider: cfg.provider,
    get model() {
      return usedModel;
    },
    async generate(messages, schema, opts = {}) {
      let convo = messages;
      let lastIssue = "";
      for (let attempt = 0; attempt < 2; attempt++) {
        const text = await raw(convo, schema, opts);
        let json: unknown;
        try {
          json = extractJson(text);
        } catch {
          lastIssue = "Output was not valid JSON.";
          convo = [...messages, { role: "assistant", content: text.slice(0, 4000) }, { role: "user", content: "That was not valid JSON. Return only valid JSON matching the schema." }];
          continue;
        }
        const parsed = schema.safeParse(json);
        if (parsed.success) return parsed.data;
        lastIssue = parsed.error.message.slice(0, 1500);
        convo = [
          ...messages,
          { role: "assistant", content: text.slice(0, 8000) },
          { role: "user", content: `Your JSON did not match the required schema. Errors: ${lastIssue}. Return corrected JSON only.` },
        ];
      }
      throw new AIProviderError(`${opts.label ?? "AI"} output failed validation twice (${lastIssue.slice(0, 200)}).`, undefined, { code: "invalid_output" });
    },
  };
}

/** Status for /api/config: booleans + non-secret model ids only. */
export function getLlmStatus(env: NodeJS.ProcessEnv = process.env) {
  return {
    activeProvider: resolveServerProvider(env),
    preference: env.LLM_PROVIDER?.trim().toLowerCase() || "auto",
    gemini: { configured: has(env.GEMINI_API_KEY), model: defaultModel("gemini", env) },
    openrouter: { configured: has(env.OPENROUTER_API_KEY), model: defaultModel("openrouter", env) },
  };
}
