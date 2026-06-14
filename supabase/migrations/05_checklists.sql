-- Checklists: lightweight to-do items attached to any task (incl. subtasks).
-- RLS mirrors comments: everyone reads; admins/users write; a contributor may
-- write only on a task assigned to them. Safe to re-run.

create table if not exists public.checklist_items (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  body       text not null,
  is_done    boolean not null default false,
  position   int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_checklist_task on public.checklist_items(task_id);

alter table public.checklist_items enable row level security;

drop policy if exists checklist_select on public.checklist_items;
create policy checklist_select on public.checklist_items
  for select to authenticated using (true);

drop policy if exists checklist_write on public.checklist_items;
create policy checklist_write on public.checklist_items
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
  alter publication supabase_realtime add table public.checklist_items;
exception when duplicate_object then null; end $$;
