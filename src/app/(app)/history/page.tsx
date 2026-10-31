import type { Metadata } from "next";
import Link from "next/link";
import { DatabaseZap, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { HistoryList } from "@/components/history/history-list";
import { getIntegrationStatus } from "@/lib/env";
import { getRepositories } from "@/server/db";

export const metadata: Metadata = { title: "History" };
export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const header = <PageHeader eyebrow="History" title="Past research sessions" description="Open a session to see its findings, or delete ones you no longer need." actions={<Button asChild><Link href="/workspace">New research</Link></Button>} />;
  if (!getIntegrationStatus().supabase.configured) {
    return (
      <>
        {header}
        <EmptyState icon={DatabaseZap} title="Database not configured" description="Sessions are stored in Supabase. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see docs/ENV.md)." />
      </>
    );
  }
  let items;
  try {
    items = await getRepositories().sessions.list({ limit: 100 });
  } catch (e) {
    return (
      <>
        {header}
        <EmptyState icon={DatabaseZap} title="Couldn't load history" description={e instanceof Error ? e.message : "Database error."} />
      </>
    );
  }
  return (
    <>
      {header}
      {items.length === 0 ? (
        <EmptyState icon={History} title="No research sessions yet" description="Run an analysis from the workspace and it will be saved here.">
          <Button asChild><Link href="/workspace">Start research</Link></Button>
        </EmptyState>
      ) : (
        <HistoryList items={items.map((s) => ({ id: s.id, topic: s.topic, question: s.question, status: s.status, createdAt: s.created_at, sourceCount: s.source_count, findingCount: s.finding_count }))} />
      )}
    </>
  );
}
