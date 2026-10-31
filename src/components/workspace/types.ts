export type DraftSource =
  | { id: string; kind: "url"; url: string; dedupKey: string; addedAt: string }
  | { id: string; kind: "pdf"; fileName: string; size: number; dedupKey: string; addedAt: string; file?: File };

export type Brief = { topic: string; question: string; objective: string };

export type ClientIntegrationStatus = {
  openrouter: boolean;
  supabase: boolean;
  firecrawl: boolean;
  pipelineReady: boolean;
};

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
