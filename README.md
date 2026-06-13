# TeamFlow

A lightweight, modern task manager for small teams — a "mini JIRA". Tasks with
priorities, due dates, product/team labels, assignees, watchers, and comments; a
role system (Admin / User / Viewer); a Kanban board; a reporting dashboard; and a
calendar — all on a shared Supabase database, deployable to Vercel.

Built with **Next.js 16 (App Router)**, **Supabase** (Postgres + Auth + Realtime),
**Tailwind CSS v4**, and **Recharts**.

---

## Features

- **Tasks** — title, description, priority (low/medium/high/urgent), due date,
  product/team, assignee, watchers, and threaded comments.
- **Roles** (enforced in the database via Row-Level Security, not just the UI):
  - **Admin** — full access: delete tasks, manage custom statuses & teams, assign roles.
  - **User** — create/edit tasks, comment, manage watchers.
  - **Viewer** — read-only.
- **Board** — drag-and-drop Kanban grouped by status.
- **Dashboard** — totals, tasks by status / assignee / priority, overdue & due-soon,
  completion rate, filterable by team.
- **Calendar** — month view of tasks on their due dates, color-coded by priority,
  with overdue highlighting.
- **Live sync** — changes appear across teammates in real time (Supabase Realtime).
- **Admin panel** — manage members & roles, teams/products, and custom statuses.

---

## 1. Local setup

### Prerequisites
- Node.js 20.9+ and npm
- A free [Supabase](https://supabase.com) account

### Steps

1. **Create a Supabase project**
   - supabase.com → **New project**. Choose a name + strong database password.
   - Wait ~1 minute for it to provision.

2. **Add your API keys**
   - In Supabase: **Project Settings → API**.
   - Copy the **Project URL** and the **anon / public** key into `.env.local`:
     ```bash
     NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
     NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-PUBLIC-KEY
     ```

3. **Create the database schema**
   - In Supabase: **SQL Editor → New query**.
   - Paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**.
   - This creates all tables, the first-user-is-admin trigger, RLS policies,
     realtime, and seed statuses/teams.

4. **(Recommended for a small team) Turn off email confirmation**
   - **Authentication → Sign In / Providers → Email** → disable "Confirm email".
   - This lets teammates sign in immediately after signing up. (Leave it on if you
     prefer email verification — accounts then need to confirm before first login.)

5. **Install & run**
   ```bash
   npm install
   npm run dev
   ```
   Open http://localhost:3000.

6. **Sign up** — the **first account becomes Admin**. Teammates who sign up after
   join as **Viewer**; promote them in **Admin → Members**.

---

## 2. Deploy to Vercel

1. Push this folder to a GitHub repository.
2. On [vercel.com](https://vercel.com) → **Add New → Project** → import the repo.
3. **Environment Variables** — add the same two keys from `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. **Deploy.** Vercel auto-detects Next.js; no extra config needed.
5. **Point Supabase at your live URL** so auth redirects work:
   - Supabase → **Authentication → URL Configuration** → set **Site URL** to your
     Vercel domain (e.g. `https://teamflow.vercel.app`) and add it to **Redirect URLs**.

Your team can now log in at the Vercel URL against the same shared database.

---

## Project structure

```
supabase/schema.sql          # one-shot DB schema (tables, RLS, trigger, seed)
src/
  proxy.ts                   # Next 16 middleware — refreshes session, gates routes
  lib/
    supabase/{client,server,proxy,config}.ts
    auth.ts                  # getCurrentProfile() + role helpers
    data.ts                  # server-side read queries
    actions.ts               # server actions (all writes; RLS-enforced)
    types.ts, date.ts, utils.ts, use-realtime.ts
  app/
    (auth)/{login,signup}    # email/password auth
    (app)/{dashboard,tasks,board,calendar,admin}
    setup/                   # shown until Supabase keys are configured
  components/                # ui/ primitives + feature components
```

## Notes

- **Roles are enforced at the database layer** via Postgres RLS, so a Viewer cannot
  write even by calling the API directly — the UI gating is a convenience on top.
- **Custom statuses**: the `Done` category drives completion stats and reporting.
- **Tech**: Next.js renamed `middleware` → `proxy` in v16; this app uses `src/proxy.ts`.
