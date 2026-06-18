-- Task templates + recurrence. Templates spin up a task (+ checklist) in one
-- click; recurrence auto-creates the next occurrence when a task is completed.
-- Safe to re-run.

create table if not exists public.task_templates (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  title            text not null,
  description      text,
  priority         task_priority not null default 'medium',
  team_id          uuid references public.teams(id) on delete set null,
  estimate_minutes int,
  created_at       timestamptz not null default now()
);

create table if not exists public.template_checklist_items (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.task_templates(id) on delete cascade,
  body        text not null,
  position    int not null default 0
);

create index if not exists idx_template_items on public.template_checklist_items(template_id);

-- recurrence: none | daily | weekly | monthly (text + CHECK, no enum).
alter table public.tasks
  add column if not exists recurrence text not null default 'none';

do $$ begin
  alter table public.tasks
    add constraint tasks_recurrence_check
    check (recurrence in ('none','daily','weekly','monthly'));
exception when duplicate_object then null; end $$;

alter table public.task_templates enable row level security;
alter table public.template_checklist_items enable row level security;

drop policy if exists templates_select on public.task_templates;
create policy templates_select on public.task_templates
  for select to authenticated using (true);

drop policy if exists templates_write on public.task_templates;
create policy templates_write on public.task_templates
  for all to authenticated
  using (public.can_write()) with check (public.can_write());

drop policy if exists template_items_select on public.template_checklist_items;
create policy template_items_select on public.template_checklist_items
  for select to authenticated using (true);

drop policy if exists template_items_write on public.template_checklist_items;
create policy template_items_write on public.template_checklist_items
  for all to authenticated
  using (public.can_write()) with check (public.can_write());

do $$ begin
  alter publication supabase_realtime add table public.task_templates;
exception when duplicate_object then null; end $$;
