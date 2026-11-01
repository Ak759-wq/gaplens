export type DraftSource =
  | { id: string; kind: "url"; url: string; dedupKey: string; addedAt: string; extractionError?: string; example?: boolean }
  | { id: string; kind: "pdf"; fileName: string; size: number; dedupKey: string; addedAt: string; file?: File; extractionError?: string; example?: boolean };

export type Brief = { topic: string; question: string; objective: string };

export type ClientIntegrationStatus = {
  llm: { activeProvider: "gemini" | "openrouter" | null; geminiModel: string; openrouterModel: string; verified: boolean; error?: string };
  supabase: boolean;
  supabaseVerified: boolean;
  firecrawl: boolean;
  search: boolean;
  pipelineReady: boolean;
};

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
