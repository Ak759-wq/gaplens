"use client";

import { useId, useState } from "react";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkUrl, urlDedupKey } from "@/lib/url-safety";

export function UrlInput({
  existingKeys,
  disabled,
  onAdd,
}: {
  existingKeys: Set<string>;
  disabled?: boolean;
  onAdd: (items: { url: string; dedupKey: string }[]) => void;
}) {
  const id = useId();
  const [value, setValue] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  function submit() {
    const candidates = value
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (candidates.length === 0) {
      setErrors(["Enter at least one URL."]);
      return;
    }
    const seen = new Set(existingKeys);
    const ok: { url: string; dedupKey: string }[] = [];
    const errs: string[] = [];
    for (const c of candidates) {
      const r = checkUrl(c);
      if (!r.ok) {
        errs.push(`${c}: ${r.reason}`);
        continue;
      }
      const key = urlDedupKey(r.url);
      if (seen.has(key)) {
        errs.push(`${c}: already added.`);
        continue;
      }
      seen.add(key);
      ok.push({ url: r.normalized, dedupKey: key });
    }
    if (ok.length) onAdd(ok);
    setErrors(errs);
    setValue(errs.length ? candidates.filter((c) => errs.some((e) => e.startsWith(`${c}:`))).join("\n") : "");
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="sr-only">
        Website URL
      </Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Link2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#9a9e99]" aria-hidden="true" />
          <Input
            id={id}
            type="text"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste a website URL"
            className="h-10 w-full rounded-lg border-[#e3e3de] bg-white pl-9 text-[13.5px] text-[#202322] shadow-none placeholder:text-[#9a9e99] focus-visible:border-[#202725]/30 focus-visible:ring-[#202725]/10"
            value={value}
            disabled={disabled}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            aria-invalid={errors.length > 0 || undefined}
            aria-describedby={`${id}-help ${errors.length ? `${id}-err` : ""}`}
          />
        </div>
        <Button
          type="button"
          className="h-10 shrink-0 rounded-lg bg-[#202725] px-5 text-[13.5px] font-medium text-white shadow-none hover:bg-[#2f3633]"
          onClick={submit}
          disabled={disabled}
        >
          Add source
        </Button>
      </div>
      <p id={`${id}-help`} className="sr-only">
        Public http(s) pages only. Paste several separated by spaces or commas. Local, private-network and credentialed
        URLs are rejected.
      </p>
      {errors.length > 0 && (
        <ul id={`${id}-err`} role="alert" className="space-y-1 text-xs text-[#c77f76]">
          {errors.map((e) => (
            <li key={e} className="break-all">{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
