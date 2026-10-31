# GapLens demo: Central Sector Scheme of Scholarship (CSSS / PM-USP)

Real-world success scenario for an Indian government scholarship, run from the build sandbox on
**31 Oct 2026 (IST)**. Everything below is what the pipeline actually produced. Nothing is hand-written into results.

## Brief

- **Topic:** Central Sector Scheme of Scholarship (CSSS)
- **Question:** What are the eligibility criteria, income limit, scholarship amount and the application deadline for the current 2026-27 cycle?
- **Objective:** Decide whether to apply this cycle and what to prepare.

## Sources

| # | Source | Kind | Why it's in the set |
|---|---|---|---|
| S1 | https://scholarships.gov.in/public/schemeGuidelines/CSSS_GUIDLINES_07022024_updated.pdf | Official guidelines (PDF, NSP) | Authoritative scheme rules |
| S2 | https://www.cbse.gov.in/cbsenew/documents/Public_Nortice_CSSS_2025_26_27062025.pdf | Official public notice (PDF, CBSE) | Dated notice for an earlier cycle |
| S3 | https://www.thehindu.com/education/online-applications-invited-for-central-sector-scheme-of-scholarship-for-college-and-university-students/article69989063.ece | News | Dated news coverage |
| S4 | https://www.indiascholarships.in/scholarships/central-sector-scholarship-csss | Aggregator | Third-party summary |
| S5 | https://scholarships.gov.in/ViewMoreAnnouncement | Official announcements page (NSP) | Current announcements, no stated date |
| S6 | `tests/fixtures/notification.pdf` (uploaded) | Synthetic test PDF | Exercises the PDF upload path; **not a real notice** |

`https://www.education.gov.in/en/central-sector-scheme-scholarship-college-and-university-student-csss-0` was also tried:
it returned HTTP 403 to the earlier bot-style user agent and Jina returned only 75 characters, so the source was correctly marked
**failed** with that error while the others continued. (The user agent was then changed to a browser-like one, after which the
page returned 200 to `curl`.)

## Run 1: extraction + rule-based freshness (no AI key)

Run through the real HTTP API (`next start` with `GAPLENS_DB=memory`), in this order:
`POST /api/sessions` → PDF upload → `POST …/extract` ×5 → `POST …/stages/freshness` → `POST …/stages/report` → export.

### Extraction

| # | Status | Provider | Title (from source) | Date found | Where the date came from |
|---|---|---|---|---|---|
| S1 | extracted, 8,031 chars | pdf-parse (direct) | none in PDF metadata | 2026-06-29 | PDF metadata CreationDate / ModDate (file creation, not necessarily publication) |
| S2 | extracted, 2,225 chars | pdf-parse (direct) | none in PDF metadata | 2025-06-27 | PDF metadata CreationDate / ModDate |
| S3 | extracted, ~10k chars | Jina Reader | "Online applications invited for Central Sector Scheme of Scholarship for college and university students - The Hindu" | 2025-08-29 | Jina publishedTime (direct fetch in an earlier run gave the same date from `article:published_time`) |
| S4 | extracted, 10,676 chars | Jina Reader | "Central Sector Scheme of Scholarship for College and University Students (CSSS)" | 2026-10-31 | JSON-LD datePublished/dateModified. Equal to the retrieval day, so GapLens ignored Jina's reader date and added the warning "the stated date equals the retrieval day; some sites generate this dynamically" |
| S5 | extracted, 5,977 chars | Jina Reader | "NSP : National Scholarship Portal" | **Undated** | none stated |
| S6 | extracted | pdf-parse (upload) | "Merit Scholarship Notification 2025-26" | 2025-06-10 | document text "Dated: 10/06/2025" |

Jina Reader's keyless tier rejected some sandbox requests ("bad IP reputation"); the direct-fetch fallback handled those.

### Freshness findings (deterministic rules, no AI)

| Source | Finding | Severity | Verbatim evidence |
|---|---|---|---|
| S2 | Old stated date (2025-06-27, 16 months old) | medium | from PDF metadata |
| S2 | Refers to a past cycle (latest cycle mentioned 2025-26; current 2026-27) | medium | "…for the year 2025-26, 1st Renewal for the year 2024, 2nd renewal for the year 2023," |
| S2 | Deadline has passed (2025-10-31) | high | "The last date for submission of online application form for renewal and fresh scholarship 2025-26, is 31.10.2025." |
| S3 | Old stated date (2025-08-29, 14 months old) | medium | from article metadata |
| S3 | Refers to a past cycle (2025-26) | medium | "…for the Central Sector Scheme of Scholarship for College and University Students (CSSS) are now open for the academic year 2025-26." |
| S3 | Deadline has passed (2025-10-31) | high | "The last date for submission of both fresh and renewal applications is October 31, 2025." |
| S5 | Undated (labelled *Requires verification*, not *outdated*) | low | none |
| S6 | Old date, past cycle 2025-26, deadline 2025-07-31 passed | medium / medium / high | fixture text |

Not flagged, correctly:
- S1 says "(Applicable for academic year 2022-23 onwards)". The rule treats "onwards" as still in force, so it is not a past cycle.
  An earlier version of the rule did flag it; the fix came from this live run.
- S5 states "Closing dates for student application is 31-10-2026", which is not before the run date, so no expired-deadline warning.

AI stages in this run returned `503 config_required` ("Configuration required: no AI provider key…"), and with a fake BYO
Gemini key `401 llm_auth`. Nothing was simulated.

## Run 2: full AI pipeline with Gemini (pending)

The Gemini key cannot be used from the build sandbox: outbound calls to `generativelanguage.googleapis.com` get a Google
OAuth token injected and fail with `403 ACCESS_TOKEN_SCOPE_INSUFFICIENT`. All AI stages are therefore covered by mocked-LLM
tests (`src/server/ai/llm.test.ts`, `tests/pipeline.test.ts`) and must be run live on the Vercel deployment:

1. Set `GEMINI_API_KEY` (and Supabase env) on Vercel, apply migrations 0001 + 0002.
2. Open `/workspace`, enter the brief above and add S1–S5 (optionally upload a real notice PDF).
3. Click **Analyse sources** and keep the tab open; the runner shows each stage.
4. Record here: verified claims per source, discarded quotes, topic coverage, gaps, contradictions, AI-assisted freshness
   warnings, questions and checklist, plus the exported Markdown.

Things the run should be checked for (from the source texts, not from GapLens output): the sources describe different cycles
(2025-26 notices vs 2026-27 announcements), so deadline and cycle statements may conflict across sources.

## Database (Supabase) live test

`tests/live/db.live.test.ts` round-trips a session through all six tables and deletes it. From the build sandbox it could
not authenticate as the service role: the credentials available there resolve to the **anon** role, and every table
answered `42501 permission denied`. That result confirms the RLS / revoked-grant design (anon can't read data), but the
service-role round-trip itself still has to be run once on Vercel or locally with real env:

```bash
LIVE_DB=1 NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npx vitest run tests/live/db.live.test.ts
```

Migration status at hand-off: 0001 applied; **0002 not yet applied** (the app degrades gracefully without it).

## Reproducing Run 1

```bash
LIVE=1 DEMO_OUT=/tmp/demo.json DEMO_URLS="<S1> <S2> <S3> <S4> <S5>" npx vitest run tests/live/extract.live.test.ts
```
