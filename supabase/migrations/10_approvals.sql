-- Approvals: a task can be sent for sign-off and approved / sent back.
-- Uses text + CHECK (not an enum) so it's safe to run in one transaction.
-- Safe to re-run.
alter table public.tasks
  add column if not exists approval_status text not null default 'none';

do $$ begin
  alter table public.tasks
    add constraint tasks_approval_status_check
    check (approval_status in ('none','pending','approved','changes_requested'));
exception when duplicate_object then null; end $$;

alter table public.tasks
  add column if not exists approval_by uuid references public.profiles(id) on delete set null;
alter table public.tasks
  add column if not exists approval_at timestamptz;
