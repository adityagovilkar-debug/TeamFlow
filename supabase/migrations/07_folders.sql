-- Folders: a nestable tree to organize tasks (e.g. by client / campaign).
-- Tasks reference a folder; deleting a folder detaches its tasks (folder_id ->
-- null) and cascade-deletes its subfolders. Admins/users manage the tree.
-- Safe to re-run.

create table if not exists public.folders (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  parent_id  uuid references public.folders(id) on delete cascade,
  color      text not null default '#6366f1',
  position   int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.tasks
  add column if not exists folder_id uuid references public.folders(id) on delete set null;

create index if not exists idx_folders_parent on public.folders(parent_id);
create index if not exists idx_tasks_folder on public.tasks(folder_id);

alter table public.folders enable row level security;

drop policy if exists folders_select on public.folders;
create policy folders_select on public.folders
  for select to authenticated using (true);

drop policy if exists folders_write on public.folders;
create policy folders_write on public.folders
  for all to authenticated
  using (public.can_write()) with check (public.can_write());

do $$ begin
  alter publication supabase_realtime add table public.folders;
exception when duplicate_object then null; end $$;
