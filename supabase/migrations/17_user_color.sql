-- Per-user display color (avatars + dashboard). Null = auto color derived from a
-- distinct palette. Safe to re-run.
alter table public.profiles
  add column if not exists color text;
