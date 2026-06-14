-- Migration 03b: RLS for the "contributor" role. Run AFTER 03a.
-- A contributor can view everything (existing select policies) but may only
-- write to tasks assigned to them — edit the task, comment on it, and manage
-- its watchers. They cannot create or delete tasks.

-- tasks: admin/user write anything; contributor updates only their own assignments.
drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
  for update to authenticated
  using (
    public.can_write()
    or (public.current_role() = 'contributor' and assignee_id = auth.uid())
  )
  with check (
    public.can_write()
    or (public.current_role() = 'contributor' and assignee_id = auth.uid())
  );

-- watchers: admin/user manage any; contributor manages watchers on their assignments.
drop policy if exists watchers_write on public.task_watchers;
create policy watchers_write on public.task_watchers
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

-- comments: admin/user comment anywhere; contributor comments on their assignments.
drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments
  for insert to authenticated
  with check (
    author_id = auth.uid()
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
