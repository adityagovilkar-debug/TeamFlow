-- Allow multiple super-admins (previously limited to exactly one). The app guards
-- against removing the last one so nobody loses access to private data. Safe to re-run.
drop index if exists public.uniq_superadmin;
