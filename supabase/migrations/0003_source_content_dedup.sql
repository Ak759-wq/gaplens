-- GapLens 0003: prevent identical extracted content from being added twice to one session.
-- URL deduplication remains normalized in application code and by the existing URL index.
create unique index if not exists sources_session_content_sha256_uniq
  on public.sources (session_id, content_sha256)
  where content_sha256 is not null;
