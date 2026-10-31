# Environment variables

Copy `.env.example` to `.env.local` (git-ignored) and fill in values. On Vercel, add the same keys under
Project → Settings → Environment Variables.

| Variable | Required | Scope | Purpose |
|---|---|---|---|
| `OPENROUTER_API_KEY` | For analysis (Phase 2+) | Server only | Auth for OpenRouter chat completions. Missing → `ConfigError` from `src/server/ai/openrouter.ts`. |
| `OPENROUTER_MODEL` | No | Server only | Model id. Default `openai/gpt-4o-mini`. Must support `response_format: json_object`. |
| `NEXT_PUBLIC_SUPABASE_URL` | For persistence | Public | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Reserved | Public | Not used for data access in the current design (RLS denies anon). Kept for future client auth. |
| `SUPABASE_SERVICE_ROLE_KEY` | For persistence | **Server only** | Used by `src/server/db/supabase.ts` for all DB reads/writes. Never import into client code. |
| `FIRECRAWL_API_KEY` | No | Server only | If set, URL extraction uses Firecrawl; otherwise Jina Reader (`https://r.jina.ai/`), which needs no key. |
| `JINA_API_KEY` | No | Server only | Optional; higher Jina Reader rate limits. |
| `NEXT_PUBLIC_SITE_URL` | No | Public | Sent as `HTTP-Referer` to OpenRouter. Default `http://localhost:3000`. |

## Checking what's configured

`GET /api/config` returns **booleans only** (plus the non-secret model id), for example:

```json
{
  "openrouter": { "configured": false, "model": "openai/gpt-4o-mini" },
  "supabase": { "url": false, "anonKey": false, "serviceRoleKey": false, "configured": false },
  "firecrawl": { "configured": false },
  "jinaReader": { "available": true, "keyConfigured": false },
  "pipelineReady": false
}
```

`pipelineReady` stays `false` until the Phase 2/3 pipeline is wired, regardless of keys.

## Database setup

Run `supabase/migrations/0001_init.sql` in the Supabase SQL editor, or with the CLI:

```bash
supabase link --project-ref <ref>
supabase db push
```
