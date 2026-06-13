import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isEmailConfigured, sendEmail } from "@/lib/email";

/**
 * Task notification emails. Recipients for broadcast events are the task's
 * creator + assignee + watchers, minus the person who triggered the change and
 * anyone who has opted out (profiles.email_notifications = false).
 *
 * All functions are defensive: a delivery failure must never break the write
 * that triggered it.
 */

type EventType = "comment" | "status" | "assigned" | "watching";

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

interface TaskLite {
  id: string;
  title: string;
  created_by: string | null;
  assignee_id: string | null;
}

async function loadTask(
  supabase: SupabaseClient,
  taskId: string,
): Promise<TaskLite | null> {
  const { data } = await supabase
    .from("tasks")
    .select("id, title, created_by, assignee_id")
    .eq("id", taskId)
    .single();
  return (data as TaskLite) ?? null;
}

async function getWatcherIds(
  supabase: SupabaseClient,
  taskId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("task_watchers")
    .select("user_id")
    .eq("task_id", taskId);
  return (data ?? []).map((w: { user_id: string }) => w.user_id);
}

function buildEmail(
  type: EventType,
  taskTitle: string,
  taskId: string,
  actorName: string,
  recipientName: string,
  extra?: { statusName?: string; comment?: string },
): { subject: string; html: string; text: string } {
  const link = `${appUrl()}/tasks/${taskId}`;
  const safe = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  let subject = "";
  let headline = "";
  let detail = "";

  switch (type) {
    case "comment":
      subject = `💬 New comment on “${taskTitle}”`;
      headline = `${actorName} commented on a task you're following`;
      detail = extra?.comment
        ? `<blockquote style="margin:12px 0;padding:10px 14px;border-left:3px solid #6366f1;background:#f6f7fb;border-radius:6px;color:#334155;">${safe(
            extra.comment,
          )}</blockquote>`
        : "";
      break;
    case "status":
      subject = `🔄 “${taskTitle}” → ${extra?.statusName ?? "updated"}`;
      headline = `${actorName} moved this task to ${safe(
        extra?.statusName ?? "a new status",
      )}`;
      break;
    case "assigned":
      subject = `📌 You were assigned “${taskTitle}”`;
      headline = `${actorName} assigned this task to you`;
      break;
    case "watching":
      subject = `👀 You're now watching “${taskTitle}”`;
      headline = `${actorName} added you as a watcher`;
      break;
  }

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#0f1729;">
    <div style="background:linear-gradient(135deg,#6366f1,#a855f7);padding:20px 24px;border-radius:12px 12px 0 0;">
      <span style="color:#fff;font-size:18px;font-weight:700;">TeamFlow</span>
    </div>
    <div style="border:1px solid #e3e7f0;border-top:none;border-radius:0 0 12px 12px;padding:24px;">
      <p style="margin:0 0 4px;color:#647088;font-size:14px;">Hi ${safe(
        recipientName,
      )},</p>
      <p style="margin:0 0 8px;font-size:16px;font-weight:600;">${safe(
        headline,
      )}</p>
      <p style="margin:0 0 4px;font-size:15px;color:#334155;">Task: <strong>${safe(
        taskTitle,
      )}</strong></p>
      ${detail}
      <a href="${link}" style="display:inline-block;margin-top:16px;background:#6366f1;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;font-size:14px;">View task →</a>
      <p style="margin:20px 0 0;font-size:12px;color:#94a3b8;">You're receiving this because you're the creator, assignee, or a watcher of this task. Turn these off anytime in TeamFlow → Settings.</p>
    </div>
  </div>`;

  const text = `${headline}\nTask: ${taskTitle}\n${
    extra?.comment ? `\n"${extra.comment}"\n` : ""
  }\nView: ${link}\n\n(Manage notifications in TeamFlow → Settings.)`;

  return { subject, html, text };
}

async function deliver(
  supabase: SupabaseClient,
  recipientIds: (string | null)[],
  actorId: string,
  type: EventType,
  task: TaskLite,
  extra?: { statusName?: string; comment?: string },
): Promise<void> {
  if (!isEmailConfigured()) return;

  const ids = [...new Set(recipientIds)].filter(
    (id): id is string => Boolean(id) && id !== actorId,
  );
  if (ids.length === 0) return;

  const [{ data: recips }, { data: actor }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, email_notifications")
      .in("id", ids),
    supabase.from("profiles").select("full_name, email").eq("id", actorId).single(),
  ]);

  const actorName = actor?.full_name || actor?.email || "Someone";

  for (const p of recips ?? []) {
    if (!p.email_notifications || !p.email) continue;
    const { subject, html, text } = buildEmail(
      type,
      task.title,
      task.id,
      actorName,
      p.full_name || p.email,
      extra,
    );
    await sendEmail({ to: p.email, subject, html, text });
  }
}

/** Wrap a notify call so it never throws into the calling action. */
async function safe(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch {
    // Notifications are best-effort.
  }
}

export async function notifyComment(
  supabase: SupabaseClient,
  taskId: string,
  actorId: string,
  comment: string,
): Promise<void> {
  await safe(async () => {
    const task = await loadTask(supabase, taskId);
    if (!task) return;
    const watchers = await getWatcherIds(supabase, taskId);
    await deliver(
      supabase,
      [task.created_by, task.assignee_id, ...watchers],
      actorId,
      "comment",
      task,
      { comment },
    );
  });
}

export async function notifyStatusChange(
  supabase: SupabaseClient,
  taskId: string,
  actorId: string,
  statusName: string,
): Promise<void> {
  await safe(async () => {
    const task = await loadTask(supabase, taskId);
    if (!task) return;
    const watchers = await getWatcherIds(supabase, taskId);
    await deliver(
      supabase,
      [task.created_by, task.assignee_id, ...watchers],
      actorId,
      "status",
      task,
      { statusName },
    );
  });
}

export async function notifyAssigned(
  supabase: SupabaseClient,
  taskId: string,
  actorId: string,
  assigneeId: string,
): Promise<void> {
  await safe(async () => {
    const task = await loadTask(supabase, taskId);
    if (!task) return;
    await deliver(supabase, [assigneeId], actorId, "assigned", task);
  });
}

export async function notifyWatching(
  supabase: SupabaseClient,
  taskId: string,
  actorId: string,
  watcherIds: string[],
): Promise<void> {
  await safe(async () => {
    if (watcherIds.length === 0) return;
    const task = await loadTask(supabase, taskId);
    if (!task) return;
    await deliver(supabase, watcherIds, actorId, "watching", task);
  });
}
