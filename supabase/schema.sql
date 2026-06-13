-- ============================================================================
-- TeamFlow — full database schema (run once in the Supabase SQL editor)
-- Tables, enums, the first-user-is-admin trigger, RLS policies, and seed data.
-- Safe to re-run: drops and recreates policies/objects idempotently.
-- ============================================================================

-- ---------- Enums ----------
do $$ begin
  create type user_role as enum ('admin', 'user', 'viewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_priority as enum ('low', 'medium', 'high', 'urgent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_category as enum ('todo', 'in_progress', 'done');
exception when duplicate_object then null; end $$;

-- ---------- Tables ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  role        user_role not null default 'viewer',
  avatar_url  text,
  email_notifications boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  color       text not null default '#6366f1',
  description text,
  created_at  timestamptz not null default now()
);

create table if not exists public.statuses (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  color       text not null default '#64748b',
  position    int  not null default 0,
  category    status_category not null default 'todo',
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  priority     task_priority not null default 'medium',
  status_id    uuid references public.statuses (id) on delete set null,
  team_id      uuid references public.teams (id) on delete set null,
  assignee_id  uuid references public.profiles (id) on delete set null,
  due_date     date,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.task_watchers (
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (task_id, user_id)
);

create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks (id) on delete cascade,
  author_id  uuid references public.profiles (id) on delete set null,
  body       text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_tasks_status on public.tasks (status_id);
create index if not exists idx_tasks_team on public.tasks (team_id);
create index if not exists idx_tasks_assignee on public.tasks (assignee_id);
create index if not exists idx_comments_task on public.comments (task_id);
create index if not exists idx_watchers_task on public.task_watchers (task_id);

-- ---------- Helpers ----------
-- SECURITY DEFINER so policies can read a user's role without recursive RLS.
create or replace function public.current_role()
returns user_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_role() = 'admin', false);
$$;

create or replace function public.can_write()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_role() in ('admin', 'user'), false);
$$;

-- Keep tasks.updated_at fresh, and stamp completed_at when moved to a done status.
create or replace function public.touch_task_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.status_id is distinct from old.status_id then
    if exists (
      select 1 from public.statuses s
      where s.id = new.status_id and s.category = 'done'
    ) then
      new.completed_at := coalesce(new.completed_at, now());
    else
      new.completed_at := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_touch_task on public.tasks;
create trigger trg_touch_task
  before update on public.tasks
  for each row execute function public.touch_task_updated_at();

-- New auth user -> profile row. First ever user becomes admin.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_role user_role;
begin
  if (select count(*) from public.profiles) = 0 then
    assigned_role := 'admin';
  else
    assigned_role := 'viewer';
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    assigned_role
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Row Level Security ----------
alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.statuses enable row level security;
alter table public.tasks enable row level security;
alter table public.task_watchers enable row level security;
alter table public.comments enable row level security;

-- profiles: everyone authenticated can read; users edit own; admins edit anyone (incl. role).
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = public.current_role());

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- teams: all read; only admins write.
drop policy if exists teams_select on public.teams;
create policy teams_select on public.teams
  for select to authenticated using (true);

drop policy if exists teams_admin_write on public.teams;
create policy teams_admin_write on public.teams
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- statuses: all read; only admins write.
drop policy if exists statuses_select on public.statuses;
create policy statuses_select on public.statuses
  for select to authenticated using (true);

drop policy if exists statuses_admin_write on public.statuses;
create policy statuses_admin_write on public.statuses
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- tasks: all read; admin+user insert/update; only admin delete.
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks
  for select to authenticated using (true);

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks
  for insert to authenticated with check (public.can_write());

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
  for update to authenticated
  using (public.can_write()) with check (public.can_write());

drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks
  for delete to authenticated using (public.is_admin());

-- watchers: all read; admin+user manage.
drop policy if exists watchers_select on public.task_watchers;
create policy watchers_select on public.task_watchers
  for select to authenticated using (true);

drop policy if exists watchers_write on public.task_watchers;
create policy watchers_write on public.task_watchers
  for all to authenticated
  using (public.can_write()) with check (public.can_write());

-- comments: all read; admin+user create; authors edit/delete own, admins any.
drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments
  for select to authenticated using (true);

drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments
  for insert to authenticated
  with check (public.can_write() and author_id = auth.uid());

drop policy if exists comments_update_own on public.comments;
create policy comments_update_own on public.comments
  for update to authenticated
  using (author_id = auth.uid() or public.is_admin())
  with check (author_id = auth.uid() or public.is_admin());

drop policy if exists comments_delete_own on public.comments;
create policy comments_delete_own on public.comments
  for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

-- ---------- Realtime ----------
do $$ begin
  alter publication supabase_realtime add table public.tasks;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.comments;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.task_watchers;
exception when duplicate_object then null; end $$;

-- ---------- Seed: default statuses & a couple of teams ----------
insert into public.statuses (name, color, position, category, is_default)
select * from (values
  ('Backlog',     '#94a3b8', 0, 'todo'::status_category,        true),
  ('To Do',       '#64748b', 1, 'todo'::status_category,        true),
  ('In Progress', '#3b82f6', 2, 'in_progress'::status_category, true),
  ('In Review',   '#a855f7', 3, 'in_progress'::status_category, true),
  ('Done',        '#10b981', 4, 'done'::status_category,        true)
) as v(name, color, position, category, is_default)
where not exists (select 1 from public.statuses);

insert into public.teams (name, color, description)
select * from (values
  ('Product',     '#6366f1', 'Product & design work'),
  ('Engineering', '#10b981', 'Engineering & infrastructure')
) as v(name, color, description)
where not exists (select 1 from public.teams);
