"use client";

import { FileText, Globe, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBytes } from "@/lib/validation";
import type { DraftSource } from "./types";

function NotYet({ label }: { label: string }) {
  return (
    <span className="text-muted-foreground" title={`${label} is filled in by extraction (Phase 2). It is never guessed.`}>
      —<span className="sr-only">{label} not extracted yet</span>
    </span>
  );
}

export function SourceTable({ sources, onRemove }: { sources: DraftSource[]; onRemove: (id: string) => void }) {
  if (sources.length === 0) {
    return (
      <div className="rounded-lg border border-dashed px-6 py-10 text-center">
        <p className="text-sm font-medium">No sources yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Add at least two sources so GapLens can compare them.</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <caption className="sr-only">Sources added to this research session</caption>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Title</TableHead>
            <TableHead>URL / file</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Published</TableHead>
            <TableHead>Retrieved</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-10"><span className="sr-only">Actions</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sources.map((s) => (
            <TableRow key={s.id}>
              <TableCell><NotYet label="Title" /></TableCell>
              <TableCell className="max-w-[18rem]">
                {s.kind === "url" ? (
                  <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="block truncate text-brand hover:underline" title={s.url}>
                    {s.url}
                  </a>
                ) : (
                  <span className="block truncate" title={s.fileName}>
                    {s.fileName} <span className="text-xs text-muted-foreground">({formatBytes(s.size)})</span>
                    {!s.file && <span className="ml-1 text-xs text-amber-700">· re-attach</span>}
                  </span>
                )}
              </TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-1.5 font-mono text-xs uppercase">
                  {s.kind === "url" ? <Globe className="size-3.5" aria-hidden="true" /> : <FileText className="size-3.5" aria-hidden="true" />}
                  {s.kind}
                </span>
              </TableCell>
              <TableCell><NotYet label="Published date" /></TableCell>
              <TableCell><NotYet label="Retrieved date" /></TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-zinc-400" aria-hidden="true" /> Pending
                </span>
              </TableCell>
              <TableCell>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemove(s.id)}
                  aria-label={`Remove ${s.kind === "url" ? s.url : s.fileName}`}
                >
                  <Trash2 className="text-muted-foreground" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
