# Environment variables

Copy `.env.example` to `.env.local` (git-ignored) and fill in values. On Vercel, add the same keys under
Project → Settings → Environment Variables.

| Variable | Required | Scope | Purpose |
|---|---|---|---|
| `GEMINI_API_KEY` | For AI stages (or BYO / OpenRouter) | Server only | Google AI Studio key. **Default provider.** Sent only as the `x-goog-api-key` header. |
| `GEMINI_MODEL` | No | Server only | Default `gemini-2.5-flash`. If the model returns 404, GapLens falls back to `gemini-2.0-flash` once. |
| `OPENROUTER_API_KEY` | Optional | Server only | Alternative provider. |
| `OPENROUTER_MODEL` | No | Server only | Default `openai/gpt-4o-mini`. Must support JSON mode. |
| `LLM_PROVIDER` | No | Server only | `gemini` or `openrouter`. Empty = auto: Gemini if its key is set, else OpenRouter. A preference whose key is missing is ignored. |
| `NEXT_PUBLIC_SUPABASE_URL` | For persistence | Public | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Reserved | Public | Not used for data access (RLS denies anon). Kept for future client auth. |
| `SUPABASE_SERVICE_ROLE_KEY` | For persistence | **Server only** | Legacy `service_role` JWT or new `sb_secret_…` key. All DB reads/writes go through server code. |
| `FIRECRAWL_API_KEY` | No | Server only | If set, Firecrawl is tried first for URLs. |
| `JINA_API_KEY` | No | Server only | Jina Reader works keyless but blocks anonymous traffic from some IP ranges; a key avoids that. Direct fetch is the final fallback either way. |
| `TAVILY_API_KEY` | No | Server only | Enables the optional "Find sources" web search. Without it the UI says "configuration required"; results are never simulated. |
| `NEXT_PUBLIC_SITE_URL` | No | Public | Sent as `HTTP-Referer` to OpenRouter. |
| `GAPLENS_DB` | No | Server only | `memory` = in-process demo store (lost on restart). For local demos/smoke tests only. |

## Bring-your-own AI key

If no server key is set, a user can pick **Gemini** or **OpenRouter** in the workspace's *AI provider* box and paste
a key. It is stored only in that browser's `localStorage` and sent with AI requests in the
`x-gaplens-llm-provider` / `x-gaplens-llm-key` (and optional `x-gaplens-llm-model`) headers. The server uses it for that
request only and never stores, logs or echoes it. A BYO key takes precedence over the server key for that browser.
With neither, the AI stages show **Configuration required**; extraction and rule-based freshness checks still run.

## Checking what's configured

`GET /api/config` returns booleans and non-secret model ids only, for example:

```json
{
  "llm": {
    "activeProvider": "gemini",
    "preference": "auto",
    "gemini": { "configured": true, "model": "gemini-2.5-flash" },
    "openrouter": { "configured": false, "model": "openai/gpt-4o-mini" }
  },
  "supabase": { "url": true, "anonKey": true, "serviceRoleKey": true, "configured": true },
  "firecrawl": { "configured": false },
  "jinaReader": { "available": true, "keyConfigured": false },
  "search": { "provider": null, "configured": false },
  "pipelineReady": true,
  "byoKeySupported": true
}
```

## Database setup

Apply both migrations in order (SQL editor, `supabase db push`, or the Management API):

1. `supabase/migrations/0001_init.sql`: tables, indexes, RLS (deny anon), grants revoked.
2. `supabase/migrations/0002_source_metadata.sql`: `sources.metadata jsonb` (update date, date evidence, warnings,
   claim progress) and allows `extraction_provider = 'direct'`. Idempotent.

The app tolerates a missing 0002 (it drops the metadata and stores the `direct` provider as NULL), but the "updated" date,
date evidence and per-source warnings are then not persisted.
