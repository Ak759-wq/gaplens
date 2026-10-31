"use client";

import { useId, useState } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, ApiClientError } from "@/lib/client/api";

type Result = { title: string | null; url: string; snippet: string; publishedDate: string | null };

/** Optional permitted web search: suggests URLs; the user decides what to add. */
export function WebSearch({ configured, onAdd, existing }: { configured: boolean; onAdd: (url: string) => void; existing: Set<string> }) {
  const id = useId();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!configured) {
    return (
      <div className="rounded-lg border border-dashed px-4 py-3 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Web search:</span> configuration required (set <code>TAVILY_API_KEY</code> on the server). Add URLs manually in the meantime.
      </div>
    );
  }

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const r = await apiFetch<{ results: Result[] }>("/api/search", { method: "POST", json: { query: q } });
      setResults(r.results);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Search failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Find sources (web search)</Label>
      <div className="flex gap-2">
        <Input id={id} value={q} placeholder="e.g. Central Sector Scholarship 2026-27 last date" onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), q.trim().length >= 3 && run())} />
        <Button type="button" variant="outline" onClick={run} disabled={busy || q.trim().length < 3}>
          {busy ? <Loader2 className="animate-spin" /> : <Search />} Search
        </Button>
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      {results && (
        <ul className="divide-y rounded-lg border bg-card text-sm">
          {results.length === 0 && <li className="px-3 py-2 text-muted-foreground">No results.</li>}
          {results.map((r) => (
            <li key={r.url} className="flex items-start gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <a href={r.url} target="_blank" rel="noopener noreferrer nofollow" className="line-clamp-1 font-medium text-brand hover:underline">{r.title ?? r.url}</a>
                <p className="truncate text-xs text-muted-foreground">{r.url}</p>
                {r.snippet && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.snippet}</p>}
              </div>
              <Button type="button" size="sm" variant="ghost" disabled={existing.has(r.url)} onClick={() => onAdd(r.url)} aria-label={`Add ${r.url}`}>
                <Plus /> {existing.has(r.url) ? "Added" : "Add"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
