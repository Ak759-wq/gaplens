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

## Status: Phase 1 (foundation)

| Area | State |
|---|---|
| Landing page, research workspace, dashboard shell, history shell | ✅ Built |
| Zod schemas for every pipeline stage | ✅ |
| OpenRouter client (JSON mode, retries, ConfigError) | ✅ (needs `OPENROUTER_API_KEY` to run) |
| Prompts per stage | ✅ Drafted (v0) |
| SSRF guard, validation, date helpers, citation verifier | ✅ Tested |
| Supabase client, repository interfaces, migration SQL | ✅ (needs Supabase creds; migration not yet applied) |
| Extraction / analysis services | ⏳ Typed stubs that throw `NotImplementedError` (no fake output) |
| Analyse button | Disabled with an explanation until Phase 2/3 |

## Stack

Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 · shadcn/ui · Lucide ·
Zod · OpenRouter · Jina Reader / Firecrawl · pdf-parse · Supabase (Postgres) · Vitest

## Getting started

```bash
git clone https://github.com/Ak759-wq/gaplens.git
cd gaplens
npm install
cp .env.example .env.local   # fill in keys (see docs/ENV.md)
npm run dev                  # http://localhost:3000
```

Node ≥ 20.9 required.

### Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run lint` | ESLint (next/core-web-vitals + typescript), zero warnings allowed |
| `npm test` | Vitest unit tests |
| `npm run check` | typecheck + lint + test |

### Environment

See [`docs/ENV.md`](docs/ENV.md). Summary: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`,
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`FIRECRAWL_API_KEY` (optional), `JINA_API_KEY` (optional), `NEXT_PUBLIC_SITE_URL`.
`GET /api/config` shows which are set (booleans only).

### Database

Apply `supabase/migrations/0001_init.sql` (SQL editor or `supabase db push`). All DB access is server-side
via the service-role key; RLS denies the anon key. Details in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#security).

## Project structure

```
src/
  app/
    (marketing)/page.tsx        landing
    (app)/workspace/            research intake
    (app)/research/[id]/        report dashboard (8 tabs)
    (app)/history/              past sessions
    api/health, api/config      liveness + integration status
  components/
    ui/ landing/ workspace/ dashboard/ evidence/ site/
  server/
    ai/openrouter.ts  ai/prompts/  ai/schemas/
    services/   (one module per pipeline stage)
    db/         (supabase client, row types, repositories)
  lib/          url-safety, validation, dates, env, utils
supabase/migrations/0001_init.sql
docs/ARCHITECTURE.md  docs/ENV.md
```

## Roadmap

- **Phase 1: Foundation** (this release). UI, schemas, AI client, DB schema, guards, tests.
- **Phase 2: Ingestion.** `sourceExtractor` (Firecrawl → Jina fallback, pdf-parse), DNS-level SSRF check,
  session + source persistence, PDF upload API, live extraction status in the workspace.
- **Phase 3: Analysis.** Claim extraction with quote verification, gap / contradiction / freshness detection,
  questions, checklist, report assembly; dashboard tabs render real findings with evidence drawers.
- **Phase 4: Polish and ship.** History list, export (Markdown/PDF), rate limiting, deploy to Vercel.

## Continuing in VS Code / GitHub Copilot

1. Open the folder in VS Code and run `npm install`.
2. Read `docs/ARCHITECTURE.md` first. The provenance rules are the contract every change must keep.
3. Each stub in `src/server/services/*.ts` has a `TODO(Phase N)` block describing exactly what to implement,
   which prompt in `src/server/ai/prompts/` to use, and which Zod schema validates the output. Point Copilot at
   one stub at a time.
4. Run `npm run check` before every commit; add a Vitest test next to any new logic (`*.test.ts`).
5. Never return placeholder or fabricated findings from a service. Throw `NotImplementedError` or a typed error instead.

## License

All rights reserved (hackathon submission).
