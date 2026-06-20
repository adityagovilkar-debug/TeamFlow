-- Fix: tasks_select must not re-query the tasks table.
--
-- 14 defined tasks_select as `using (can_see_task(id))`, and can_see_task does
-- `select ... from tasks where id = tid`. During an INSERT ... RETURNING (every
-- task create does this), the just-inserted row is not yet visible to that nested
-- query, so the policy evaluated to false and Postgres raised 42501
-- ("new row violates row-level security policy") — breaking all task creation.
--
-- Fix: evaluate the row's OWN columns directly in the policy (available on the new
-- row), using a watcher helper that only touches task_watchers (no tasks re-query,
-- no recursion). can_see_task stays for child tables (their parent task already
-- exists, so re-querying tasks is fine there). Safe to re-run.

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
