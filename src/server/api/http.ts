import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type z } from "zod";
import { BYO_HEADERS, byoModelSchema, llmProviderSchema, uuidSchema } from "@/lib/api-schemas";
import { AIProviderError, ConfigError } from "@/server/ai/errors";
import { createLlmClient, resolveLlmConfig, type LlmClient, type LlmOverride } from "@/server/ai/llm";
import { DbError } from "@/server/db/supabaseRepositories";
import { ExtractionError } from "@/server/services/sourceExtractor";

/** Machine-readable error codes the client reacts to. */
export type ApiErrorCode =
  | "bad_request"
  | "not_found"
  | "config_required"
  | "rate_limited"
  | "llm_auth"
  | "llm_error"
  | "extraction_failed"
  | "db_error"
  | "insufficient_sources"
  | "internal";

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly extra?: Record<string, unknown>;
  constructor(status: number, code: ApiErrorCode, message: string, extra?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

const NO_STORE = { "Cache-Control": "no-store" };

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

/** Map any thrown error to a safe JSON response. Never echoes secrets or stack traces. */
export function errorResponse(err: unknown) {
  if (err instanceof ApiError) return json({ error: { code: err.code, message: err.message, ...err.extra } }, err.status);
  if (err instanceof ZodError) {
    return json({ error: { code: "bad_request", message: err.issues.map((i) => i.message).join(" ") } }, 400);
  }
  if (err instanceof ConfigError) return json({ error: { code: "config_required", message: err.message, missing: err.missing } }, 503);
  if (err instanceof AIProviderError) {
    if (err.code === "rate_limited") {
      return json({ error: { code: "rate_limited", message: "The AI provider's rate limit was reached. GapLens will retry shortly.", retryAfterSec: err.retryAfterSec ?? 30 } }, 429);
    }
    if (err.code === "auth") return json({ error: { code: "llm_auth", message: "The AI provider rejected the API key. Check the key in AI settings or the server configuration." } }, 401);
    return json({ error: { code: "llm_error", message: err.message.slice(0, 400) } }, 502);
  }
  if (err instanceof ExtractionError) return json({ error: { code: "extraction_failed", message: err.message.slice(0, 600) } }, 422);
  if (err instanceof DbError) return json({ error: { code: "db_error", message: err.message } }, 503);
  console.error("[gaplens] unhandled API error:", err instanceof Error ? `${err.name}: ${err.message}` : "unknown");
  return json({ error: { code: "internal", message: "Unexpected server error." } }, 500);
}

export async function readJson<T extends z.ZodTypeAny>(req: Request, schema: T): Promise<z.infer<T>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "bad_request", "Request body must be JSON.");
  }
  return schema.parse(body);
}

export function parseId(id: string): string {
  const r = uuidSchema.safeParse(id);
  if (!r.success) throw new ApiError(404, "not_found", "Not found.");
  return r.data;
}

/**
 * Bring-your-own AI key from request headers. The key is used for this request only:
 * it is never logged, persisted or echoed back.
 */
export function readLlmOverride(req: Request): LlmOverride | null {
  const key = req.headers.get(BYO_HEADERS.key)?.trim();
  if (!key) return null;
  if (key.length > 512 || /\s/.test(key)) throw new ApiError(400, "bad_request", "The AI key header is malformed.");
  const provider = llmProviderSchema.safeParse(req.headers.get(BYO_HEADERS.provider)?.trim().toLowerCase() ?? "gemini");
  if (!provider.success) throw new ApiError(400, "bad_request", "Unknown AI provider.");
  const modelRaw = req.headers.get(BYO_HEADERS.model)?.trim();
  const model = modelRaw ? byoModelSchema.safeParse(modelRaw) : null;
  if (model && !model.success) throw new ApiError(400, "bad_request", "Invalid model id.");
  return { provider: provider.data, apiKey: key, model: model?.data };
}

/** LLM client for this request: BYO header key first, then server env. With `required=false`, returns null when unconfigured. */
export function llmForRequest(req: Request, required: true): LlmClient;
export function llmForRequest(req: Request, required: false): LlmClient | null;
export function llmForRequest(req: Request, required: boolean): LlmClient | null {
  const override = readLlmOverride(req);
  try {
    return createLlmClient(resolveLlmConfig(process.env, override));
  } catch (e) {
    if (!required && e instanceof ConfigError) return null;
    throw e;
  }
}
