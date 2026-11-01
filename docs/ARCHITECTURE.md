# GapLens architecture

> Don't just find information. Find what's missing.

GapLens is an **information-gap detector**, not a chatbot or summariser. Given a research brief and a set of
sources, it produces typed, evidence-linked findings: gaps, contradictions, freshness warnings,
unanswered questions and a prioritised verification checklist.

## Pipeline

The browser drives the pipeline one short API call at a time, so every call fits Vercel's 60-second function limit
(Hobby plan). Each stage reads its inputs from Postgres and **replaces** its own outputs, so any stage can be re-run.

```
 Workspace (brief + URLs + PDFs)
   │ POST /api/sessions                      create session + URL sources (SSRF-checked)
   │ POST /api/sessions/:id/sources          PDF upload (multipart, ≤15 MB) → pdf-parse → text stored
   ▼
 /research/:id?run=1  ── PipelineRunner (client) ─────────────────────────────────────────────┐
   1 POST …/sources/:sid/extract   ×N (3 parallel)  sourceExtractor                            │
        Firecrawl (if key) → Jina Reader → direct fetch (SSRF-guarded) │ PDFs: pdf-parse        │
        title + dates from metadata / JSON-LD / "Last updated" text; never invented            │
   2 POST …/claims {sourceId, chunk} ×N×chunks       claimExtractor (LLM, 24k-char chunks)      │
        every quote verified verbatim against stored text → unverifiable claims DROPPED        │
   3 POST …/stages/gaps             topicPlanner (brief + domain checklist, never sees claims) → gapDetector: strict, cycle-scoped coverage
   4 POST …/stages/contradictions   deterministic cross-source pairing by topic → LLM judges pairs
   5 POST …/stages/freshness        deterministic date/cycle/deadline rules → optional LLM assist
   6 POST …/stages/questions        questionGenerator (each tied to ≥1 finding)               │
   7 POST …/stages/checklist        checklistGenerator (High/Medium/Low, ≥1 finding each)      │
   8 POST …/stages/report           reportGenerator (deterministic) → session "complete"       │
   ▼                                                                                            │
 GET /api/sessions/:id  → SessionView (no raw text) → 8-tab dashboard ◄────────────────────────┘
 GET /api/sessions/:id/export?format=md · /research/:id/print (Save as PDF) · /history
```

Rate limits (Gemini free tier): the server waits at most ~12 s inside a request; longer `RetryInfo` delays come back
as HTTP 429 `{code:"rate_limited", retryAfterSec}` and the runner counts down and retries (up to 6 times per call).
The pipeline makes `N_sources × chunks + 5` model calls (claims per source, then gaps, contradictions,
freshness-assist, questions, checklist); the report is assembled without a model call.

## Code layout

| Path | Responsibility |
|---|---|
| `src/app/(app)/workspace` | Brief + sources, BYO AI key, optional web search, starts a session |
| `src/app/(app)/research/[id]` | Pipeline runner + 8-tab dashboard |
| `src/app/(print)/research/[id]/print` | Print-friendly 10-section report |
| `src/app/(app)/history` | Sessions from the database, open/delete |
| `src/app/api/sessions/**` | Session, source, extraction, claims, stage, checklist and export routes |
| `src/app/api/search` | Optional Tavily search (suggests URLs; never adds them itself) |
| `src/app/api/config`, `health` | Secret-free integration status, verified provider/database readiness, liveness |
| `src/server/ai/llm.ts` | Provider abstraction: resolution (BYO → `LLM_PROVIDER` → auto Gemini-first), JSON + Zod validation with one corrective retry |
| `src/server/ai/gemini.ts` | Gemini REST (`x-goog-api-key` only), `responseMimeType: application/json` + `responseSchema`, 2.0-flash fallback on 404, `RetryInfo` backoff, thinking off for 2.5-flash latency |
| `src/server/ai/openrouter.ts` | OpenRouter client (optional provider) |
| `src/server/ai/zodToGeminiSchema.ts` | Zod → Gemini `responseSchema` (falls back to plain JSON mode if unsupported) |
| `src/server/ai/prompts/*` | One prompt per stage (v1); shared `PROVENANCE_RULES` |
| `src/server/ai/schemas/*` | Domain schemas + lenient `llmOutputs` (model output shapes) |
| `src/server/services/*` | One module per stage; `corpus.ts` short aliases (S1/C1/F1) + evidence helpers; `provenance.ts` quote verifier |
| `src/server/extract/*` | HTML → text/title/dates (cheerio), loose date parsing, PDF extraction |
| `src/server/net/safeFetch.ts` | SSRF-hardened fetch (see Security) |
| `src/server/pipeline/*` | Stage runners over repositories, row mappers, `SessionView` builder |
| `src/server/db/*` | Repository contracts, Supabase implementation, in-memory implementation (tests / `GAPLENS_DB=memory`) |
| `src/server/integrations/health.ts` | Live, bounded checks for the selected server AI provider and required Supabase tables |
| `src/lib/report-markdown.ts` | 10-section Markdown report |
| `supabase/migrations` | `0001_init.sql`, `0002_source_metadata.sql`, `0003_source_content_dedup.sql` |

All server modules import `server-only`, so importing them into a client component fails the build.

## Data model

- `research_sessions`: brief + status (`draft → extracting → analyzing → complete`).
- `sources`: one row per URL/PDF. `published_at` = the source's stated publication date, else its stated update date;
  `metadata` (0002) holds the update date, where each date came from, warnings, extraction provider and claim progress.
  PDF files themselves are not stored, only their extracted text. URL identity is normalized in application code,
  and 0003 prevents identical extracted content from being added twice within one session.
- `claims`: verified claims only (`quote_verified = true`, char offsets for highlighting).
- `findings`: `type` gap | contradiction | freshness | question. The full typed object is kept in `payload`.
  Gap-type rows hold **topic coverage**: one row per required topic, labelled `verified_in_source` (covered),
  `potential_gap` (partial) or `not_found_in_sources` (missing).
- `checklist_items`: action, priority, rationale, `finding_ids`, persisted `done`.
- `reports`: validated report snapshot (sources without text) + coverage overview + limitations.

## Provenance rules (non-negotiable)

1. **Every claim traces to a source and a verbatim quote.** The model's quote is verified against the stored text
   (whitespace/case/smart-quote-insensitive). If not found, the claim is dropped and counted in the report's limitations.
   An ellipsis-joined quote is reduced to its longest verbatim fragment, or dropped.
2. **The model never supplies evidence quotes after claim extraction.** Later stages cite claims by alias
   (C12); the server resolves aliases to stored, verified claims and builds the evidence from them. Unknown aliases are dropped.
3. **Coverage needs evidence.** A topic the model calls "covered" without a valid claim becomes "missing"; one called
   "missing" but citing claims becomes "partial". Topics are planned from the brief and a domain checklist in a call that never
   sees the claims (no circular "covered"). If the question names a cycle/year (e.g. 2026-27), "covered" also needs a cited claim
   for that cycle (deadlines must state the year themselves; other topics may inherit an in-force source such as
   "2022-23 onwards"), and evidence only from an undated third-party site is downgraded to "partial / requires verification"
   (`src/server/services/scope.ts`, `topicPlanner.ts`, `gapDetector.ts`).
3a. **Cycle mismatch ≠ contradiction.** Claims carry their cycle and extracted values (₹, %, dates) into the contradiction
   check; differences between different cycles are stored as `kind: "cycle_mismatch"`, not counted as contradictions.
3b. **AI freshness defers to the rules.** AI past-cycle/old notes that rest on "onwards / until further orders" wording are
   suppressed; others on an in-force source are downgraded. "Superseded by a newer source" needs a cited source with a
   reliable later date.
4. **Missing from sources ≠ nonexistent.** Gaps say "not found in the reviewed sources".
5. **Undated ≠ outdated.** An undated source gets reason `undated`, label *Requires verification*, never
   *Potentially outdated*. Reader-reported "published" dates equal to the retrieval day are ignored as likely dynamic.
6. **No arbitrary winners.** Contradictions need ≥2 positions backed by claims from ≥2 different sources. The
   authority note is deterministic (official `.gov.in`/`.nic.in`/`.ac.in`/`.edu` domain, newest stated date, undated count)
   and always says GapLens does not decide which source is correct.
7. **No invented metadata.** Titles and dates come only from the source; otherwise null ("Undated", "No title found").
8. **AI suggestions are labelled** (purple): questions, checklist items, "what to investigate", possible explanations,
   AI-assisted freshness warnings.

## Freshness rules (deterministic, no AI needed)

| Rule | Reason | Label |
|---|---|---|
| No stated date | `undated` | Requires verification |
| Latest stated date ≥ 365 days old (≥ 730 → high) | `dated_old` | Potentially outdated |
| Latest academic year mentioned (e.g. 2024-25) before the current cycle (cycles start in June; "2022-23 onwards" counts as current) | `references_past_cycle` | Potentially outdated |
| Every deadline the source states has passed | `expired_deadline` | Potentially outdated |
| Archival wording ("has been superseded", "no longer valid") | `old_version` | Potentially outdated |

The LLM pass then looks for supersession between sources and cycle references the rules miss; its warnings must cite claims
and are shown as *AI-assisted*.

## Finding labels

| Label | Colour | Meaning |
|---|---|---|
| Verified in source | green | Quote found verbatim in a reviewed source |
| Potential gap | orange | Needed information only partly covered |
| Possible contradiction | red | Sources disagree |
| Potentially outdated | amber | Date/cycle/deadline suggests it may not be current |
| Not found in reviewed sources | grey, dashed | Not stated in reviewed sources |
| Requires verification | slate | Confirm with an authoritative source (incl. undated sources) |
| AI suggestion | purple | Model-generated, not from a source |
| Info | blue | Neutral context (coverage overview, authority signals) |

## Security

- **SSRF:** `checkUrl()` permits only http(s), rejects credentials, local/internal hostnames, single-label hosts,
  numeric-encoded IPs and private/loopback/link-local/CGNAT/multicast/reserved IPv4 and IPv6. `assertPublicHost()` resolves
  DNS and rejects any private address before **any** provider is called. Direct fetches use an undici `Agent` whose
  `connect.lookup` re-checks the address actually connected to (closes the DNS-rebinding window), manual redirects
  (max 5, each hop re-validated), a 15–20 s timeout and a 15 MB response cap.
- **Secrets:** server keys are read only in server modules. `/api/config` exposes booleans only. BYO keys travel per
  request in headers, are never persisted or logged, and error responses never echo provider messages that could contain them.
  The Gemini client sends only `x-goog-api-key` (no `Authorization` header).
- **Database access:** all reads/writes go through server code with the service-role/secret key. RLS is enabled on every
  table with **no** anon/authenticated policies and those roles' grants are revoked, so the public anon key can't touch data
  (verified live: an anon request gets `permission denied`). `research_sessions.owner_id` is reserved for per-user policies.
- **Input validation:** every API body is Zod-validated (`src/lib/api-schemas.ts`); ids must be UUIDs; ≤12 sources per session.

## Known limits

- Vercel's serverless request body limit is 4.5 MB, so PDFs between 4.5 and 15 MB upload fine locally but not on Vercel
  (a direct-to-storage upload would lift this).
- Scanned PDFs (no text layer) are rejected; there is no OCR.
- JavaScript-only pages yield little text via direct fetch; Jina Reader / Firecrawl handle many of them.
- No user accounts: anyone with a session URL can open it. Add Supabase Auth + `owner_id` policies before real users.
