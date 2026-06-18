-- Activity log: an append-only feed of who did what. task_id is null for
-- task-independent events. Written by server actions under the user's session.
-- Safe to re-run.

create table if not exists public.activity (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid references public.tasks(id) on delete cascade,
  actor_id   uuid references public.profiles(id) on delete set null,
  type       text not null,
  summary    text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_task on public.activity(task_id, created_at desc);
create index if not exists idx_activity_created on public.activity(created_at desc);

alter table public.activity enable row level security;

drop policy if exists activity_select on public.activity;
create policy activity_select on public.activity
  for select to authenticated using (true);

drop policy if exists activity_insert on public.activity;
create policy activity_insert on public.activity
  for insert to authenticated
  with check (actor_id = auth.uid());

do $$ begin
  alter publication supabase_realtime add table public.activity;
exception when duplicate_object then null; end $$;
