# GapLens demo: Central Sector Scheme of Scholarship (CSSS / PM-USP)

Real-world success scenario for an Indian government scholarship, run from the build sandbox on
**31 Oct 2026 (IST)**. Everything below is what the pipeline actually produced. Nothing is hand-written into results.

## Brief

- **Topic:** Central Sector Scheme of Scholarship (CSSS)
- **Question:** What are the eligibility criteria, income limit, scholarship amount and the application deadline for the current 2026-27 cycle?
- **Objective:** Decide whether to apply this cycle and what to prepare.

## Sources

The workspace's **Load example** button pre-fills this brief and S1–S5 (real public URLs; nothing is pre-analysed).

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

## Run 2: full AI pipeline on the live deployment (Gemini 2.5 Flash)

Run on **31 Oct 2026, ~22:55 IST** against `https://gaplens-ecru.vercel.app` (build `7d177be`, confirmed via `/api/health`),
driven through the public API by a script: create session → extract ×5 → claims per source → gaps → contradictions →
freshness → questions → checklist → report, retrying on 429 (one rate-limit retry was needed, at the gaps stage).
Brief as above, sources S1–S5 (no PDF upload). Session id: **`6fb7cc10-7d30-4fbf-9059-469bf8338ee4`**
(`GET /api/sessions/6fb7cc10-7d30-4fbf-9059-469bf8338ee4`). Report model: `gemini:gemini-2.5-flash`.

### Why this run exists

An earlier live run (session `1c2ba076-410c-4554-9ed2-6bbb90cb4b66`, 4 sources, before this fix) produced **12 topics, all
"covered", 0 gaps**. The topics were derived from what the claims said (circular), and "Application deadline for 2026-27"
was marked covered by a single aggregator claim, "Deadline 31 Oct" (no year), while the dated official sources only gave
31.10.2025 (the 2025-26 cycle). Build `7d177be` changed this:

- **Topic planning is independent of the claims**: a deterministic scholarship/scheme checklist (eligibility, income limit,
  amount, deadline *for the asked cycle*, documents, renewal, continuation conditions, selection, disbursement, what's covered,
  quotas, official contact) plus aspects the question lists, plus up to 3 extra topics from an LLM call that sees only the brief.
- **Strict coverage**: a second LLM call assesses the planned topics against verified claims, then a deterministic post-check
  downgrades "covered" to "partial / requires verification" when no cited claim matches the asked cycle (2026-27), when a
  time-sensitive claim has no year, or when only an undated third-party site supports it.
- **Contradictions** get the extracted values (₹, %, dates) and the cycle of each claim; cross-cycle differences become
  "cycle mismatch", not contradictions.
- **AI freshness** notes that conflict with the rule engine's "2022-23 onwards / until further orders" determination are
  suppressed or downgraded.

### Counts

| | Result |
|---|---|
| Sources read | 5 / 5 (CBSE notice, The Hindu, indiascholarships.in, NSP announcements, NSP guidelines PDF) |
| Verified claims | 90 (23 guidelines, 4 CBSE, 9 The Hindu, 38 aggregator, 16 NSP announcements); 0 discarded as unverifiable |
| Topics | 12, checked for **2026-27**: 9 covered, 2 partial, 1 not found (the planner LLM added no extra topics) |
| Gaps | **3** (2 potential gaps, 1 not found in sources) |
| Contradictions | **1** (same cycle); 0 cycle mismatches; 9 topic groups, 170 cross-source pairs, 5 value differences flagged to the model |
| Freshness warnings | 9: 7 rule-based (as in Run 1, incl. S5 undated), 2 AI-assisted; 0 AI notes suppressed |
| Questions / checklist | 6 / 6 |

### Gaps found

1. **Category / reservation quotas and number of awards**, potential gap (low). Downgraded by the deterministic
   aggregator check: *"Only indiascholarships.in (a third-party site without a reliable publication date) states this for
   2026-27; no official or dated source in the review confirms it."* Evidence: indiascholarships.in, "50% of the scholarships
   are reserved for female students, and reservations also apply for SC (15%), ST (7.5%), OBC (27%), and PwD (5%) categories."
2. **Selection / merit process**, potential gap (medium). Model assessment: only the aggregator's "Candidates are selected
   based on merit-cum-means" was found; how merit and means are assessed is not in the reviewed sources.
3. **What the scholarship covers (fees, hostel, other costs)**, not found in the reviewed sources (low). No claim addresses it
   (shown as "not found in the reviewed sources", not "does not exist").

The deadline topic was **covered** in this run, correctly: the official NSP announcements page states "Closing dates for
student application is 31-10-2026 …" right after naming the CSSS (Merit Based Scheme) as open, and "The Portal is open for
Academic year 2026-27 from 1'st June 2026 onwards."

### Contradiction found

**Application deadline for 2026-27** (high, cycles A 2026-27 / B 2026-27, so a genuine same-cycle conflict):
- A, indiascholarships.in: "The student submission deadline for fresh and renewal applications for the Central Sector Scheme
  of Scholarship (CSSS) for the 2026-27 academic cycle is September 30, 2026."
- B, scholarships.gov.in/ViewMoreAnnouncement: "Closing dates for student application is 31-10-2026 and closing date for
  institute verification is : 15-11-2026 and closing date for L2 verification is : 30/11/2026"
- Authority signals: scholarships.gov.in is official; one of the two sources is undated. GapLens does not pick a winner.

### Freshness (AI-assisted, in addition to Run 1's rule findings)

- indiascholarships.in, **expired_deadline** (high): its 2026-27 deadline, September 30, 2026, is before the run date. Accurate.
- indiascholarships.in, **superseded_by_newer_source** (high): said the NSP claim was "published on 2026-10-31". **This was
  wrong**: the NSP announcements page is undated. Fixed afterwards (build `e41df65`): a supersession note now needs a cited
  newer source with a reliable later date, otherwise it is downgraded to low "Requires verification" with the reason. That fix
  is unit-tested but has **not yet been re-run live** (see below).

The NSP guidelines PDF ("Applicable for academic year 2022-23 onwards") got **no** past-cycle warning from either the rules or
the AI in this run.

### Known limitations seen in this run, and what changed after it

- "Official portal, contact and grievance channel" and "Disbursement method and timeline" were marked covered from portal and
  DBT claims, although no helpline/grievance channel or payment timeline was stated. After the run (build `e41df65`) the topics
  were renamed to "Official helpline / contact and grievance channel" and "Disbursement method and timeline (when money is
  paid)", and the assessment prompt now requires every part of a multi-part topic to be answered.
- Model text sometimes mentioned prompt aliases ("Claim C37", "C86 from S4"). These are now replaced with source names.
- The same-cycle deadline conflict did not lower the deadline topic's coverage, because an official source states it.
  The conflict is reported in Contradictions instead.

### Re-run after the follow-up fixes: blocked by quota

A re-run on build `e41df65` (session `1e451e6e-fccc-4bd5-a084-9d1331bd4cc6`) extracted all 5 sources, but every claim call
returned 429 with `retryAfterSec ≈ 48,000` (about 13.5 h). The Gemini free-tier **daily** quota for gemini-2.5-flash was
exhausted, so that session has no claims or findings. The follow-up fixes (`e41df65` and later) are covered by mocked-LLM tests
only until a live re-run after the quota resets.

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
