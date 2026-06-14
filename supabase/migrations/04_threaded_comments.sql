-- Threaded comments: a comment can be a reply to another comment.
-- Replies cascade-delete with their parent. Safe to re-run.
alter table public.comments
  add column if not exists parent_id uuid references public.comments(id) on delete cascade;

create index if not exists idx_comments_parent on public.comments(parent_id);
