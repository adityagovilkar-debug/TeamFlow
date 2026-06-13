-- Migration: per-user email notification preference.
-- Run once in the Supabase SQL editor (safe to re-run).
alter table public.profiles
  add column if not exists email_notifications boolean not null default true;
