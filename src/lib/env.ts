/**
 * Integration configuration status. Reports BOOLEANS (and non-secret model ids) only, never secret values.
 * Safe to call from server code; do not import into client components.
 */
export type IntegrationStatus = {
  llm: {
    /** Provider the server will use when the browser sends no key of its own. */
    activeProvider: "gemini" | "openrouter" | null;
    preference: string;
    gemini: { configured: boolean; model: string };
    openrouter: { configured: boolean; model: string };
  };
  /** @deprecated kept for backwards compatibility with Phase 1 clients; mirrors llm.openrouter. */
  openrouter: { configured: boolean; model: string };
  supabase: { url: boolean; anonKey: boolean; serviceRoleKey: boolean; configured: boolean };
  firecrawl: { configured: boolean };
  jinaReader: { available: true; keyConfigured: boolean };
  search: { provider: "tavily" | null; configured: boolean };
  /** Extraction + persistence are wired; AI stages additionally need a server or BYO key. */
  pipelineReady: boolean;
};

export const DEFAULT_OPENROUTER_MODEL = "openai/gpt-4o-mini";
export const DEFAULT_GEMINI_MODEL_ID = "gemini-2.5-flash";

const has = (v: string | undefined) => typeof v === "string" && v.trim().length > 0;

export function getIntegrationStatus(env: NodeJS.ProcessEnv = process.env): IntegrationStatus {
  const supabase = {
    url: has(env.NEXT_PUBLIC_SUPABASE_URL),
    anonKey: has(env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    serviceRoleKey: has(env.SUPABASE_SERVICE_ROLE_KEY),
  };
  // GAPLENS_DB=memory: local demo store (no persistence across restarts).
  const supabaseConfigured = (supabase.url && supabase.serviceRoleKey) || env.GAPLENS_DB === "memory";
  const gemini = has(env.GEMINI_API_KEY);
  const openrouter = has(env.OPENROUTER_API_KEY);
  const pref = env.LLM_PROVIDER?.trim().toLowerCase() || "auto";
  const validPreference = pref === "auto" || pref === "gemini" || pref === "openrouter";
  const activeProvider =
    !validPreference ? null : pref === "gemini" && gemini ? "gemini" : pref === "openrouter" && openrouter ? "openrouter" : gemini ? "gemini" : openrouter ? "openrouter" : null;
  const openrouterStatus = { configured: openrouter, model: env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL };
  return {
    llm: {
      activeProvider,
      preference: pref,
      gemini: { configured: gemini, model: env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL_ID },
      openrouter: openrouterStatus,
    },
    openrouter: openrouterStatus,
    supabase: { ...supabase, configured: supabaseConfigured },
    firecrawl: { configured: has(env.FIRECRAWL_API_KEY) },
    jinaReader: { available: true, keyConfigured: has(env.JINA_API_KEY) },
    search: { provider: has(env.TAVILY_API_KEY) ? "tavily" : null, configured: has(env.TAVILY_API_KEY) },
    pipelineReady: supabaseConfigured,
  };
}
