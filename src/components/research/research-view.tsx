"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Printer, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResearchDashboard } from "@/components/dashboard/research-dashboard";
import { FindingLegend } from "@/components/evidence/finding-legend";
import { apiFetch } from "@/lib/client/api";
import { formatDate } from "@/lib/dates";
import type { SessionView } from "@/lib/view-types";
import { PipelineRunner } from "./pipeline-runner";

const STATUS_TEXT: Record<string, string> = { draft: "Not analysed", extracting: "Reading sources", analyzing: "Analysis in progress", complete: "Complete", failed: "Failed" };

export function ResearchView({ initial, serverAi, autoRun }: { initial: SessionView; serverAi: boolean; autoRun: boolean }) {
  const [view, setView] = useState(initial);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const id = view.session.id;

  const refresh = useCallback(async () => {
    try {
      const v = await apiFetch<SessionView>(`/api/sessions/${id}`, { cache: "no-store" });
      setView(v);
      return v;
    } catch {
      return null;
    }
  }, [id]);

  const toggle = useCallback(
    async (itemId: string, done: boolean) => {
      setView((v) => ({ ...v, checklist: v.checklist.map((c) => (c.id === itemId ? { ...c, done } : c)) }));
      try {
        await apiFetch(`/api/sessions/${id}/checklist/${itemId}`, { method: "PATCH", json: { done } });
      } catch (e) {
        setView((v) => ({ ...v, checklist: v.checklist.map((c) => (c.id === itemId ? { ...c, done: !done } : c)) }));
        throw e;
      }
    },
    [id],
  );

  const showRunner = autoRun || view.session.status !== "complete";

  return (
    <>
      <div className="mb-8 flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <p className="mb-2 font-mono text-xs tracking-[0.14em] text-brand uppercase">
            {STATUS_TEXT[view.session.status] ?? view.session.status} · {formatDate(view.session.createdAt)}
          </p>
          <h1 className="font-serif text-3xl tracking-tight sm:text-4xl">{view.session.topic}</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{view.session.question}</p>
          {view.session.objective && <p className="mt-1 text-sm text-muted-foreground"><span className="font-medium text-foreground">Objective:</span> {view.session.objective}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 print:hidden">
          <Button asChild variant="outline" size="sm"><Link href="/history"><ArrowLeft /> History</Link></Button>
          <Button asChild variant="outline" size="sm"><a href={`/api/sessions/${id}/export?format=md`} download><Download /> Markdown</a></Button>
          <Button asChild variant="outline" size="sm"><Link href={`/research/${id}/print`} target="_blank"><Printer /> Print / PDF</Link></Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={deleting}
            onClick={async () => {
              if (!window.confirm("Delete this research session and all its findings? This can't be undone.")) return;
              setDeleting(true);
              try {
                await apiFetch(`/api/sessions/${id}`, { method: "DELETE" });
                router.push("/history");
              } catch {
                setDeleting(false);
                window.alert("Couldn't delete the session. Try again.");
              }
            }}
          >
            <Trash2 /> Delete
          </Button>
        </div>
      </div>

      {showRunner && <PipelineRunner view={view} serverAi={serverAi} autoStart={autoRun && view.session.status !== "complete"} onRefresh={refresh} />}

      <ResearchDashboard view={view} onToggleChecklist={toggle} />

      <details className="mt-10 rounded-xl border bg-card p-4 text-sm print:hidden">
        <summary className="cursor-pointer font-medium">What the labels mean</summary>
        <FindingLegend className="mt-4" />
      </details>
    </>
  );
}
