import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { ResearchWorkspace } from "@/components/workspace/research-workspace";
import { getIntegrationStatus } from "@/lib/env";

export const metadata: Metadata = { title: "Research workspace" };
export const dynamic = "force-dynamic";

export default function WorkspacePage() {
  const s = getIntegrationStatus();
  return (
    <>
      <PageHeader
        eyebrow="Research workspace"
        title="Set up an analysis"
        description="Describe what you need to know and add the sources to examine. GapLens will compare them and show what's missing, what conflicts and what may be out of date."
      />
      <ResearchWorkspace
        integrations={{
          llm: { activeProvider: s.llm.activeProvider, geminiModel: s.llm.gemini.model, openrouterModel: s.llm.openrouter.model },
          supabase: s.supabase.configured,
          firecrawl: s.firecrawl.configured,
          search: s.search.configured,
          pipelineReady: s.pipelineReady,
        }}
      />
    </>
  );
}
