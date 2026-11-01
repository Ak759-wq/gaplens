import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { ResearchWorkspace } from "@/components/workspace/research-workspace";
import { getIntegrationStatus } from "@/lib/env";
import { getIntegrationHealth } from "@/server/integrations/health";

export const metadata: Metadata = { title: "Research workspace" };
export const dynamic = "force-dynamic";

export default async function WorkspacePage() {
  const s = getIntegrationStatus();
  const health = await getIntegrationHealth();
  return (
    <>
      <PageHeader
        eyebrow="Research workspace"
        title="Set up an analysis"
        description="Describe what you need to know and add the sources to examine. GapLens will compare them and show what's missing, what conflicts and what may be out of date."
      />
      <ResearchWorkspace
        integrations={{
          llm: { activeProvider: s.llm.activeProvider, geminiModel: s.llm.gemini.model, openrouterModel: s.llm.openrouter.model, verified: health.llm.verified, error: health.llm.error },
          supabase: s.supabase.configured,
          supabaseVerified: health.supabase.verified,
          firecrawl: s.firecrawl.configured,
          search: s.search.configured,
          pipelineReady: health.pipelineReady,
        }}
      />
    </>
  );
}
