-- Time tracking: an estimate per task + logged time entries. Hours are entered
-- in the UI and stored as minutes. Safe to re-run.
alter table public.tasks
  add column if not exists estimate_minutes int;

create table if not exists public.time_entries (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  minutes    int not null check (minutes > 0),
  note       text,
  spent_on   date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists idx_time_entries_task on public.time_entries(task_id);
create index if not exists idx_time_entries_user on public.time_entries(user_id);

alter table public.time_entries enable row level security;

drop policy if exists time_entries_select on public.time_entries;
create policy time_entries_select on public.time_entries
  for select to authenticated using (true);

-- Log time on a task you can edit (admin/user any; contributor on assigned).
drop policy if exists time_entries_insert on public.time_entries;
create policy time_entries_insert on public.time_entries
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      public.can_write()
      or (
        public.current_role() = 'contributor'
        and exists (
          select 1 from public.tasks t
          where t.id = task_id and t.assignee_id = auth.uid()
        )
      )
    )
  );

-- Edit/delete your own entries; admins any.
drop policy if exists time_entries_modify on public.time_entries;
create policy time_entries_modify on public.time_entries
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists time_entries_delete on public.time_entries;
create policy time_entries_delete on public.time_entries
  for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

do $$ begin
  alter publication supabase_realtime add table public.time_entries;
exception when duplicate_object then null; end $$;
