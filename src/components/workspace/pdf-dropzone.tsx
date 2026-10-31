"use client";

import { useId, useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_PDF_BYTES, checkPdfFile } from "@/lib/validation";

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
      <span className="text-sm font-medium text-[#202322]" id={`${id}-label`}>Add PDF documents</span>
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
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#cfd1ca] bg-[#faf9f6] px-4 py-7 text-center transition-colors",
          "focus-within:ring-[3px] focus-within:ring-[#536d53]/20 hover:bg-[#f4f4f0]",
          dragging && "border-[#536d53] bg-[#eaf0e6]",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <UploadCloud className="size-6 text-[#6b706f]" aria-hidden="true" />
        <span className="text-sm">
          <span className="font-medium text-[#202322]">Choose PDFs</span> or drag them here
        </span>
        <span className="text-xs text-[#6b706f]">PDF only, up to {Math.round(MAX_PDF_BYTES / 1024 / 1024)} MB each</span>
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
        <ul role="alert" className="space-y-1 text-xs text-destructive">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
