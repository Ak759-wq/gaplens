import type { Metadata } from "next";
import Link from "next/link";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";

export const metadata: Metadata = { title: "History" };

export default function HistoryPage() {
  return (
    <>
      <PageHeader
        eyebrow="History"
        title="Past research sessions"
        description="Completed analyses will be listed here with their question, source count and findings summary."
      />
      <EmptyState
        icon={History}
        title="No research sessions yet"
        description="Sessions are saved once the database is connected and an analysis has run. Nothing has been stored so far."
      >
        <Button asChild>
          <Link href="/workspace">Start research</Link>
        </Button>
      </EmptyState>
    </>
  );
}
