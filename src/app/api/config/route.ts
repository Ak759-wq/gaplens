import { NextResponse } from "next/server";
import { getIntegrationStatus } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Reports which integrations are configured. Booleans (and non-secret model ids) only. */
export function GET() {
  const s = getIntegrationStatus();
  return NextResponse.json(
    {
      llm: s.llm,
      openrouter: s.openrouter,
      supabase: s.supabase,
      firecrawl: s.firecrawl,
      jinaReader: s.jinaReader,
      search: s.search,
      pipelineReady: s.pipelineReady,
      byoKeySupported: true,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
