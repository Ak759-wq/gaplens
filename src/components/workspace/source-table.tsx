"use client";

import { AlertCircle, Clock3, FileText, Globe, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/validation";
import type { DraftSource } from "./types";

function sourceDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function StatusBadge({ source }: { source: DraftSource }) {
  if (source.extractionError) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e7c7c3] bg-[#f9ecea] px-2 py-1 text-[11px] font-medium text-[#a66760]">
        <AlertCircle className="size-3.5" /> Failed
      </span>
    );
  }
  if (source.kind === "pdf" && !source.file) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#eadfc7] bg-[#fbf6e9] px-2 py-1 text-[11px] font-medium text-[#8b6a33]">
        <UploadCloud className="size-3.5" /> Re-attach file
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e3e3de] bg-[#f4f4f0] px-2 py-1 text-[11px] font-medium text-[#6b706f]">
      <Clock3 className="size-3.5" /> Waiting for extraction
    </span>
  );
}

export function SourceTable({ sources, onRemove }: { sources: DraftSource[]; onRemove: (id: string) => void }) {
  if (sources.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#d4d5cf] bg-[#faf9f6] px-6 py-10 text-center">
        <p className="text-sm font-medium text-[#202322]">No sources added yet</p>
        <p className="mt-1 text-sm text-[#6b706f]">Add at least two sources. GapLens verifies them when analysis starts.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-[#e3e3de] rounded-xl border border-[#e3e3de] bg-[#faf9f6]">
      {sources.map((source) => {
        const isUrl = source.kind === "url";
        const title = isUrl ? sourceDomain(source.url) : source.fileName;
        const detail = isUrl ? source.url : `${formatBytes(source.size)} PDF document`;
        return (
          <article key={source.id} className="group flex items-start gap-3 bg-white px-4 py-3.5 transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-[#fdfcf9]">
            <div className="flex items-start gap-3">
              <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${isUrl ? "bg-[#eaf0e6] text-[#536d53]" : "bg-[#f4f4f0] text-[#6b706f]"}`}>
                {isUrl ? <Globe className="size-4" /> : <FileText className="size-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-medium text-[#202322]">{title}</h3>
                      {source.example && <span className="rounded-full bg-[#eaf0e6] px-2 py-0.5 text-[10px] font-medium text-[#536d53]">Example</span>}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-[#6b706f]" title={isUrl ? source.url : source.fileName}>{detail}</p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0 text-[#9a9e99] hover:bg-[#f9ecea] hover:text-[#a66760]" onClick={() => onRemove(source.id)} aria-label={`Remove ${title}`}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <StatusBadge source={source} />
                  <span className="text-[11px] text-[#9a9e99]">{isUrl ? "URL" : "PDF"} · Added</span>
                </div>
                {source.extractionError && <p className="mt-2 text-xs leading-relaxed text-[#a66760]">{source.extractionError}</p>}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
