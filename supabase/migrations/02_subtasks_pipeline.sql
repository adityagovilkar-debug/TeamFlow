-- Migration: epics + ordered subtask pipelines.
-- A subtask points at its parent (epic) via parent_id and is ordered by position.
-- Run once in the Supabase SQL editor (safe to re-run).
alter table public.tasks
  add column if not exists parent_id uuid references public.tasks (id) on delete cascade,
  add column if not exists position int not null default 0;

create index if not exists idx_tasks_parent on public.tasks (parent_id);
