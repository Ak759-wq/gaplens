import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ConfigError } from "@/server/ai/errors";

let cached: SupabaseClient | null = null;

/**
 * Server-side Supabase client using the SERVICE ROLE key.
 * All reads/writes go through API routes / server components; the browser never talks to the DB
 * directly in this design, so RLS is enabled with no anon policies (deny-by-default). See
 * supabase/migrations/0001_init.sql and docs/ARCHITECTURE.md.
 */
export function getSupabaseAdmin(env: NodeJS.ProcessEnv = process.env): SupabaseClient {
  if (cached) return cached;
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const missing = [!url && "NEXT_PUBLIC_SUPABASE_URL", !key && "SUPABASE_SERVICE_ROLE_KEY"].filter(Boolean) as string[];
  if (!url || !key) {
    throw new ConfigError(`Supabase is not configured. Missing: ${missing.join(", ")} (see docs/ENV.md).`, missing);
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-application": "gaplens" }, fetch: apiKeyOnlyFetch(key) },
  });
  return cached;
}

export function isSupabaseConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL?.trim() && env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

/**
 * supabase-js sends `Authorization: Bearer <key>`. That is correct for legacy JWT keys and for the
 * new `sb_secret_…` keys (the gateway accepts a bearer equal to the apikey). Only for any OTHER opaque
 * value (e.g. a key injected by an outbound proxy, where PostgREST would reject the bearer with
 * "Expected 3 parts in JWT") do we drop the bearer and rely on the `apikey` header.
 */
export function apiKeyOnlyFetch(key: string): typeof fetch {
  const passThrough = key.split(".").length === 3 || key.startsWith("sb_");
  return (input, init) => {
    if (passThrough) return fetch(input, init);
    const headers = new Headers(init?.headers);
    if (headers.get("authorization") === `Bearer ${key}`) headers.delete("authorization");
    return fetch(input, { ...init, headers });
  };
}
