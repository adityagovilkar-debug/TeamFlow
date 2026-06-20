-- ============================================================================
-- TeamFlow — full database schema (run once in the Supabase SQL editor)
-- Tables, enums, the first-user-is-admin trigger, RLS policies, and seed data.
-- Safe to re-run: drops and recreates policies/objects idempotently.
-- ============================================================================

-- ---------- Enums ----------
do $$ begin
  create type user_role as enum ('admin', 'user', 'contributor', 'viewer');
exception when duplicate_object then null; end $$;
-- If upgrading an older enum, ensure the value exists (no-op if present).
alter type user_role add value if not exists 'contributor';

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
  is_superadmin boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Only one super-admin can ever exist (sees private tasks; break-glass owner).
create unique index if not exists uniq_superadmin
  on public.profiles (is_superadmin) where is_superadmin;

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

-- Folders: a nestable tree to organize tasks (e.g. by client / campaign).
create table if not exists public.folders (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  parent_id   uuid references public.folders (id) on delete cascade,
  color       text not null default '#6366f1',
  position    int  not null default 0,
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
  start_date   date,
  parent_id    uuid references public.tasks (id) on delete cascade,
  folder_id    uuid references public.folders (id) on delete set null,
  position     int not null default 0,
  archived_at  timestamptz,
  is_private   boolean not null default false,
  estimate_minutes int,
  recurrence   text not null default 'none' check (recurrence in ('none','daily','weekly','monthly')),
  approval_status text not null default 'none' check (approval_status in ('none','pending','approved','changes_requested')),
  approval_by  uuid references public.profiles (id) on delete set null,
  approval_at  timestamptz,
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
  parent_id  uuid references public.comments (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Checklists: lightweight to-do items attached to any task (incl. subtasks).
create table if not exists public.checklist_items (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks (id) on delete cascade,
  body       text not null,
  is_done    boolean not null default false,
  position   int not null default 0,
  created_at timestamptz not null default now()
);

-- Labels: colored tags for tasks (many-to-many).
create table if not exists public.labels (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  color      text not null default '#6366f1',
  created_at timestamptz not null default now()
);

create table if not exists public.task_labels (
  task_id  uuid not null references public.tasks (id) on delete cascade,
  label_id uuid not null references public.labels (id) on delete cascade,
  primary key (task_id, label_id)
);

-- Time tracking: logged time entries (minutes) against tasks.
create table if not exists public.time_entries (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  minutes    int not null check (minutes > 0),
  note       text,
  spent_on   date not null default current_date,
  created_at timestamptz not null default now()
);

-- Activity log: append-only feed of who did what.
create table if not exists public.activity (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid references public.tasks (id) on delete cascade,
  actor_id   uuid references public.profiles (id) on delete set null,
  type       text not null,
  summary    text not null,
  created_at timestamptz not null default now()
);

-- Task templates (+ their checklist items) for one-click task creation.
create table if not exists public.task_templates (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  title            text not null,
  description      text,
  priority         task_priority not null default 'medium',
  team_id          uuid references public.teams (id) on delete set null,
  estimate_minutes int,
  created_at       timestamptz not null default now()
);

create table if not exists public.template_checklist_items (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.task_templates (id) on delete cascade,
  body        text not null,
  position    int not null default 0
);

-- Idempotent upgrades for existing databases (no-ops on a fresh install).
alter table public.tasks    add column if not exists start_date  date;
alter table public.tasks    add column if not exists folder_id   uuid references public.folders (id) on delete set null;
alter table public.tasks    add column if not exists archived_at timestamptz;
alter table public.tasks    add column if not exists is_private boolean not null default false;
alter table public.profiles add column if not exists is_superadmin boolean not null default false;
alter table public.tasks    add column if not exists estimate_minutes int;
alter table public.tasks    add column if not exists recurrence text not null default 'none';
alter table public.tasks    add column if not exists approval_status text not null default 'none';
alter table public.tasks    add column if not exists approval_by uuid references public.profiles (id) on delete set null;
alter table public.tasks    add column if not exists approval_at timestamptz;
alter table public.comments add column if not exists parent_id   uuid references public.comments (id) on delete cascade;
do $$ begin
  alter table public.tasks add constraint tasks_recurrence_check check (recurrence in ('none','daily','weekly','monthly'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.tasks add constraint tasks_approval_status_check check (approval_status in ('none','pending','approved','changes_requested'));
exception when duplicate_object then null; end $$;

create index if not exists idx_tasks_parent on public.tasks (parent_id);
create index if not exists idx_tasks_status on public.tasks (status_id);
create index if not exists idx_tasks_team on public.tasks (team_id);
create index if not exists idx_tasks_assignee on public.tasks (assignee_id);
create index if not exists idx_tasks_folder on public.tasks (folder_id);
create index if not exists idx_tasks_archived on public.tasks (archived_at);
create index if not exists idx_folders_parent on public.folders (parent_id);
create index if not exists idx_comments_task on public.comments (task_id);
create index if not exists idx_comments_parent on public.comments (parent_id);
create index if not exists idx_checklist_task on public.checklist_items (task_id);
create index if not exists idx_watchers_task on public.task_watchers (task_id);
create index if not exists idx_task_labels_task on public.task_labels (task_id);
create index if not exists idx_time_entries_task on public.time_entries (task_id);
create index if not exists idx_time_entries_user on public.time_entries (user_id);
create index if not exists idx_activity_task on public.activity (task_id, created_at desc);
create index if not exists idx_activity_created on public.activity (created_at desc);
create index if not exists idx_template_items on public.template_checklist_items (template_id);

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

-- The single super-admin can see private tasks (break-glass owner).
create or replace function public.is_superadmin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_superadmin from public.profiles where id = auth.uid()), false);
$$;

-- Whether the current user may see a task (honors the private-task rule).
-- SECURITY DEFINER so the cross-table reads bypass RLS (no policy recursion).
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

  insert into public.profiles (id, email, full_name, role, is_superadmin)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    assigned_role,
    -- The very first user (the admin) is also the sole super-admin.
    assigned_role = 'admin'
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
alter table public.folders enable row level security;
alter table public.tasks enable row level security;
alter table public.task_watchers enable row level security;
alter table public.comments enable row level security;
alter table public.checklist_items enable row level security;
alter table public.labels enable row level security;
alter table public.task_labels enable row level security;
alter table public.time_entries enable row level security;
alter table public.activity enable row level security;
alter table public.task_templates enable row level security;
alter table public.template_checklist_items enable row level security;

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

-- folders: all read; admin+user manage the tree.
drop policy if exists folders_select on public.folders;
create policy folders_select on public.folders
  for select to authenticated using (true);

drop policy if exists folders_write on public.folders;
create policy folders_write on public.folders
  for all to authenticated
  using (public.can_write()) with check (public.can_write());

-- tasks: read if visible (honors privacy); admin+user insert/update; only admin delete.
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks
  for select to authenticated using ( public.can_see_task(id) );

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks
  for insert to authenticated with check (public.can_write());

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
  for delete to authenticated using ( public.is_admin() and public.can_see_task(id) );

-- watchers: read if the task is visible; admin+user manage.
drop policy if exists watchers_select on public.task_watchers;
create policy watchers_select on public.task_watchers
  for select to authenticated using ( public.can_see_task(task_id) );

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

-- comments: read if the task is visible; admin+user create; authors edit/delete own, admins any.
drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments
  for select to authenticated using ( public.can_see_task(task_id) );

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

drop policy if exists comments_update_own on public.comments;
create policy comments_update_own on public.comments
  for update to authenticated
  using (author_id = auth.uid() or public.is_admin())
  with check (author_id = auth.uid() or public.is_admin());

drop policy if exists comments_delete_own on public.comments;
create policy comments_delete_own on public.comments
  for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

-- checklist items: read if the task is visible; admin+user write; contributor on assigned tasks only.
drop policy if exists checklist_select on public.checklist_items;
create policy checklist_select on public.checklist_items
  for select to authenticated using ( public.can_see_task(task_id) );

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

-- labels: all read; admin+user manage the set.
drop policy if exists labels_select on public.labels;
create policy labels_select on public.labels
  for select to authenticated using (true);
drop policy if exists labels_write on public.labels;
create policy labels_write on public.labels
  for all to authenticated
  using (public.can_write()) with check (public.can_write());

-- task_labels: all read; admin+user, or contributor on their assigned task.
drop policy if exists task_labels_select on public.task_labels;
create policy task_labels_select on public.task_labels
  for select to authenticated using ( public.can_see_task(task_id) );
drop policy if exists task_labels_write on public.task_labels;
create policy task_labels_write on public.task_labels
  for all to authenticated
  using (
    public.can_write()
    or (
      public.current_role() = 'contributor'
      and exists (select 1 from public.tasks t where t.id = task_id and t.assignee_id = auth.uid())
    )
  )
  with check (
    public.can_write()
    or (
      public.current_role() = 'contributor'
      and exists (select 1 from public.tasks t where t.id = task_id and t.assignee_id = auth.uid())
    )
  );

-- time_entries: all read; log on tasks you can edit; edit/delete your own (admins any).
drop policy if exists time_entries_select on public.time_entries;
create policy time_entries_select on public.time_entries
  for select to authenticated using ( public.can_see_task(task_id) );
drop policy if exists time_entries_insert on public.time_entries;
create policy time_entries_insert on public.time_entries
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      public.can_write()
      or (
        public.current_role() = 'contributor'
        and exists (select 1 from public.tasks t where t.id = task_id and t.assignee_id = auth.uid())
      )
    )
  );
drop policy if exists time_entries_modify on public.time_entries;
create policy time_entries_modify on public.time_entries
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());
drop policy if exists time_entries_delete on public.time_entries;
create policy time_entries_delete on public.time_entries
  for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- activity: read if its task is visible (task-independent rows are public); insert as yourself.
drop policy if exists activity_select on public.activity;
create policy activity_select on public.activity
  for select to authenticated
  using ( task_id is null or public.can_see_task(task_id) );
drop policy if exists activity_insert on public.activity;
create policy activity_insert on public.activity
  for insert to authenticated with check (actor_id = auth.uid());

-- templates: all read; admin+user manage.
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
do $$ begin
  alter publication supabase_realtime add table public.checklist_items;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.folders;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.labels;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.task_labels;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.time_entries;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.activity;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.task_templates;
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
