-- Placeholder members: people the super-admin can assign/track but who have no app
-- access (created as credential-less auth users). The flag just badges them and
-- keeps them out of notification emails. Safe to re-run.
alter table public.profiles
  add column if not exists is_placeholder boolean not null default false;
