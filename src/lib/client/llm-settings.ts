"use client";

import { BYO_HEADERS, type LlmProviderId } from "@/lib/api-schemas";

/**
 * Bring-your-own AI key. Stored ONLY in this browser's localStorage and sent per request in a header
 * (over HTTPS in production). The server uses it for that request and never stores or logs it.
 */
export type ByoLlmSettings = { provider: LlmProviderId; apiKey: string; model?: string };

const KEY = "gaplens:byo-llm:v1";
export const BYO_CHANGED_EVENT = "gaplens:byo-llm-changed";

export function loadByoSettings(): ByoLlmSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as ByoLlmSettings;
    if (!v?.apiKey || (v.provider !== "gemini" && v.provider !== "openrouter")) return null;
    return v;
  } catch {
    return null;
  }
}

export function saveByoSettings(s: ByoLlmSettings | null) {
  if (s) window.localStorage.setItem(KEY, JSON.stringify(s));
  else window.localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(BYO_CHANGED_EVENT));
}

export function llmHeaders(): Record<string, string> {
  const s = loadByoSettings();
  if (!s) return {};
  return {
    [BYO_HEADERS.provider]: s.provider,
    [BYO_HEADERS.key]: s.apiKey,
    ...(s.model ? { [BYO_HEADERS.model]: s.model } : {}),
  };
}

export function maskKey(k: string): string {
  return k.length <= 8 ? "••••" : `${k.slice(0, 4)}…${k.slice(-4)}`;
}
