-- Private tasks + a single super-admin.
-- A private task is visible only to its creator, assignee, watchers, and the one
-- super-admin (regular admins included excluded). Enforced in RLS. Safe to re-run.

alter table public.tasks
  add column if not exists is_private boolean not null default false;

alter table public.profiles
  add column if not exists is_superadmin boolean not null default false;

-- Only one super-admin can ever exist.
create unique index if not exists uniq_superadmin
  on public.profiles (is_superadmin) where is_superadmin;

-- ---------- Visibility helpers (SECURITY DEFINER → bypass RLS, no recursion) ----------
create or replace function public.is_superadmin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_superadmin from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.can_see_task(tid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.tasks t
    where t.id = tid and (
      not t.is_private
      or t.created_by = auth.uid()
      or t.assignee_id = auth.uid()
      or exists (
        select 1 from public.task_watchers w
        where w.task_id = t.id and w.user_id = auth.uid()
      )
      or public.is_superadmin()
    )
  );
$$;

-- Watcher check that touches only task_watchers (so tasks_select needn't re-query
-- tasks — which would fail on INSERT ... RETURNING for a not-yet-visible new row).
create or replace function public.is_watcher(tid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.task_watchers w
    where w.task_id = tid and w.user_id = auth.uid()
  );
$$;

-- ---------- Rewrite SELECT policies to honor task visibility ----------
-- tasks_select evaluates the row's own columns directly (no tasks re-query).
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks
  for select to authenticated
  using (
    not is_private
    or created_by = auth.uid()
    or assignee_id = auth.uid()
    or public.is_watcher(id)
    or public.is_superadmin()
  );

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
  for update to authenticated
  using (
    public.can_see_task(id)
    and (
      public.can_write()
      or (public.current_role() = 'contributor' and assignee_id = auth.uid())
    )
  )
  with check (
    public.can_write()
    or (public.current_role() = 'contributor' and assignee_id = auth.uid())
  );

drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks
  for delete to authenticated
  using ( public.is_admin() and public.can_see_task(id) );

drop policy if exists watchers_select on public.task_watchers;
create policy watchers_select on public.task_watchers
  for select to authenticated using ( public.can_see_task(task_id) );

drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments
  for select to authenticated using ( public.can_see_task(task_id) );

drop policy if exists checklist_select on public.checklist_items;
create policy checklist_select on public.checklist_items
  for select to authenticated using ( public.can_see_task(task_id) );

drop policy if exists time_entries_select on public.time_entries;
create policy time_entries_select on public.time_entries
  for select to authenticated using ( public.can_see_task(task_id) );

drop policy if exists task_labels_select on public.task_labels;
create policy task_labels_select on public.task_labels
  for select to authenticated using ( public.can_see_task(task_id) );

drop policy if exists activity_select on public.activity;
create policy activity_select on public.activity
  for select to authenticated
  using ( task_id is null or public.can_see_task(task_id) );

-- ---------- Bootstrap: oldest admin becomes super-admin if none set ----------
update public.profiles set is_superadmin = true
where id = (
  select id from public.profiles where role = 'admin'
  order by created_at asc limit 1
)
and not exists (select 1 from public.profiles where is_superadmin);
