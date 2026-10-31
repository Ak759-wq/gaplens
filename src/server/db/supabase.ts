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
 * supabase-js always sends `Authorization: Bearer <key>`. That is right for legacy JWT keys, but the
 * newer non-JWT secret keys (`sb_secret_…`) and proxy-injected keys authenticate via the `apikey`
 * header alone, and PostgREST rejects a non-JWT bearer token ("Expected 3 parts in JWT").
 * For non-JWT keys we therefore drop the bearer header and rely on `apikey`.
 */
export function apiKeyOnlyFetch(key: string): typeof fetch {
  const isJwt = key.split(".").length === 3;
  return (input, init) => {
    if (isJwt) return fetch(input, init);
    const headers = new Headers(init?.headers);
    if (headers.get("authorization") === `Bearer ${key}`) headers.delete("authorization");
    return fetch(input, { ...init, headers });
  };
}
