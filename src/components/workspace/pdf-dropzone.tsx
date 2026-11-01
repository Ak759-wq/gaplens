"use client";

import { useId, useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_PDF_BYTES, MAX_SOURCES, checkPdfFile } from "@/lib/validation";

export function PdfDropzone({
  existingKeys,
  disabled,
  onAdd,
}: {
  existingKeys: Set<string>;
  disabled?: boolean;
  onAdd: (files: { file: File; dedupKey: string }[]) => void;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  function handle(list: FileList | null) {
    if (!list || list.length === 0) return;
    const seen = new Set(existingKeys);
    const ok: { file: File; dedupKey: string }[] = [];
    const errs: string[] = [];
    for (const file of Array.from(list)) {
      const r = checkPdfFile(file);
      if (!r.ok) {
        errs.push(r.reason);
        continue;
      }
      const key = `pdf:${file.name.toLowerCase()}:${file.size}`;
      if (seen.has(key)) {
        errs.push(`${file.name}: already added.`);
        continue;
      }
      seen.add(key);
      ok.push({ file, dedupKey: key });
    }
    if (ok.length) onAdd(ok);
    setErrors(errs);
  }

  return (
    <div className="space-y-2">
      <span className="sr-only" id={`${id}-label`}>
        PDF documents
      </span>
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) handle(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2.5 rounded-xl border border-dashed border-[#d8d9d2] bg-white px-4 py-9 text-center transition-colors",
          "focus-within:ring-[3px] focus-within:ring-[#536d53]/20 hover:border-[#b9bbb3] hover:bg-[#fbfbf8]",
          dragging && "border-[#536d53] bg-[#eaf0e6]",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <UploadCloud className="size-5 text-[#6b706f]" aria-hidden="true" />
        <span className="text-[13.5px] text-[#202322]">
          Drop PDF files here or <span className="underline underline-offset-2">browse</span>
        </span>
        <span className="text-[12px] text-[#9a9e99]">
          Add at least 2 usable sources · Up to {MAX_SOURCES} sources
        </span>
        <span className="sr-only">
          PDF only, up to {Math.round(MAX_PDF_BYTES / 1024 / 1024)} MB each.
        </span>
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="sr-only"
          aria-labelledby={`${id}-label`}
          disabled={disabled}
          onChange={(e) => {
            handle(e.target.files);
            if (inputRef.current) inputRef.current.value = "";
          }}
        />
      </label>
      {errors.length > 0 && (
        <ul role="alert" className="space-y-1 text-xs text-[#c77f76]">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
