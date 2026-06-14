-- Archive: archived tasks drop out of the active views (Tasks/Board/Calendar/
-- Timeline/Dashboard) but stay browsable under Tasks → Archived. A null
-- archived_at means the task is active. Safe to re-run.
alter table public.tasks
  add column if not exists archived_at timestamptz;

create index if not exists idx_tasks_archived on public.tasks(archived_at);
