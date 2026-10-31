-- GapLens 0002: extraction metadata + 'direct' extraction provider. Idempotent; safe to re-run.
-- The app works without this migration (it degrades: no per-source metadata such as the
-- "updated" date, date evidence, or claim-extraction progress; 'direct' provider stored as NULL).

alter table public.sources
  add column if not exists metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.sources'::regclass and conname = 'sources_extraction_provider_check'
  ) then
    alter table public.sources drop constraint sources_extraction_provider_check;
  end if;
  alter table public.sources
    add constraint sources_extraction_provider_check
    check (extraction_provider in ('firecrawl','jina','direct','pdf-parse'));
end $$;

-- Make PostgREST pick up the new column immediately.
notify pgrst, 'reload schema';
