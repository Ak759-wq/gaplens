/**
 * Integration configuration status. Reports BOOLEANS only, never secret values.
 * Safe to call from server code; do not import into client components.
 */
export type IntegrationStatus = {
  openrouter: { configured: boolean; model: string };
  supabase: { url: boolean; anonKey: boolean; serviceRoleKey: boolean; configured: boolean };
  firecrawl: { configured: boolean };
  jinaReader: { available: true; keyConfigured: boolean };
  pipelineReady: boolean;
};

export const DEFAULT_OPENROUTER_MODEL = "openai/gpt-4o-mini";

const has = (v: string | undefined) => typeof v === "string" && v.trim().length > 0;

export function getIntegrationStatus(env: NodeJS.ProcessEnv = process.env): IntegrationStatus {
  const supabase = {
    url: has(env.NEXT_PUBLIC_SUPABASE_URL),
    anonKey: has(env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    serviceRoleKey: has(env.SUPABASE_SERVICE_ROLE_KEY),
  };
  const openrouterConfigured = has(env.OPENROUTER_API_KEY);
  const supabaseConfigured = supabase.url && supabase.serviceRoleKey;
  return {
    openrouter: { configured: openrouterConfigured, model: env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL },
    supabase: { ...supabase, configured: supabaseConfigured },
    firecrawl: { configured: has(env.FIRECRAWL_API_KEY) },
    jinaReader: { available: true, keyConfigured: has(env.JINA_API_KEY) },
    // Phase 1: the analysis pipeline itself is not wired yet, so this stays false regardless of keys.
    pipelineReady: false,
  };
}
