-- Timeline / Gantt: an optional planned start date for each task.
-- The Gantt bar spans start_date → due_date (falling back to created_at when no
-- start is set). Safe to re-run.
alter table public.tasks
  add column if not exists start_date date;
