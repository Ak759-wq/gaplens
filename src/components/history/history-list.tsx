"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/client/api";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

export type HistoryItem = { id: string; topic: string; question: string; status: string; createdAt: string; sourceCount: number; findingCount: number };

const STATUS: Record<string, { text: string; cls: string }> = {
  complete: { text: "Complete", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  analyzing: { text: "In progress", cls: "bg-sky-50 text-sky-800 border-sky-200" },
  extracting: { text: "Reading sources", cls: "bg-sky-50 text-sky-800 border-sky-200" },
  draft: { text: "Not analysed", cls: "bg-muted text-muted-foreground" },
  failed: { text: "Failed", cls: "bg-red-50 text-red-800 border-red-200" },
};

export function HistoryList({ items: initial }: { items: HistoryItem[] }) {
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <ul className="space-y-3">
        {items.map((s) => {
          const st = STATUS[s.status] ?? STATUS.draft!;
          return (
            <li key={s.id} className="group flex items-center gap-3 rounded-xl border bg-card p-4 shadow-xs transition hover:border-brand/40">
              <Link href={`/research/${s.id}`} className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate font-medium">{s.topic}</h2>
                  <span className={cn("rounded-full border px-2 py-0.5 text-[11px]", st.cls)}>{st.text}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{s.question}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {formatDate(s.createdAt)} · {s.sourceCount} source{s.sourceCount === 1 ? "" : "s"} · {s.findingCount} finding{s.findingCount === 1 ? "" : "s"}
                </p>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${s.topic}`}
                disabled={busy === s.id}
                onClick={async () => {
                  if (!window.confirm(`Delete “${s.topic}” and all its findings? This can't be undone.`)) return;
                  setBusy(s.id);
                  setError(null);
                  try {
                    await apiFetch(`/api/sessions/${s.id}`, { method: "DELETE" });
                    setItems((prev) => prev.filter((x) => x.id !== s.id));
                  } catch {
                    setError("Couldn't delete that session. Try again.");
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                {busy === s.id ? <Loader2 className="animate-spin" /> : <Trash2 className="text-muted-foreground" />}
              </Button>
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
            </li>
          );
        })}
      </ul>
      {items.length === 0 && <p className="text-sm text-muted-foreground">All sessions deleted.</p>}
    </div>
  );
}
