import { NextResponse } from "next/server";
import { getIntegrationStatus } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Reports which integrations are configured. Booleans (and the non-secret model id) only. */
export function GET() {
  const s = getIntegrationStatus();
  return NextResponse.json(
    {
      openrouter: { configured: s.openrouter.configured, model: s.openrouter.model },
      supabase: s.supabase,
      firecrawl: s.firecrawl,
      jinaReader: s.jinaReader,
      pipelineReady: s.pipelineReady,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
