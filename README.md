# GapLens

**Don't just find information. Find what's missing.**

GapLens is an AI-powered information-gap detection platform built for the **Shinchan Online Hackathon 2026**.
Give it a research question and several sources (URLs and PDFs) and it surfaces, with evidence:

- **Potential information gaps**: what the question needs that no source states
- **Contradictions** between sources, without picking a side
- **Potentially outdated or undated** information
- **Unanswered questions**
- A **prioritised verification checklist**

Every finding links back to a source and a verbatim quote that's checked against the retrieved text.
It's an audit of your sources, not a chatbot or a summariser.

## Status: Phases 1–5 complete

| Area | State |
|---|---|
| Source ingestion: URLs (Firecrawl → Jina Reader → direct fetch), PDF upload (pdf-parse, 15 MB) | ✅ Live-tested on real Indian government, news and aggregator pages |
| SSRF guard (syntactic + DNS + connect-time re-check, redirects, timeouts, size caps) | ✅ Tested |
| AI provider layer: **Gemini (default)** + OpenRouter, server key or bring-your-own key | ✅ Tested with mocked responses |
| Claim extraction with verbatim-quote verification; gaps, contradictions, freshness, questions, checklist | ✅ Pipeline test with mocked LLM |
| Rule-based freshness (undated ≠ outdated, old dates, past academic cycles, expired deadlines) | ✅ Works without any AI key |
| 8-tab evidence-linked dashboard, pipeline progress, persisted checklist | ✅ |
| History, Markdown export, print / Save-as-PDF report (10 sections) | ✅ |
| Supabase persistence (repositories, migrations 0001 + 0002) | ✅ Code complete (see [docs/DEMO.md](docs/DEMO.md) for live-test status) |

With no AI key, GapLens still reads sources and runs the rule-based date checks; the AI stages show
**Configuration required**. Results are never simulated.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 · shadcn/ui · Lucide ·
Zod · Google Gemini (default) / OpenRouter · Jina Reader / Firecrawl / cheerio · pdf-parse · undici · Supabase (Postgres) · Vitest

## Getting started

```bash
git clone https://github.com/Ak759-wq/gaplens.git
cd gaplens
npm install
cp .env.example .env.local   # fill in keys (see docs/ENV.md)
npm run dev                  # http://localhost:3000
```

Node ≥ 20.18.1 required.

### Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run lint` | ESLint (next/core-web-vitals + typescript), zero warnings allowed |
| `npm test` | Vitest unit + pipeline tests (no network) |
| `LIVE=1 DEMO_URLS="…" npx vitest run tests/live/extract.live.test.ts` | Live extraction + freshness rules on real URLs |
| `LIVE_DB=1 npx vitest run tests/live/db.live.test.ts` | Live Supabase round-trip (needs service-role env) |
| `npm run check` | typecheck + lint + test |

### Environment

See [`docs/ENV.md`](docs/ENV.md). Summary: `GEMINI_API_KEY` (default AI provider), `GEMINI_MODEL`,
`OPENROUTER_API_KEY` / `OPENROUTER_MODEL` (optional), `LLM_PROVIDER`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `FIRECRAWL_API_KEY`, `JINA_API_KEY`, `TAVILY_API_KEY`
(optional web search), `NEXT_PUBLIC_SITE_URL`. `GET /api/config` shows which are set (booleans only).
Users without a server key can paste their own Gemini or OpenRouter key in the workspace (kept in their browser only).

For a quick local demo without Supabase: `GAPLENS_DB=memory npm run dev` (data is lost on restart).

### Database

Apply `supabase/migrations/0001_init.sql` then `0002_source_metadata.sql` (SQL editor, `supabase db push`, or the
Management API). All DB access is server-side via the service-role key; RLS denies the anon key. Details in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#security).

### Deploying to Vercel

`vercel.json` sets `maxDuration: 60` for API routes (Hobby limit) and the Mumbai region. The pipeline is split into
per-source and per-stage calls driven by the browser, so no single request needs more than one model call.
Note Vercel's 4.5 MB request-body limit for PDF uploads.

## Project structure

```
src/
  app/
    (marketing)/page.tsx              landing
    (app)/workspace/                  brief, sources, BYO AI key, web search
    (app)/research/[id]/              pipeline runner + 8-tab dashboard
    (print)/research/[id]/print/      printable 10-section report
    (app)/history/                    past sessions (open / delete)
    api/sessions/**                   sessions, sources, extract, claims, stages, checklist, export
    api/search, api/config, api/health
  components/
    ui/ landing/ workspace/ research/ dashboard/ evidence/ report/ history/ site/
  server/
    ai/        llm.ts (provider abstraction), gemini.ts, openrouter.ts, prompts/, schemas/
    services/  one module per pipeline stage + provenance + corpus helpers
    extract/   HTML / date / PDF parsing
    net/       SSRF-hardened fetch
    pipeline/  stage runners, mappers, session view
    db/        Supabase + in-memory repositories
  lib/         url-safety, validation, api-schemas, dates, env, report-markdown, view-types, client/
supabase/migrations/0001_init.sql, 0002_source_metadata.sql
tests/         fixtures/, pipeline.test.ts, live/ (opt-in)
docs/          ARCHITECTURE.md, ENV.md, DEMO.md
```

## Roadmap

- **Phase 1: Foundation.** UI, schemas, AI client, DB schema, guards, tests.
- **Phase 2: Ingestion.** Extraction providers, DNS-level SSRF check, PDF upload, persistence, source APIs.
- **Phase 3: Analysis.** Gemini-first LLM layer, verified claims, gaps, contradictions, freshness.
- **Phase 4: Dashboard.** Questions, checklist, evidence-linked 8-tab dashboard, progress UI.
- **Phase 5: Ship.** History, Markdown / PDF export, Vercel config, docs.
- **Next:** user accounts + per-user RLS, direct-to-storage PDF upload (lift the 4.5 MB Vercel limit), OCR, rate limiting.

## Continuing in VS Code / GitHub Copilot

1. Open the folder in VS Code and run `npm install`.
2. Read `docs/ARCHITECTURE.md` first. The provenance rules are the contract every change must keep.
3. Each pipeline stage lives in `src/server/services/*.ts` with its prompt in `src/server/ai/prompts/` and its model
   output shape in `src/server/ai/schemas/llmOutputs.ts`. `tests/pipeline.test.ts` shows the full flow with a mocked LLM.
4. Run `npm run check` before every commit; add a Vitest test next to any new logic (`*.test.ts`).
5. Never return placeholder or fabricated findings from a service. Throw `NotImplementedError` or a typed error instead.

## License

All rights reserved (hackathon submission).
