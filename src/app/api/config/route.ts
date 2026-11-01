import { NextResponse } from "next/server";
import { getIntegrationStatus } from "@/lib/env";
import { getIntegrationHealth } from "@/server/integrations/health";

export const dynamic = "force-dynamic";

/** Reports which integrations are configured. Booleans (and non-secret model ids) only. */
export async function GET() {
  const s = getIntegrationStatus();
  const health = await getIntegrationHealth();
  return NextResponse.json(
    {
      llm: s.llm,
      openrouter: s.openrouter,
      supabase: s.supabase,
      firecrawl: s.firecrawl,
      jinaReader: s.jinaReader,
      search: s.search,
      health,
      pipelineReady: health.pipelineReady,
      byoKeySupported: true,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
