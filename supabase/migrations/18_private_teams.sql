-- Private teams/products. A private team + all its tasks are visible only to its
-- members and the super-admin (regular admins excluded). Admins manage teams via
-- the service role (which bypasses RLS). Safe to re-run.

alter table public.teams
  add column if not exists is_private boolean not null default false;

create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (team_id, user_id)
);
create index if not exists idx_team_members_team on public.team_members(team_id);

alter table public.team_members enable row level security;

-- ---------- Helpers (SECURITY DEFINER → bypass RLS, no policy recursion) ----------
-- Member check touches only team_members (safe to use inside teams_select).
create or replace function public.is_team_member(tid uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.team_members m
    where m.team_id = tid and m.user_id = auth.uid()
  );
$$;

create or replace function public.can_see_team(tid uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.teams t
    where t.id = tid and (
      not t.is_private
      or public.is_team_member(t.id)
      or public.is_superadmin()
    )
  );
$$;

-- ---------- Teams RLS: read honors privacy; writes go through the service role ----------
drop policy if exists teams_admin_write on public.teams;  -- 'for all' also leaked SELECT to admins
drop policy if exists teams_select on public.teams;
create policy teams_select on public.teams
  for select to authenticated
  using (
    not is_private
    or public.is_team_member(id)
    or public.is_superadmin()
  );

drop policy if exists team_members_select on public.team_members;
create policy team_members_select on public.team_members
  for select to authenticated
  using ( public.can_see_team(team_id) );

-- ---------- Fold the team gate into task visibility ----------
-- A task in a private team is hidden from non-members even if not itself private.
create or replace function public.can_see_task(tid uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.tasks t
    where t.id = tid
      and (
        not t.is_private
        or t.created_by = auth.uid()
        or t.assignee_id = auth.uid()
        or exists (
          select 1 from public.task_watchers w
          where w.task_id = t.id and w.user_id = auth.uid()
        )
        or public.is_superadmin()
      )
      and (t.team_id is null or public.can_see_team(t.team_id))
  );
$$;

drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks
  for select to authenticated
  using (
    (
      not is_private
      or created_by = auth.uid()
      or assignee_id = auth.uid()
      or public.is_watcher(id)
      or public.is_superadmin()
    )
    and (team_id is null or public.can_see_team(team_id))
  );
