-- Labels: colored tags for tasks (beyond team/folder). Many-to-many with tasks.
-- Admins/users manage the label set; a contributor can tag their own assigned
-- tasks. Safe to re-run.

create table if not exists public.labels (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  color      text not null default '#6366f1',
  created_at timestamptz not null default now()
);

create table if not exists public.task_labels (
  task_id  uuid not null references public.tasks(id) on delete cascade,
  label_id uuid not null references public.labels(id) on delete cascade,
  primary key (task_id, label_id)
);

create index if not exists idx_task_labels_task on public.task_labels(task_id);

alter table public.labels enable row level security;
alter table public.task_labels enable row level security;

drop policy if exists labels_select on public.labels;
create policy labels_select on public.labels
  for select to authenticated using (true);

drop policy if exists labels_write on public.labels;
create policy labels_write on public.labels
  for all to authenticated
  using (public.can_write()) with check (public.can_write());

drop policy if exists task_labels_select on public.task_labels;
create policy task_labels_select on public.task_labels
  for select to authenticated using (true);

drop policy if exists task_labels_write on public.task_labels;
create policy task_labels_write on public.task_labels
  for all to authenticated
  using (
    public.can_write()
    or (
      public.current_role() = 'contributor'
      and exists (
        select 1 from public.tasks t
        where t.id = task_id and t.assignee_id = auth.uid()
      )
    )
  )
  with check (
    public.can_write()
    or (
      public.current_role() = 'contributor'
      and exists (
        select 1 from public.tasks t
        where t.id = task_id and t.assignee_id = auth.uid()
      )
    )
  );

do $$ begin
  alter publication supabase_realtime add table public.labels;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.task_labels;
exception when duplicate_object then null; end $$;
