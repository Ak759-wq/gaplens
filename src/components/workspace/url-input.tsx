"use client";

import { useId, useState } from "react";
import { Plus } from "lucide-react";
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
      <Label htmlFor={id}>Source URLs</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://example.org/page (paste one or several)"
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
        <Button type="button" variant="outline" onClick={submit} disabled={disabled}>
          <Plus /> Add
        </Button>
      </div>
      <p id={`${id}-help`} className="text-xs text-muted-foreground">
        Public http(s) pages only. Local, private-network and credentialed URLs are rejected.
      </p>
      {errors.length > 0 && (
        <ul id={`${id}-err`} role="alert" className="space-y-1 text-xs text-destructive">
          {errors.map((e) => (
            <li key={e} className="break-all">{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
