import "server-only";
import { DEFAULT_OPENROUTER_MODEL, getIntegrationStatus, type IntegrationStatus } from "@/lib/env";
import { DEFAULT_GEMINI_MODEL } from "@/server/ai/gemini";
import { getSupabaseAdmin } from "@/server/db/supabase";

type Check = { configured: boolean; verified: boolean; error?: string };

export type IntegrationHealth = {
  llm: {
    activeProvider: IntegrationStatus["llm"]["activeProvider"];
    model: string | null;
    configured: boolean;
    verified: boolean;
    error?: string;
  };
  supabase: Check;
  pipelineReady: boolean;
};

async function checkProvider(provider: "gemini" | "openrouter", model: string): Promise<Check> {
  const key = provider === "gemini" ? process.env.GEMINI_API_KEY?.trim() : process.env.OPENROUTER_API_KEY?.trim();
  if (!key) return { configured: false, verified: false, error: "Server AI key is not configured." };
  try {
    const url = provider === "gemini" ? "https://generativelanguage.googleapis.com/v1beta/models" : "https://openrouter.ai/api/v1/models";
    const headers: Record<string, string> = {};
    if (provider === "gemini") headers["x-goog-api-key"] = key;
    else headers.Authorization = `Bearer ${key}`;
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(8_000), cache: "no-store" });
    if (!response.ok) return { configured: true, verified: false, error: `${provider} connectivity check returned HTTP ${response.status}.` };
    const body = (await response.json()) as { models?: { name?: string }[]; data?: { id?: string }[] };
    const models = body.models?.map((item) => item.name?.replace(/^models\//, "")) ?? body.data?.map((item) => item.id) ?? [];
    return models.length === 0 || models.includes(model)
      ? { configured: true, verified: true }
      : { configured: true, verified: false, error: `Configured model ${model} was not returned by ${provider}.` };
  } catch {
    return { configured: true, verified: false, error: `${provider} connectivity check failed.` };
  }
}

async function checkSupabase(): Promise<Check> {
  if (process.env.GAPLENS_DB === "memory") return { configured: true, verified: true };
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return { configured: false, verified: false, error: "Supabase credentials are not configured." };
  }
  try {
    const { error } = await getSupabaseAdmin().from("research_sessions").select("id").limit(1);
    if (error) {
      return { configured: true, verified: false, error: error.code === "42P01" || error.code === "PGRST205" ? "Supabase migrations are not applied." : "Supabase connectivity check failed." };
    }
    return { configured: true, verified: true };
  } catch {
    return { configured: true, verified: false, error: "Supabase connectivity check failed." };
  }
}

export async function getIntegrationHealth(): Promise<IntegrationHealth> {
  const configured = getIntegrationStatus();
  const provider = configured.llm.activeProvider;
  const model = provider === "gemini" ? configured.llm.gemini.model || DEFAULT_GEMINI_MODEL : provider === "openrouter" ? configured.llm.openrouter.model || DEFAULT_OPENROUTER_MODEL : null;
  const [llm, supabase] = await Promise.all([
    provider && model ? checkProvider(provider, model) : Promise.resolve({ configured: false, verified: false, error: "No server AI provider is configured." } satisfies Check),
    checkSupabase(),
  ]);
  return {
    llm: { activeProvider: provider, model, configured: llm.configured, verified: llm.verified, ...(llm.error ? { error: llm.error } : {}) },
    supabase,
    pipelineReady: llm.verified && supabase.verified,
  };
}
