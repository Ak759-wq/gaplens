"use client";

import { useEffect, useId, useState } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BYO_CHANGED_EVENT, loadByoSettings, maskKey, saveByoSettings, type ByoLlmSettings } from "@/lib/client/llm-settings";

export type ServerLlmStatus = { activeProvider: "gemini" | "openrouter" | null; geminiModel: string; openrouterModel: string };

const PROVIDERS = {
  gemini: { name: "Google Gemini", hint: "Free key from Google AI Studio (aistudio.google.com/apikey).", placeholder: "AIza…" },
  openrouter: { name: "OpenRouter", hint: "Key from openrouter.ai/keys.", placeholder: "sk-or-…" },
} as const;

/** Hook: current BYO settings, kept in sync across components. */
export function useByoSettings(): ByoLlmSettings | null {
  const [s, setS] = useState<ByoLlmSettings | null>(null);
  useEffect(() => {
    const sync = () => setS(loadByoSettings());
    sync();
    window.addEventListener(BYO_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(BYO_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return s;
}

export function AiSettings({ server }: { server: ServerLlmStatus }) {
  const id = useId();
  const saved = useByoSettings();
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<"gemini" | "openrouter">("gemini");
  const [key, setKey] = useState("");
  const [model, setModel] = useState("");

  const active = saved ? `${PROVIDERS[saved.provider].name} (your key ${maskKey(saved.apiKey)})` : server.activeProvider ? `${PROVIDERS[server.activeProvider].name} (server key)` : null;

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex items-start gap-2.5">
        <KeyRound className="mt-0.5 size-4 shrink-0 text-violet-600" aria-hidden="true" />
        <div className="min-w-0 text-sm">
          <p className="font-medium">AI provider</p>
          <p className="text-muted-foreground">{active ?? <span className="text-amber-700">Configuration required: no AI key yet.</span>}</p>
        </div>
      </div>
      {!open ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
            {saved ? "Change key" : "Use my own key"}
          </Button>
          {saved && (
            <Button type="button" variant="ghost" size="sm" onClick={() => saveByoSettings(null)}>
              Remove my key
            </Button>
          )}
        </div>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!key.trim()) return;
            saveByoSettings({ provider, apiKey: key.trim(), model: model.trim() || undefined });
            setKey("");
            setModel("");
            setOpen(false);
          }}
        >
          <fieldset className="space-y-1.5">
            <legend className="text-xs font-medium">Provider</legend>
            <div className="flex gap-2" role="radiogroup">
              {(Object.keys(PROVIDERS) as (keyof typeof PROVIDERS)[]).map((p) => (
                <label key={p} className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs ${provider === p ? "border-brand bg-brand-soft" : ""}`}>
                  <input type="radio" name={`${id}-provider`} value={p} checked={provider === p} onChange={() => setProvider(p)} className="accent-[var(--brand)]" />
                  {PROVIDERS[p].name}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{PROVIDERS[provider].hint}</p>
          </fieldset>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-key`} className="text-xs">API key</Label>
            <Input id={`${id}-key`} type="password" autoComplete="off" spellCheck={false} placeholder={PROVIDERS[provider].placeholder} value={key} onChange={(e) => setKey(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-model`} className="text-xs">
              Model <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input id={`${id}-model`} placeholder={provider === "gemini" ? server.geminiModel : server.openrouterModel} value={model} onChange={(e) => setModel(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" variant="brand" disabled={!key.trim()}>
              Save in this browser
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
      <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        Your key stays in this browser (localStorage) and is sent only with analysis requests. GapLens never stores or logs it.
      </p>
    </div>
  );
}
