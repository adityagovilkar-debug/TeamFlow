-- Migration 03a: add the "contributor" role.
-- Run this FIRST and on its own. A new enum value can't be used in the same
-- transaction it's created, so the policies live in 03b (run after this).
alter type user_role add value if not exists 'contributor';
