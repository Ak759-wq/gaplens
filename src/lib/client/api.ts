"use client";

import { llmHeaders } from "./llm-settings";

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryAfterSec?: number;
  constructor(status: number, code: string, message: string, retryAfterSec?: number) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryAfterSec = retryAfterSec;
  }
}

/** JSON fetch against our API. Adds the BYO AI key headers when `ai` is true. */
export async function apiFetch<T>(path: string, init: RequestInit & { ai?: boolean; json?: unknown } = {}): Promise<T> {
  const { ai, json, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (json !== undefined) headers.set("Content-Type", "application/json");
  if (ai) for (const [k, v] of Object.entries(llmHeaders())) headers.set(k, v);
  let res: Response;
  try {
    res = await fetch(path, { ...rest, headers, body: json !== undefined ? JSON.stringify(json) : rest.body });
  } catch {
    throw new ApiClientError(0, "network", "Network error. Check your connection and try again.");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const e = (body as { error?: { code?: string; message?: string; retryAfterSec?: number } } | null)?.error;
    throw new ApiClientError(res.status, e?.code ?? "internal", e?.message ?? `Request failed (${res.status}).`, e?.retryAfterSec);
  }
  return body as T;
}
