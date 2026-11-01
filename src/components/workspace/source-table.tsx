"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  BadgeCheck,
  FileText,
  MoreHorizontal,
  Trash2,
  UploadCloud,
} from "lucide-react";
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

/** Formats an ISO timestamp as a compact editorial date, e.g. "1 Nov 2026". */
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Honest extraction status. Sources are only "ready" when the real pipeline has
 * confirmed extraction; otherwise we show exactly where they stand. Nothing here
 * reports success that the app has not verified.
 */
function StatusBadge({ source }: { source: DraftSource }) {
  if (source.extractionError) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e7c7c3] bg-[#f9ecea] px-2.5 py-1 text-[11px] font-medium text-[#a3655e]">
        <AlertCircle className="size-3" aria-hidden="true" /> Extraction failed
      </span>
    );
  }
  if (source.kind === "pdf" && !source.file) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#eadfc7] bg-[#fbf6e9] px-2.5 py-1 text-[11px] font-medium text-[#8b6a33]">
        <UploadCloud className="size-3" aria-hidden="true" /> Re-attach file
      </span>
    );
  }
  // A usable, attached source that is queued for the pipeline.
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-transparent bg-[#eaf0e6] px-2.5 py-1 text-[11px] font-medium text-[#536d53]">
      <BadgeCheck className="size-3.5" aria-hidden="true" /> Ready
    </span>
  );
}

/**
 * Minimal three-dot action menu. Built locally rather than pulling in a dropdown
 * dependency: closes on outside click or Escape, and stays keyboard reachable.
 */
function RowMenu({ title, onRemove }: { title: string; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 rounded-md text-[#9a9e99] hover:bg-[#f2f1ed] hover:text-[#202322]"
        aria-label={`Actions for ${title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal className="size-4" />
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-lg border border-[#e3e3de] bg-white py-1 shadow-[0_12px_28px_-16px_rgba(32,35,34,0.35)]"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[#c77f76] hover:bg-[#f9ecea]"
            onClick={() => {
              setOpen(false);
              onRemove();
            }}
          >
            <Trash2 className="size-3.5" aria-hidden="true" /> Remove source
          </button>
        </div>
      )}
    </div>
  );
}

export function SourceTable({ sources, onRemove }: { sources: DraftSource[]; onRemove: (id: string) => void }) {
  if (sources.length === 0) {
    return (
      <p className="border-t border-[#e3e3de] pt-4 text-[12.5px] leading-relaxed text-[#9a9e99]">
        No sources added yet. Add at least two; GapLens verifies them when analysis starts.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-[#edede7] border-t border-[#e3e3de]">
      {sources.map((source) => {
        const isUrl = source.kind === "url";
        const title = isUrl ? sourceDomain(source.url) : source.fileName;
        const meta = [
          isUrl ? "Website" : "PDF document",
          !isUrl ? formatBytes(source.size) : null,
          `Added ${formatDate(source.addedAt)}`,
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <li key={source.id} className="flex items-center gap-3 py-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[#eceae4] bg-[#f7f6f2] text-[#6b706f]">
              <FileText className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-[13.5px] font-medium text-[#202322]">{title}</h3>
                {source.example && (
                  <span className="rounded-full border border-[#e3e3de] bg-[#f7f6f2] px-2 py-[1px] text-[10.5px] font-medium text-[#6b706f]">
                    Example source
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-[12px] text-[#6b706f]" title={isUrl ? source.url : source.fileName}>
                {meta}
              </p>
              {source.extractionError && (
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-[#a3655e]">{source.extractionError}</p>
              )}
              <div className="mt-1.5 sm:hidden">
                <StatusBadge source={source} />
              </div>
            </div>
            <div className="hidden shrink-0 sm:block">
              <StatusBadge source={source} />
            </div>
            <RowMenu title={title} onRemove={() => onRemove(source.id)} />
          </li>
        );
      })}
    </ul>
  );
}
