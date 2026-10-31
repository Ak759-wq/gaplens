# GapLens architecture

> Don't just find information. Find what's missing.

GapLens is an **information-gap detector**, not a chatbot or summariser. Given a research brief and a set of
sources, it produces typed, evidence-linked findings: gaps, contradictions, freshness warnings,
unanswered questions and a prioritised verification checklist.

## Pipeline

```
 ┌──────────────┐   ┌──────────────────┐   ┌──────────────────┐
 │ Research     │   │ sourceExtractor   │   │ claimExtractor    │
 │ brief +      ├──►│ URL: Firecrawl or ├──►│ LLM → Claim[]     │
 │ URLs / PDFs  │   │ Jina Reader       │   │ each with verbatim│
 └──────────────┘   │ PDF: pdf-parse    │   │ quote + category  │
   SSRF guard       │ → Source + text   │   └────────┬─────────┘
   (lib/url-safety) └──────────────────┘            │ verifyQuoteInSource()
                                                     ▼  (drop unverifiable)
          ┌────────────────────┬─────────────────────┼─────────────────────┐
          ▼                    ▼                     ▼                     │
 ┌────────────────┐  ┌──────────────────────┐  ┌───────────────────┐       │
 │ gapDetector    │  │ contradictionDetector│  │ freshnessAnalyzer │       │
 │ Gap[]          │  │ Contradiction[]      │  │ deterministic date│       │
 └───────┬────────┘  └──────────┬───────────┘  │ pass + LLM pass   │       │
         │                      │              └─────────┬─────────┘       │
         └──────────────┬───────┴────────────────────────┘                 │
                        ▼  FindingsBundle (evidence re-verified)           │
          ┌─────────────────────────┐   ┌────────────────────────┐         │
          │ questionGenerator       │   │ checklistGenerator      │         │
          │ Question[]              │   │ ChecklistItem[] (H/M/L) │         │
          └────────────┬────────────┘   └───────────┬────────────┘         │
                       └──────────────┬─────────────┘                      │
                                      ▼                                    │
                           ┌──────────────────────┐                        │
                           │ reportGenerator      │◄───────────────────────┘
                           │ Report (zod-validated)│
                           └──────────┬───────────┘
                                      ▼
                     Supabase: research_sessions, sources, claims,
                     findings, checklist_items, reports
```

## Code layout

| Path | Responsibility |
|---|---|
| `src/app/(marketing)/page.tsx` | Landing page |
| `src/app/(app)/workspace` | Research brief + source intake (client state, localStorage draft) |
| `src/app/(app)/research/[id]` | Report dashboard (8 tabs) |
| `src/app/(app)/history` | Past sessions |
| `src/app/api/health`, `src/app/api/config` | Liveness; integration status (booleans only) |
| `src/components/ui` | shadcn/ui primitives (new-york style, Tailwind v4) |
| `src/components/evidence` | `FindingBadge`, `FindingLegend`, label palette |
| `src/server/ai/openrouter.ts` | Server-only OpenRouter client: JSON mode, Zod validation, retry/backoff on 408/429/5xx (honours `Retry-After`), `ConfigError` when unkeyed |
| `src/server/ai/prompts/*` | One prompt builder per stage; shared `PROVENANCE_RULES` |
| `src/server/ai/schemas/*` | Zod schemas: Source, Claim, Gap, Contradiction, FreshnessWarning, Question, ChecklistItem, Report |
| `src/server/services/*` | One module per pipeline stage (Phase 1: typed signatures throwing `NotImplementedError`) + `provenance.ts` (implemented) |
| `src/server/db` | Service-role Supabase client, row types, repository interfaces |
| `src/lib` | `url-safety` (SSRF guard), `validation` (zod), `dates`, `env` (integration status) |
| `supabase/migrations` | SQL schema + RLS |

All server modules import `server-only`, so importing them into a client component fails the build.

## Provenance rules (non-negotiable)

1. **Every claim traces to a source and a verbatim quote.** `Claim` requires `sourceId` and `quote`; findings
   reference claims via `EvidenceRef { claimId, sourceId, quote }`.
2. **Citations are verified against stored text.** `verifyQuoteInSource()` (whitespace/case/smart-quote
   insensitive) must find each quote in the stored `content_text`; unverifiable claims are dropped, never shown.
   Offsets are stored in `claims.char_start/char_end` for highlighting.
3. **Missing from sources ≠ nonexistent.** Gaps are phrased "not found in the reviewed sources" and use the
   labels `potential_gap` / `not_found_in_sources`.
4. **Undated ≠ outdated.** A null `published_at` is `undated`, a distinct `FreshnessWarning.reason`, and is never
   labelled "Potentially outdated". `lib/dates.ageBucket()` returns `"undated"` for null.
5. **Never pick a winner arbitrarily in a contradiction.** `Contradiction.positions` requires ≥2 evidenced
   positions; the model may list possible explanations but only resolves a conflict when a source explicitly
   supersedes another.
6. **No invented metadata.** Titles and dates come only from the source; otherwise they stay null and the UI
   shows "—" / "Pending".
7. **AI-generated suggestions are labelled** as "AI suggestion" (purple), distinct from source-backed findings.

## Finding labels

| Label | Colour | Meaning |
|---|---|---|
| Verified in source | green | Quote found verbatim in a reviewed source |
| Potential gap | orange | Needed information not covered |
| Possible contradiction | red | Sources disagree |
| Potentially outdated | amber | Date/cycle suggests it may not be current |
| Not found in reviewed sources | grey, dashed | Not stated in reviewed sources |
| Requires verification | slate | Confirm with an authoritative source |
| AI suggestion | purple | Model-generated, not from a source |
| Info | blue | Neutral context |

## Security

- **SSRF:** `checkUrl()` permits only http(s), rejects credentials, local/internal hostnames, single-label hosts,
  numeric-encoded IPs and private/loopback/link-local/CGNAT/multicast/reserved IPv4 and IPv6 (incl. v4-mapped and
  NAT64). Phase 2 adds `assertPublicHost()` to re-check resolved DNS addresses before fetching (anti-rebinding),
  plus redirect re-validation, timeouts and response-size caps.
- **Secrets:** API keys are read only in server modules. `/api/config` exposes booleans only. `.env*` is
  git-ignored except `.env.example`.
- **Database access:** all reads/writes go through server code using `SUPABASE_SERVICE_ROLE_KEY`. RLS is
  enabled on every table with **no** anon/authenticated policies, and those roles' table grants are revoked, so the
  public anon key can't touch data. `research_sessions.owner_id` is reserved for per-user policies if auth is
  added later.
