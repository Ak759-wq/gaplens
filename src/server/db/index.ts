import "server-only";
import type { Repositories } from "./repositories";
import { createSupabaseRepositories } from "./supabaseRepositories";

let repos: Repositories | null = null;

/** Production repositories (Supabase, service role). Throws ConfigError when Supabase isn't configured. */
export function getRepositories(): Repositories {
  if (!repos) repos = createSupabaseRepositories();
  return repos;
}
