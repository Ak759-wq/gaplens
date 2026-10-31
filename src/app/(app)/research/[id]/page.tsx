import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DatabaseZap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ResearchView } from "@/components/research/research-view";
import { uuidSchema } from "@/lib/api-schemas";
import { getIntegrationStatus } from "@/lib/env";
import { getRepositories } from "@/server/db";
import { buildSessionView } from "@/server/pipeline/view";

export const metadata: Metadata = { title: "Research report" };
export const dynamic = "force-dynamic";

export default async function ResearchPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ run?: string }> }) {
  const { id } = await params;
  const { run } = await searchParams;
  if (!uuidSchema.safeParse(id).success) notFound();
  const status = getIntegrationStatus();
  if (!status.supabase.configured) {
    return (
      <EmptyState icon={DatabaseZap} title="Database not configured" description="Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to store and view research sessions (see docs/ENV.md).">
        <Button asChild><Link href="/workspace">Back to workspace</Link></Button>
      </EmptyState>
    );
  }
  let view;
  try {
    view = await buildSessionView(getRepositories(), id);
  } catch (e) {
    return (
      <EmptyState icon={DatabaseZap} title="Couldn't load this session" description={e instanceof Error ? e.message : "Database error."}>
        <Button asChild variant="outline"><Link href="/history">Back to history</Link></Button>
      </EmptyState>
    );
  }
  if (!view) notFound();
  return <ResearchView initial={view} serverAi={!!status.llm.activeProvider} autoRun={run === "1"} />;
}
