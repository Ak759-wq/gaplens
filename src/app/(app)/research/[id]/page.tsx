import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/page-header";
import { ResearchDashboard } from "@/components/dashboard/research-dashboard";

export const metadata: Metadata = { title: "Research report" };

export default async function ResearchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const safeId = id.slice(0, 64);
  return (
    <>
      <PageHeader
        eyebrow={`Session ${safeId}`}
        title="Research report"
        description="Session storage and analysis aren't connected in this build, so no report exists for this session yet. Each section below shows what it will contain."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/history">
              <ArrowLeft /> History
            </Link>
          </Button>
        }
      />
      <ResearchDashboard />
    </>
  );
}
