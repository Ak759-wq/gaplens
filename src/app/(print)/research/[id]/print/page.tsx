import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReportDocument } from "@/components/report/report-document";
import { PrintButton } from "@/components/report/print-button";
import { uuidSchema } from "@/lib/api-schemas";
import { getRepositories } from "@/server/db";
import { buildSessionView } from "@/server/pipeline/view";

export const metadata: Metadata = { title: "Printable report", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const view = await buildSessionView(getRepositories(), id);
  if (!view) notFound();
  return (
    <main className="px-6 py-8 print:p-0">
      <div className="mx-auto mb-6 flex max-w-3xl items-center justify-between rounded-lg border bg-muted/40 px-4 py-2 text-sm print:hidden">
        <span>Use your browser&apos;s “Save as PDF” to keep a copy.</span>
        <PrintButton />
      </div>
      <ReportDocument view={view} />
    </main>
  );
}
