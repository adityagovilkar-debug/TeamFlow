# TeamFlow

A lightweight, modern task manager for small teams — a "mini JIRA". Tasks with
priorities, due dates, product/team labels, assignees, watchers, and comments; a
role system (Admin / User / Viewer); a Kanban board; a reporting dashboard; and a
calendar — all on a shared Supabase database, deployable to Vercel.

Built with **Next.js 16 (App Router)**, **Supabase** (Postgres + Auth + Realtime),
**Tailwind CSS v4**, and **Recharts**.

---

## Features

- **Tasks** — title, description, priority (low/medium/high/urgent), start & due
  dates, product/team, folder, assignee, and watchers.
- **Threaded comments** — reply to a comment; replies nest under it.
- **Checklists** — lightweight to-do items on any task or subtask, with a
  done/total progress bar (great for quick wins).
- **Folders** — a nestable folder tree (e.g. by client / campaign) to organize and
  browse tasks.
- **Archive** — archive old/finished tasks so they drop out of the active views
  (Tasks / Board / Calendar / Timeline / Dashboard) but stay browsable under
  Tasks → Archived, and can be restored anytime.
- **Private tasks** — mark a task private so only its **creator, assignee, watchers,
  and the single super-admin** can see it (enforced in the database, including its
  comments/checklist/time/activity). Marking an epic private cascades to its subtasks.
- **Roles** (enforced in the database via Row-Level Security, not just the UI):
  - **Super-admin** — exactly one (the owner); the only person who can see *every*
    private task. Otherwise an Admin. Transferable in Admin → Members.
  - **Admin** — full access: delete tasks, manage custom statuses & teams, assign roles, manage users (but does **not** see others' private tasks).
  - **User** — create/edit any task, comment, manage watchers, manage folders.
  - **Contributor** — can edit, comment, and check off items only on tasks **assigned to them**; views everything else.
  - **Viewer** — read-only.
- **Labels** — colored tags on tasks (manage in Admin), shown on the list/board and
  filterable.
- **Time tracking** — a per-task estimate plus logged time entries, rolled up by
  person (Workload) and client (folder dashboard).
- **Approvals** — request approval on a task; admins/users approve or request changes.
- **@mentions** — mention a teammate in a comment to notify them.
- **Activity log** — a per-task timeline and a global **Activity** feed.
- **Task templates & recurring tasks** — spin up common tasks (with a checklist) from
  a template; mark a recurring task done to auto-create the next occurrence.
- **Per-user colors** — each member has a distinct color (auto, or pick a custom one
  in Admin → Members) shown on their avatar and the dashboard's "by assignee" chart.
- **Dark mode** — toggle in the sidebar or Settings; remembers your choice.
- **Board** — drag-and-drop Kanban grouped by status.
- **My Work** — your tasks grouped by urgency (overdue / today / this week / later).
- **Workload** — open tasks and hours per person, with a status breakdown.
- **Timeline** — a Gantt-style view of tasks as bars across their start → due dates,
  color-coded by priority, with overdue highlighting and a team filter.
- **Client dashboards** — a rollup page per folder (open/overdue/done, hours, recent
  activity).
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

> **Already have the database from an earlier version?** Run the migrations in
> [`supabase/migrations/`](supabase/migrations) (in order) in the Supabase SQL
> editor. They're all idempotent (safe to re-run):
> - `01_email_notifications.sql` — notification preference
> - `02_subtasks_pipeline.sql` — epics + subtask pipeline
> - `03a_add_contributor_role.sql` then `03b_contributor_policies.sql` — Contributor
>   role *(run 03a alone first; a new enum value can't be used in the same
>   transaction it's created)*
> - `04_threaded_comments.sql` — comment replies
> - `05_checklists.sql` — task/subtask checklists
> - `06_timeline_start_date.sql` — task start date (Timeline)
> - `07_folders.sql` — folder tree
> - `08_archive.sql` — task archiving
> - `09_labels.sql` — colored labels
> - `10_approvals.sql` — task approval workflow
> - `11_time_tracking.sql` — estimates + time entries
> - `12_activity_log.sql` — activity feed
> - `13_templates_recurrence.sql` — task templates + recurrence
> - `14_private_tasks.sql` — private tasks + single super-admin
> - `15_private_select_fix.sql` — fix for the private-task read policy
> - `16_placeholder_members.sql` — "Add user" (assignable members with no app access)
> - `17_user_color.sql` — per-user display color
>
> Migrations **04–17 can be pasted and run together** in one query (none have the
> enum-in-transaction caveat). The app expects these tables/columns, so run them
> before using the new build.

---

## Epics & subtask pipelines

Open any task and use the **Pipeline** section to break it into ordered subtasks.
Each subtask **unlocks only when the previous one is Done** — a locked subtask
can't be moved to In Progress / Done (enforced in the UI, on the board, and at the
server). Epics show a branch badge with a **progress bar** (done/total) in the task
list and board, and locked subtasks show a 🔒 badge. **Admins can drag the handle**
in the Pipeline to reorder subtasks.

## Checklists, threaded comments, folders, archive & timeline

- **Checklists** — open a task and use the **Checklist** card to add quick to-dos;
  tick them off to fill the progress bar. Works on subtasks too. A `✓ done/total`
  badge shows on the task list and board.
- **Threaded comments** — hit **Reply** under any comment to start a thread; replies
  nest beneath it.
- **Folders** — the **Folders** panel on the Tasks page is a nestable tree (e.g. one
  folder per client or campaign). Click a folder to filter; admins/users can add
  subfolders, rename, and delete (deleting a folder keeps its tasks — they move to
  *No folder* — and removes empty subfolders). Set a task's folder in the task
  dialog.
- **Archive** — archive a task (from its page or the row menu) to move it out of the
  active views; find it under **Tasks → Archived** and **Restore** when needed.
- **Timeline** — the **Timeline** tab shows a Gantt of tasks as bars spanning their
  **start date → due date** (start falls back to the created date). Set a start date
  in the task dialog. Color = priority; overdue tasks get a red outline.

## Labels, time, approvals, mentions, templates & views

- **Labels** — create colored labels in **Admin → Labels**, tag tasks in the task
  dialog, and filter by label on the Tasks page.
- **Time tracking** — set an **Estimate (hours)** in the task dialog and log time in
  the task's **Time** card. Totals roll up on **Workload** and folder dashboards.
- **Approvals** — on a task, **Request approval**; an admin/user can **Approve** or
  **Request changes**. Status shows as a badge on the list and board.
- **@mentions** — type `@Name` in a comment to notify that teammate.
- **Activity** — every task has an **Activity** timeline; the **Activity** tab is the
  team-wide feed.
- **Templates & recurring** — manage reusable tasks in **Admin → Templates**, then
  pick one via **Start from template** in the task dialog. Set **Repeat**
  (daily/weekly/monthly) to auto-create the next occurrence when the task is done.
- **Dark mode** — toggle via the sun/moon in the sidebar or **Settings → Appearance**.
- **My Work** — your tasks grouped by urgency. **Workload** — per-person load + hours.
- **Client dashboard** — open a folder's dashboard from the folder list on Tasks.
- **Private tasks** — flip the **Private** switch in the task dialog. Only the
  creator, assignee, watchers, and the super-admin can see it (and its comments, time,
  activity). Add someone as a watcher to grant them access. The **super-admin** is set
  in **Admin → Members** (only the current super-admin can transfer it).

## User management (admin)

Admins can manage members from **Admin → Members**:

- **Change roles** (works with just the public key).
- **Reset a password** — set or generate a new one and share it; the user can sign
  in immediately. *(requires the service-role key — see below)*
- **Delete a user** — removes their login and profile immediately. *(requires the
  service-role key)*
- **Add user** *(super-admin only)* — add someone you can **assign and track** but who
  **can't sign in** (e.g. a contractor or a teammate who won't use the app). They show
  up in assignee/watcher pickers and Workload, are badged "No app access," and are
  never emailed. Email is optional. *(requires the service-role key)*

### Enable delete / password reset / add user

These two actions use Supabase's admin API, which needs the **service-role key**:

1. Supabase → **Project Settings → API Keys** → copy the **`service_role` (secret)** key.
2. Add it to `.env.local` (and Vercel) as `SUPABASE_SERVICE_ROLE_KEY=...` and restart.

> ⚠️ The service-role key bypasses all security rules. It is used **only on the
> server**, never sent to the browser, and must never be committed. The actions are
> also guarded so only admins can call them.

## Email notifications (optional)

TeamFlow can email the people connected to a task — its **creator, assignee, and
watchers** — when:

- a **new comment** is posted,
- the task's **status changes**, or
- someone is **newly assigned** or **added as a watcher**.

The person who made the change is never emailed, and each user can turn emails off
in **Settings**. Notifications are best-effort: if email fails or isn't configured,
task actions still succeed.

### Set up SMTP (Gmail example — no domain needed)

1. On the Google account you'll send from, enable **2-Step Verification**, then
   create an **App Password**: Google Account → Security → App passwords. Copy the
   16-character password.
2. Fill these in `.env.local` (and later in Vercel):
   ```bash
   NEXT_PUBLIC_APP_URL=http://localhost:3000   # your Vercel URL in production
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=you@gmail.com
   SMTP_PASS=your-16-char-app-password
   SMTP_FROM=TeamFlow <you@gmail.com>
   ```
3. Restart `npm run dev`. Any SMTP provider works (Resend SMTP, SendGrid, Mailgun,
   your own host) — just swap the host/credentials.

> Gmail SMTP is great for a small team (≈500 emails/day). For higher volume use a
> transactional provider.

---

## 2. Deploy to Vercel

1. Push this folder to a GitHub repository.
2. On [vercel.com](https://vercel.com) → **Add New → Project** → import the repo.
3. **Environment Variables** — add the keys from `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_APP_URL` — set to your Vercel domain (so email links point to prod)
   - `SUPABASE_SERVICE_ROLE_KEY` (only if using admin delete-user / password-reset)
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (only if using email notifications)
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
