-- GapLens — initial schema
-- Access model (Phase 1–3): ALL reads and writes happen server-side through Next.js API routes /
-- server components using the SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS.
-- RLS is ENABLED on every table with NO policies for anon/authenticated, so the public anon key
-- cannot read or write anything (deny-by-default). If/when user auth is added, add per-user
-- policies keyed on research_sessions.owner_id (column reserved below).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- research_sessions
-- ---------------------------------------------------------------------------
create table if not exists public.research_sessions (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid null, -- reserved for future auth (auth.users.id); unused in Phase 1–3
  topic          text not null check (char_length(topic) between 1 and 200),
  question       text not null check (char_length(question) between 1 and 1000),
  objective      text not null default '' check (char_length(objective) <= 1000),
  status         text not null default 'draft'
                   check (status in ('draft','extracting','analyzing','complete','failed')),
  error_message  text null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists research_sessions_created_at_idx on public.research_sessions (created_at desc);

-- ---------------------------------------------------------------------------
-- sources
-- ---------------------------------------------------------------------------
create table if not exists public.sources (
  id                   uuid primary key default gen_random_uuid(),
  session_id           uuid not null references public.research_sessions(id) on delete cascade,
  source_type          text not null check (source_type in ('url','pdf')),
  url                  text null,
  file_name            text null,
  title                text null,          -- only as found in the source; never invented
  published_at         timestamptz null,   -- null = undated (NOT outdated)
  retrieved_at         timestamptz null,
  extraction_status    text not null default 'pending'
                         check (extraction_status in ('pending','extracting','extracted','failed')),
  extraction_provider  text null check (extraction_provider in ('firecrawl','jina','pdf-parse')),
  extraction_error     text null,
  content_text         text null,
  content_sha256       text null,
  created_at           timestamptz not null default now(),
  constraint sources_locator_chk check (
    (source_type = 'url' and url is not null) or (source_type = 'pdf' and file_name is not null)
  )
);
create index if not exists sources_session_idx on public.sources (session_id);
create unique index if not exists sources_session_url_uniq on public.sources (session_id, url) where url is not null;

-- ---------------------------------------------------------------------------
-- claims — every claim traces to a source and a verbatim quote
-- ---------------------------------------------------------------------------
create table if not exists public.claims (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.research_sessions(id) on delete cascade,
  source_id       uuid not null references public.sources(id) on delete cascade,
  text            text not null,
  quote           text not null,
  category        text not null
                    check (category in ('fact','claim','date_deadline','requirement','condition','procedure','evidence')),
  claim_date      date null,
  char_start      integer null check (char_start is null or char_start >= 0),
  char_end        integer null,
  quote_verified  boolean not null default false,
  created_at      timestamptz not null default now(),
  constraint claims_offsets_chk check (char_end is null or char_start is null or char_end > char_start)
);
create index if not exists claims_session_idx on public.claims (session_id);
create index if not exists claims_source_idx on public.claims (source_id);

-- ---------------------------------------------------------------------------
-- findings — gaps, contradictions, freshness warnings, unanswered questions
-- evidence: { "claim_ids": [uuid, ...], ... }
-- ---------------------------------------------------------------------------
create table if not exists public.findings (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.research_sessions(id) on delete cascade,
  type         text not null check (type in ('gap','contradiction','freshness','question')),
  label        text not null check (label in (
                 'verified_in_source','potential_gap','possible_contradiction','potentially_outdated',
                 'not_found_in_sources','requires_verification','ai_suggestion','info')),
  severity     text null check (severity in ('high','medium','low')),
  title        text not null,
  description  text not null,
  evidence     jsonb not null default '{"claim_ids": []}'::jsonb
                 check (jsonb_typeof(evidence) = 'object' and jsonb_typeof(evidence->'claim_ids') = 'array'),
  payload      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists findings_session_type_idx on public.findings (session_id, type);
create index if not exists findings_evidence_gin on public.findings using gin (evidence);

-- ---------------------------------------------------------------------------
-- checklist_items
-- ---------------------------------------------------------------------------
create table if not exists public.checklist_items (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.research_sessions(id) on delete cascade,
  action       text not null,
  priority     text not null check (priority in ('high','medium','low')),
  rationale    text not null,
  finding_ids  uuid[] not null default '{}',
  done         boolean not null default false,
  position     integer not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists checklist_items_session_idx on public.checklist_items (session_id, position);

-- ---------------------------------------------------------------------------
-- reports — validated snapshot of the full report JSON
-- ---------------------------------------------------------------------------
create table if not exists public.reports (
  id                 uuid primary key default gen_random_uuid(),
  session_id         uuid not null references public.research_sessions(id) on delete cascade,
  model              text not null,
  coverage_overview  text not null default '',
  report             jsonb not null,
  created_at         timestamptz not null default now()
);
create index if not exists reports_session_idx on public.reports (session_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists research_sessions_updated_at on public.research_sessions;
create trigger research_sessions_updated_at before update on public.research_sessions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: enabled, no anon/authenticated policies => deny by default.
-- The service role (server only) bypasses RLS.
-- ---------------------------------------------------------------------------
alter table public.research_sessions enable row level security;
alter table public.sources           enable row level security;
alter table public.claims            enable row level security;
alter table public.findings          enable row level security;
alter table public.checklist_items   enable row level security;
alter table public.reports           enable row level security;

revoke all on public.research_sessions, public.sources, public.claims,
              public.findings, public.checklist_items, public.reports
  from anon, authenticated;
