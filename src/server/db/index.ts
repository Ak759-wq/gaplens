import "server-only";
import { createMemoryRepositories } from "./memoryRepositories";
import type { Repositories } from "./repositories";
import { createSupabaseRepositories } from "./supabaseRepositories";

let repos: Repositories | null = null;
const g = globalThis as unknown as { __gaplensMemoryRepos?: Repositories };

/**
 * Production repositories (Supabase, service role). Throws ConfigError when Supabase isn't configured.
 * For local demos without a database, GAPLENS_DB=memory uses a process-local in-memory store
 * (data is lost on restart; intended for local demos and smoke tests only).
 */
export function getRepositories(): Repositories {
  if (process.env.GAPLENS_DB === "memory") {
    g.__gaplensMemoryRepos ??= createMemoryRepositories();
    return g.__gaplensMemoryRepos;
  }
  if (!repos) repos = createSupabaseRepositories();
  return repos;
}
