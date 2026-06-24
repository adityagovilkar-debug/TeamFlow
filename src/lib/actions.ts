"use server";

import { revalidatePath } from "next/cache";
import { addDays, addMonths, addWeeks, parseISO, format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import {
  notifyApproval,
  notifyAssigned,
  notifyComment,
  notifyMention,
  notifyStatusChange,
  notifyWatching,
} from "@/lib/notify";
import { logActivity } from "@/lib/activity";
import type { Priority, Recurrence, Role, StatusCategory } from "@/lib/types";

/** Returns the caller's id if they are an admin, else an error result. */
async function requireAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ userId: string } | { error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (data?.role !== "admin") return { error: "Admins only." };
  return { userId: user.id };
}

async function statusName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  statusId: string | null,
): Promise<string> {
  if (!statusId) return "No status";
  const { data } = await supabase
    .from("statuses")
    .select("name")
    .eq("id", statusId)
    .single();
  return data?.name ?? "updated";
}

type Result = { error?: string };

export interface TaskInput {
  title: string;
  description: string | null;
  priority: Priority;
  status_id: string | null;
  team_id: string | null;
  assignee_id: string | null;
  due_date: string | null;
  start_date: string | null;
  folder_id: string | null;
  estimate_minutes: number | null;
  recurrence: Recurrence;
  is_private: boolean;
  labels: string[];
  watchers: string[];
  parent_id?: string | null;
  template_id?: string | null;
}

/**
 * Whether a subtask is blocked by an unfinished predecessor in its epic.
 * Used to enforce the pipeline rule server-side (a subtask can't move past
 * "todo" until earlier siblings are done).
 */
async function blockedPredecessor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  taskId: string,
): Promise<string | null> {
  const { data: task } = await supabase
    .from("tasks")
    .select("parent_id, position")
    .eq("id", taskId)
    .single();
  if (!task?.parent_id) return null;

  const { data: preds } = await supabase
    .from("tasks")
    .select("title, position, status:statuses(category)")
    .eq("parent_id", task.parent_id)
    .lt("position", task.position)
    .order("position", { ascending: true });

  // The embedded `status` may come back as an object or a single-element array
  // depending on type inference; normalize before checking the category.
  type Row = { title: string; status: unknown };
  const category = (status: unknown): string | null => {
    const s = Array.isArray(status) ? status[0] : status;
    return (s as { category?: string } | null)?.category ?? null;
  };
  const blocker = ((preds ?? []) as Row[]).find(
    (p) => category(p.status) !== "done",
  );
  return blocker?.title ?? null;
}

async function statusCategory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  statusId: string | null,
): Promise<StatusCategory | null> {
  if (!statusId) return null;
  const { data } = await supabase
    .from("statuses")
    .select("category")
    .eq("id", statusId)
    .single();
  return (data?.category as StatusCategory) ?? null;
}

function revalidateTaskViews() {
  revalidatePath("/tasks");
  revalidatePath("/board");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath("/timeline");
}

/**
 * Whether the current user may edit a given task (mirrors canEditTask, server
 * side): admins/users can edit any task; a contributor only tasks assigned to
 * them; viewers none. Used to guard checklist + archive actions.
 */
async function canEditTaskServer(
  supabase: Awaited<ReturnType<typeof createClient>>,
  taskId: string,
): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (me?.role === "admin" || me?.role === "user") return true;
  if (me?.role === "contributor") {
    const { data: task } = await supabase
      .from("tasks")
      .select("assignee_id")
      .eq("id", taskId)
      .single();
    return task?.assignee_id === user.id;
  }
  return false;
}

export async function createTask(input: TaskInput): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // Subtasks are appended to the end of their epic's pipeline, and inherit the
  // epic's privacy (a private epic's subtasks must be private too).
  let position = 0;
  let isPrivate = input.is_private;
  if (input.parent_id) {
    const { count } = await supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("parent_id", input.parent_id);
    position = count ?? 0;
    const { data: parent } = await supabase
      .from("tasks")
      .select("is_private")
      .eq("id", input.parent_id)
      .single();
    if (parent?.is_private) isPrivate = true;
  }

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      title: input.title,
      description: input.description,
      priority: input.priority,
      status_id: input.status_id,
      team_id: input.team_id,
      assignee_id: input.assignee_id,
      due_date: input.due_date,
      start_date: input.start_date,
      folder_id: input.folder_id,
      estimate_minutes: input.estimate_minutes,
      recurrence: input.recurrence,
      is_private: isPrivate,
      parent_id: input.parent_id ?? null,
      position,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  if (input.watchers.length > 0) {
    await supabase.from("task_watchers").insert(
      input.watchers.map((uid) => ({ task_id: data.id, user_id: uid })),
    );
  }
  if (input.labels.length > 0) {
    await supabase.from("task_labels").insert(
      input.labels.map((lid) => ({ task_id: data.id, label_id: lid })),
    );
  }
  // Copy checklist items from a template, if this task was created from one.
  if (input.template_id) {
    const { data: tItems } = await supabase
      .from("template_checklist_items")
      .select("body, position")
      .eq("template_id", input.template_id);
    if (tItems && tItems.length > 0) {
      await supabase.from("checklist_items").insert(
        tItems.map((i) => ({
          task_id: data.id,
          body: i.body,
          position: i.position,
        })),
      );
    }
  }

  // Notify the new assignee and watchers (not the creator themselves).
  if (input.assignee_id) {
    await notifyAssigned(supabase, data.id, user.id, input.assignee_id);
  }
  await notifyWatching(supabase, data.id, user.id, input.watchers);
  await logActivity(supabase, {
    taskId: data.id,
    type: "created",
    summary: `created ${input.parent_id ? "subtask" : "task"} “${input.title}”`,
  });

  revalidateTaskViews();
  if (input.parent_id) revalidatePath(`/tasks/${input.parent_id}`);
  return {};
}

export async function updateTask(
  id: string,
  input: TaskInput,
): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // Capture prior state to diff for notifications.
  const { data: prior } = await supabase
    .from("tasks")
    .select("status_id, assignee_id, is_private")
    .eq("id", id)
    .single();
  const { data: priorWatcherRows } = await supabase
    .from("task_watchers")
    .select("user_id")
    .eq("task_id", id);
  const priorWatchers = (priorWatcherRows ?? []).map(
    (w: { user_id: string }) => w.user_id,
  );

  // Pipeline rule: block moving a subtask past "todo" if a predecessor isn't done.
  if (input.status_id && input.status_id !== prior?.status_id) {
    const category = await statusCategory(supabase, input.status_id);
    if (category && category !== "todo") {
      const blocker = await blockedPredecessor(supabase, id);
      if (blocker) return { error: `Blocked — finish “${blocker}” first.` };
    }
  }

  const { error } = await supabase
    .from("tasks")
    .update({
      title: input.title,
      description: input.description,
      priority: input.priority,
      status_id: input.status_id,
      team_id: input.team_id,
      assignee_id: input.assignee_id,
      due_date: input.due_date,
      start_date: input.start_date,
      folder_id: input.folder_id,
      estimate_minutes: input.estimate_minutes,
      recurrence: input.recurrence,
      is_private: input.is_private,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  // Privacy change cascades to subtasks (so an epic's children match the epic).
  if (input.is_private !== prior?.is_private) {
    await supabase
      .from("tasks")
      .update({ is_private: input.is_private })
      .eq("parent_id", id);
    await logActivity(supabase, {
      taskId: id,
      type: "privacy",
      summary: input.is_private ? "made this task private" : "made this task public",
    });
  }

  // Reconcile watchers: clear then re-insert.
  await supabase.from("task_watchers").delete().eq("task_id", id);
  if (input.watchers.length > 0) {
    await supabase.from("task_watchers").insert(
      input.watchers.map((uid) => ({ task_id: id, user_id: uid })),
    );
  }
  // Reconcile labels.
  await supabase.from("task_labels").delete().eq("task_id", id);
  if (input.labels.length > 0) {
    await supabase.from("task_labels").insert(
      input.labels.map((lid) => ({ task_id: id, label_id: lid })),
    );
  }

  // Notify on the events we care about: status change, new assignee, new watchers.
  if (input.status_id && input.status_id !== prior?.status_id) {
    const sName = await statusName(supabase, input.status_id);
    await notifyStatusChange(supabase, id, user.id, sName);
    await logActivity(supabase, {
      taskId: id,
      type: "status",
      summary: `moved “${input.title}” to ${sName}`,
    });
    await maybeRecur(supabase, id, input.status_id);
  }
  if (input.assignee_id && input.assignee_id !== prior?.assignee_id) {
    await notifyAssigned(supabase, id, user.id, input.assignee_id);
  }
  const addedWatchers = input.watchers.filter(
    (w) => !priorWatchers.includes(w),
  );
  await notifyWatching(supabase, id, user.id, addedWatchers);

  revalidateTaskViews();
  revalidatePath(`/tasks/${id}`);
  return {};
}

export async function updateTaskStatus(
  id: string,
  statusId: string,
): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Pipeline rule: a subtask can't move past "todo" until earlier siblings are done.
  const category = await statusCategory(supabase, statusId);
  if (category && category !== "todo") {
    const blocker = await blockedPredecessor(supabase, id);
    if (blocker) {
      return { error: `Blocked — finish “${blocker}” first.` };
    }
  }

  const { error } = await supabase
    .from("tasks")
    .update({ status_id: statusId })
    .eq("id", id);
  if (error) return { error: error.message };

  if (user) {
    const sName = await statusName(supabase, statusId);
    await notifyStatusChange(supabase, id, user.id, sName);
    await logActivity(supabase, {
      taskId: id,
      type: "status",
      summary: `moved this task to ${sName}`,
    });
  }
  await maybeRecur(supabase, id, statusId);

  revalidateTaskViews();
  return {};
}

/**
 * If a recurring task has just entered a "done" status, create the next
 * occurrence: same core fields, dates shifted by the interval, checklist copied
 * unchecked. Best-effort.
 */
async function maybeRecur(
  supabase: Awaited<ReturnType<typeof createClient>>,
  taskId: string,
  newStatusId: string,
): Promise<void> {
  try {
    const cat = await statusCategory(supabase, newStatusId);
    if (cat !== "done") return;

    const { data: t } = await supabase
      .from("tasks")
      .select(
        "title, description, priority, status_id, team_id, assignee_id, folder_id, parent_id, due_date, start_date, estimate_minutes, recurrence, created_by",
      )
      .eq("id", taskId)
      .single();
    if (!t || !t.recurrence || t.recurrence === "none" || t.parent_id) return;

    const shift = (d: string | null): string | null => {
      if (!d) return null;
      const base = parseISO(d);
      const next =
        t.recurrence === "daily"
          ? addDays(base, 1)
          : t.recurrence === "weekly"
            ? addWeeks(base, 1)
            : addMonths(base, 1);
      return format(next, "yyyy-MM-dd");
    };

    // The new occurrence starts in the first (lowest-position) status.
    const { data: firstStatus } = await supabase
      .from("statuses")
      .select("id")
      .order("position", { ascending: true })
      .limit(1)
      .single();

    const { data: created } = await supabase
      .from("tasks")
      .insert({
        title: t.title,
        description: t.description,
        priority: t.priority,
        status_id: firstStatus?.id ?? t.status_id,
        team_id: t.team_id,
        assignee_id: t.assignee_id,
        folder_id: t.folder_id,
        due_date: shift(t.due_date),
        start_date: shift(t.start_date),
        estimate_minutes: t.estimate_minutes,
        recurrence: t.recurrence,
        created_by: t.created_by,
      })
      .select("id")
      .single();

    if (created) {
      // Copy checklist items (unchecked) and clear recurrence on the completed one.
      const { data: items } = await supabase
        .from("checklist_items")
        .select("body, position")
        .eq("task_id", taskId);
      if (items && items.length > 0) {
        await supabase.from("checklist_items").insert(
          items.map((i) => ({
            task_id: created.id,
            body: i.body,
            position: i.position,
          })),
        );
      }
      await supabase
        .from("tasks")
        .update({ recurrence: "none" })
        .eq("id", taskId);
      await logActivity(supabase, {
        taskId: created.id,
        type: "recurrence",
        summary: `created the next “${t.title}” (recurring ${t.recurrence})`,
      });
    }
  } catch {
    // best-effort
  }
}

export async function deleteTask(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidateTaskViews();
  return {};
}

export async function addComment(
  taskId: string,
  body: string,
  parentId?: string | null,
): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("comments")
    .insert({
      task_id: taskId,
      author_id: user.id,
      body,
      parent_id: parentId ?? null,
    });
  if (error) return { error: error.message };

  // A reply also notifies the author of the comment being replied to.
  let extra: (string | null)[] = [];
  if (parentId) {
    const { data: parent } = await supabase
      .from("comments")
      .select("author_id")
      .eq("id", parentId)
      .single();
    if (parent?.author_id) extra = [parent.author_id];
  }
  await notifyComment(supabase, taskId, user.id, body, extra);

  // @mentions: notify any teammate named in the body.
  const mentioned = await resolveMentions(supabase, body, user.id);
  if (mentioned.length > 0) {
    await notifyMention(supabase, taskId, user.id, mentioned, body);
  }

  await logActivity(supabase, {
    taskId,
    type: "comment",
    summary: parentId ? "replied to a comment" : "commented",
  });

  revalidatePath(`/tasks/${taskId}`);
  return {};
}

/** Resolve `@Full Name` tokens in text to teammate ids (excluding the author). */
async function resolveMentions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  body: string,
  authorId: string,
): Promise<string[]> {
  if (!body.includes("@")) return [];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email");
  const ids: string[] = [];
  for (const p of profiles ?? []) {
    const name = (p.full_name || "").trim();
    const handle = p.email?.split("@")[0] ?? "";
    const hit =
      (name && body.toLowerCase().includes(`@${name.toLowerCase()}`)) ||
      (handle && body.toLowerCase().includes(`@${handle.toLowerCase()}`));
    if (hit && p.id !== authorId) ids.push(p.id);
  }
  return [...new Set(ids)];
}

export async function deleteComment(
  id: string,
  taskId: string,
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("comments").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/tasks/${taskId}`);
  return {};
}

// ---------- Checklists ----------
export async function addChecklistItem(
  taskId: string,
  body: string,
): Promise<Result> {
  const supabase = await createClient();
  if (!(await canEditTaskServer(supabase, taskId)))
    return { error: "You can't edit this task." };

  const { count } = await supabase
    .from("checklist_items")
    .select("*", { count: "exact", head: true })
    .eq("task_id", taskId);

  const { error } = await supabase
    .from("checklist_items")
    .insert({ task_id: taskId, body, position: count ?? 0 });
  if (error) return { error: error.message };

  revalidatePath(`/tasks/${taskId}`);
  revalidateTaskViews();
  return {};
}

export async function toggleChecklistItem(
  id: string,
  taskId: string,
  isDone: boolean,
): Promise<Result> {
  const supabase = await createClient();
  if (!(await canEditTaskServer(supabase, taskId)))
    return { error: "You can't edit this task." };

  const { error } = await supabase
    .from("checklist_items")
    .update({ is_done: isDone })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/tasks/${taskId}`);
  revalidateTaskViews();
  return {};
}

export async function deleteChecklistItem(
  id: string,
  taskId: string,
): Promise<Result> {
  const supabase = await createClient();
  if (!(await canEditTaskServer(supabase, taskId)))
    return { error: "You can't edit this task." };

  const { error } = await supabase
    .from("checklist_items")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/tasks/${taskId}`);
  revalidateTaskViews();
  return {};
}

// ---------- Folders ----------
export async function createFolder(
  name: string,
  parentId?: string | null,
): Promise<Result> {
  const supabase = await createClient();
  const trimmed = name.trim();
  if (!trimmed) return { error: "Folder name is required." };

  const { count } = await supabase
    .from("folders")
    .select("*", { count: "exact", head: true });

  const { error } = await supabase
    .from("folders")
    .insert({ name: trimmed, parent_id: parentId ?? null, position: count ?? 0 });
  if (error) return { error: error.message };

  revalidateTaskViews();
  return {};
}

export async function renameFolder(id: string, name: string): Promise<Result> {
  const supabase = await createClient();
  const trimmed = name.trim();
  if (!trimmed) return { error: "Folder name is required." };

  const { error } = await supabase
    .from("folders")
    .update({ name: trimmed })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidateTaskViews();
  return {};
}

export async function deleteFolder(id: string): Promise<Result> {
  const supabase = await createClient();
  // FK rules: subfolders cascade-delete; tasks detach (folder_id -> null).
  const { error } = await supabase.from("folders").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidateTaskViews();
  return {};
}

export async function setTaskFolder(
  taskId: string,
  folderId: string | null,
): Promise<Result> {
  const supabase = await createClient();
  if (!(await canEditTaskServer(supabase, taskId)))
    return { error: "You can't edit this task." };

  const { error } = await supabase
    .from("tasks")
    .update({ folder_id: folderId })
    .eq("id", taskId);
  if (error) return { error: error.message };

  revalidatePath(`/tasks/${taskId}`);
  revalidateTaskViews();
  return {};
}

// ---------- Archive ----------
export async function archiveTask(id: string): Promise<Result> {
  const supabase = await createClient();
  if (!(await canEditTaskServer(supabase, id)))
    return { error: "You can't archive this task." };

  const { error } = await supabase
    .from("tasks")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  await logActivity(supabase, { taskId: id, type: "archived", summary: "archived this task" });
  revalidatePath(`/tasks/${id}`);
  revalidateTaskViews();
  return {};
}

export async function unarchiveTask(id: string): Promise<Result> {
  const supabase = await createClient();
  if (!(await canEditTaskServer(supabase, id)))
    return { error: "You can't restore this task." };

  const { error } = await supabase
    .from("tasks")
    .update({ archived_at: null })
    .eq("id", id);
  if (error) return { error: error.message };

  await logActivity(supabase, { taskId: id, type: "restored", summary: "restored this task" });
  revalidatePath(`/tasks/${id}`);
  revalidateTaskViews();
  return {};
}

// ---------- Labels ----------
export async function createLabel(input: {
  name: string;
  color: string;
}): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("labels").insert(input);
  if (error) return { error: error.message };
  revalidatePath("/admin");
  revalidateTaskViews();
  return {};
}

export async function updateLabel(
  id: string,
  input: { name: string; color: string },
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("labels").update(input).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin");
  revalidateTaskViews();
  return {};
}

export async function deleteLabel(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("labels").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin");
  revalidateTaskViews();
  return {};
}

export async function setTaskLabels(
  taskId: string,
  labelIds: string[],
): Promise<Result> {
  const supabase = await createClient();
  if (!(await canEditTaskServer(supabase, taskId)))
    return { error: "You can't edit this task." };
  await supabase.from("task_labels").delete().eq("task_id", taskId);
  if (labelIds.length > 0) {
    const { error } = await supabase
      .from("task_labels")
      .insert(labelIds.map((lid) => ({ task_id: taskId, label_id: lid })));
    if (error) return { error: error.message };
  }
  revalidatePath(`/tasks/${taskId}`);
  revalidateTaskViews();
  return {};
}

// ---------- Approvals ----------
export async function requestApproval(taskId: string): Promise<Result> {
  const supabase = await createClient();
  if (!(await canEditTaskServer(supabase, taskId)))
    return { error: "You can't edit this task." };
  const { error } = await supabase
    .from("tasks")
    .update({ approval_status: "pending", approval_by: null, approval_at: null })
    .eq("id", taskId);
  if (error) return { error: error.message };
  await logActivity(supabase, { taskId, type: "approval", summary: "requested approval" });
  await notifyApproval(supabase, taskId, null, "pending");
  revalidatePath(`/tasks/${taskId}`);
  revalidateTaskViews();
  return {};
}

export async function setApproval(
  taskId: string,
  decision: "approved" | "changes_requested",
): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };
  // Only admins/users approve (reviewers).
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (me?.role !== "admin" && me?.role !== "user")
    return { error: "Only admins and users can review approvals." };

  const { error } = await supabase
    .from("tasks")
    .update({
      approval_status: decision,
      approval_by: user.id,
      approval_at: new Date().toISOString(),
    })
    .eq("id", taskId);
  if (error) return { error: error.message };
  await logActivity(supabase, {
    taskId,
    type: "approval",
    summary: decision === "approved" ? "approved this task" : "requested changes",
  });
  await notifyApproval(supabase, taskId, user.id, decision);
  revalidatePath(`/tasks/${taskId}`);
  revalidateTaskViews();
  return {};
}

// ---------- Time tracking ----------
export async function addTimeEntry(input: {
  taskId: string;
  minutes: number;
  note: string | null;
  spentOn: string;
}): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };
  if (!(await canEditTaskServer(supabase, input.taskId)))
    return { error: "You can't log time on this task." };
  if (!input.minutes || input.minutes <= 0)
    return { error: "Enter a positive number of hours." };

  const { error } = await supabase.from("time_entries").insert({
    task_id: input.taskId,
    user_id: user.id,
    minutes: input.minutes,
    note: input.note,
    spent_on: input.spentOn,
  });
  if (error) return { error: error.message };
  await logActivity(supabase, {
    taskId: input.taskId,
    type: "time",
    summary: `logged ${(input.minutes / 60).toFixed(2)}h`,
  });
  revalidatePath(`/tasks/${input.taskId}`);
  revalidateTaskViews();
  return {};
}

export async function deleteTimeEntry(
  id: string,
  taskId: string,
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("time_entries").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/tasks/${taskId}`);
  revalidateTaskViews();
  return {};
}

// ---------- Task templates ----------
export async function createTemplate(input: {
  name: string;
  title: string;
  description: string | null;
  priority: Priority;
  team_id: string | null;
  estimate_minutes: number | null;
  items: string[];
}): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_templates")
    .insert({
      name: input.name,
      title: input.title,
      description: input.description,
      priority: input.priority,
      team_id: input.team_id,
      estimate_minutes: input.estimate_minutes,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  const items = input.items.filter((b) => b.trim());
  if (items.length > 0) {
    await supabase.from("template_checklist_items").insert(
      items.map((body, i) => ({ template_id: data.id, body, position: i })),
    );
  }
  revalidatePath("/admin");
  return {};
}

export async function deleteTemplate(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("task_templates").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin");
  return {};
}

// ---------- Admin: statuses ----------
export async function createStatus(input: {
  name: string;
  color: string;
  category: StatusCategory;
}): Promise<Result> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("statuses")
    .select("*", { count: "exact", head: true });
  const { error } = await supabase.from("statuses").insert({
    name: input.name,
    color: input.color,
    category: input.category,
    position: count ?? 0,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin");
  revalidateTaskViews();
  return {};
}

export async function updateStatus(
  id: string,
  input: { name: string; color: string; category: StatusCategory },
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("statuses")
    .update(input)
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin");
  revalidateTaskViews();
  return {};
}

export async function deleteStatus(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("statuses").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin");
  revalidateTaskViews();
  return {};
}

// ---------- Admin: teams ----------
// Teams run through the service role: a private team is hidden from admins by RLS,
// so the normal client can't read/insert/return it. All three are admin-guarded.
interface TeamInput {
  name: string;
  color: string;
  description: string | null;
  is_private: boolean;
  members: string[];
}

async function replaceTeamMembers(
  admin: ReturnType<typeof createAdminClient>,
  teamId: string,
  members: string[],
): Promise<void> {
  await admin.from("team_members").delete().eq("team_id", teamId);
  if (members.length > 0) {
    await admin
      .from("team_members")
      .insert(members.map((uid) => ({ team_id: teamId, user_id: uid })));
  }
}

export async function createTeam(input: TeamInput): Promise<Result> {
  const supabase = await createClient();
  const guard = await requireAdmin(supabase);
  if ("error" in guard) return guard;
  if (!isServiceRoleConfigured())
    return {
      error:
        "Team management isn't configured. Add SUPABASE_SERVICE_ROLE_KEY to the server environment.",
    };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("teams")
    .insert({
      name: input.name,
      color: input.color,
      description: input.description,
      is_private: input.is_private,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  await replaceTeamMembers(admin, data.id, input.is_private ? input.members : []);

  revalidatePath("/admin");
  revalidateTaskViews();
  return {};
}

export async function updateTeam(
  id: string,
  input: TeamInput,
): Promise<Result> {
  const supabase = await createClient();
  const guard = await requireAdmin(supabase);
  if ("error" in guard) return guard;
  if (!isServiceRoleConfigured())
    return {
      error:
        "Team management isn't configured. Add SUPABASE_SERVICE_ROLE_KEY to the server environment.",
    };

  const admin = createAdminClient();
  const { error } = await admin
    .from("teams")
    .update({
      name: input.name,
      color: input.color,
      description: input.description,
      is_private: input.is_private,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  await replaceTeamMembers(admin, id, input.is_private ? input.members : []);

  revalidatePath("/admin");
  revalidateTaskViews();
  return {};
}

export async function deleteTeam(id: string): Promise<Result> {
  const supabase = await createClient();
  const guard = await requireAdmin(supabase);
  if ("error" in guard) return guard;
  if (!isServiceRoleConfigured())
    return {
      error:
        "Team management isn't configured. Add SUPABASE_SERVICE_ROLE_KEY to the server environment.",
    };

  const admin = createAdminClient();
  const { error } = await admin.from("teams").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin");
  revalidateTaskViews();
  return {};
}

// ---------- Admin: roles ----------
export async function setUserRole(
  userId: string,
  role: Role,
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/admin");
  return {};
}

/** Set (or clear, with null) a member's display color. Admins only. */
export async function setUserColor(
  userId: string,
  color: string | null,
): Promise<Result> {
  const supabase = await createClient();
  const guard = await requireAdmin(supabase);
  if ("error" in guard) return guard;

  const { error } = await supabase
    .from("profiles")
    .update({ color })
    .eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidateTaskViews();
  return {};
}

// ---------- Reorder subtasks in an epic's pipeline (admin) ----------
export async function reorderSubtasks(
  parentId: string,
  orderedIds: string[],
): Promise<Result> {
  const supabase = await createClient();
  const guard = await requireAdmin(supabase);
  if ("error" in guard) return guard;

  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("tasks")
      .update({ position: i })
      .eq("id", orderedIds[i])
      .eq("parent_id", parentId);
    if (error) return { error: error.message };
  }

  revalidatePath(`/tasks/${parentId}`);
  revalidateTaskViews();
  return {};
}

// ---------- Super-admins (multiple allowed; can't remove the last one) ----------
/** Grant super-admin to another member. Only a super-admin may. */
export async function grantSuperadmin(userId: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };
  const { data: me } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .single();
  if (!me?.is_superadmin)
    return { error: "Only a super-admin can grant this." };

  const { error } = await supabase
    .from("profiles")
    .update({ is_superadmin: true })
    .eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/admin");
  revalidateTaskViews();
  return {};
}

/** Revoke super-admin. Only a super-admin may, and never the last one. */
export async function revokeSuperadmin(userId: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };
  const { data: me } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .single();
  if (!me?.is_superadmin)
    return { error: "Only a super-admin can do this." };

  const { count } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("is_superadmin", true);
  if ((count ?? 0) <= 1)
    return { error: "There must always be at least one super-admin." };

  const { error } = await supabase
    .from("profiles")
    .update({ is_superadmin: false })
    .eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/admin");
  revalidateTaskViews();
  return {};
}

/**
 * Add a member who can be assigned tasks but has NO app access: a credential-less
 * auth user (random password, never shared, no invite). The handle_new_user
 * trigger creates their profile; we then flag it as a placeholder and silence
 * notifications. Super-admin only.
 */
export async function createMember(input: {
  fullName: string;
  email?: string | null;
}): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };
  const { data: me } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .single();
  if (!me?.is_superadmin)
    return { error: "Only the super-admin can add members." };

  const fullName = input.fullName.trim();
  if (!fullName) return { error: "Name is required." };
  if (!isServiceRoleConfigured())
    return {
      error:
        "Adding members isn't configured. Add SUPABASE_SERVICE_ROLE_KEY to the server environment.",
    };

  const email =
    input.email?.trim() ||
    `placeholder.${crypto.randomUUID()}@no-login.teamflow.local`;
  const password = crypto.randomUUID() + crypto.randomUUID(); // never shared

  const admin = createAdminClient();
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) return { error: error.message };

  // Flag the trigger-created profile as a no-access placeholder.
  if (created.user) {
    await admin
      .from("profiles")
      .update({
        full_name: fullName,
        is_placeholder: true,
        email_notifications: false,
      })
      .eq("id", created.user.id);
  }

  revalidatePath("/admin");
  revalidateTaskViews();
  return {};
}

/**
 * Convert a no-access placeholder into a real login user — on the SAME account, so
 * all their existing task assignments/watchers/history are preserved. Sets a real
 * email + password, a role, clears the placeholder flag, and re-enables emails.
 * Super-admin only.
 */
export async function grantAccess(input: {
  userId: string;
  email: string;
  password: string;
  role: Role;
}): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };
  const { data: me } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .single();
  if (!me?.is_superadmin)
    return { error: "Only the super-admin can grant access." };

  const email = input.email.trim();
  if (!email) return { error: "An email is required so they can sign in." };
  if (input.password.length < 6)
    return { error: "Password must be at least 6 characters." };
  if (!isServiceRoleConfigured())
    return {
      error:
        "User management isn't configured. Add SUPABASE_SERVICE_ROLE_KEY to the server environment.",
    };

  const admin = createAdminClient();
  // Set a real email + password on the existing auth user (same id).
  const { error: authErr } = await admin.auth.admin.updateUserById(input.userId, {
    email,
    password: input.password,
    email_confirm: true,
  });
  if (authErr) return { error: authErr.message };

  const { error: profErr } = await admin
    .from("profiles")
    .update({
      email,
      role: input.role,
      is_placeholder: false,
      email_notifications: true,
    })
    .eq("id", input.userId);
  if (profErr) return { error: profErr.message };

  revalidatePath("/admin");
  revalidateTaskViews();
  return {};
}

// ---------- Admin: privileged user management (service role) ----------
/** Change a user's login email (and their profile email). Admins only. */
export async function setUserEmail(
  userId: string,
  email: string,
): Promise<Result> {
  const supabase = await createClient();
  const guard = await requireAdmin(supabase);
  if ("error" in guard) return guard;
  const trimmed = email.trim();
  if (!trimmed) return { error: "An email is required." };
  if (!isServiceRoleConfigured())
    return {
      error:
        "User management isn't configured. Add SUPABASE_SERVICE_ROLE_KEY to the server environment.",
    };

  const admin = createAdminClient();
  const { error: authErr } = await admin.auth.admin.updateUserById(userId, {
    email: trimmed,
    email_confirm: true,
  });
  if (authErr) return { error: authErr.message };

  const { error: profErr } = await admin
    .from("profiles")
    .update({ email: trimmed })
    .eq("id", userId);
  if (profErr) return { error: profErr.message };

  revalidatePath("/admin");
  revalidateTaskViews();
  return {};
}

export async function deleteUser(userId: string): Promise<Result> {
  const supabase = await createClient();
  const guard = await requireAdmin(supabase);
  if ("error" in guard) return guard;
  if (guard.userId === userId)
    return { error: "You can't delete your own account." };
  if (!isServiceRoleConfigured())
    return {
      error:
        "User management isn't configured. Add SUPABASE_SERVICE_ROLE_KEY to the server environment.",
    };

  // Deleting the auth user cascades to their profile and related data.
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };

  revalidatePath("/admin");
  return {};
}

export async function setUserPassword(
  userId: string,
  password: string,
): Promise<Result> {
  const supabase = await createClient();
  const guard = await requireAdmin(supabase);
  if ("error" in guard) return guard;
  if (password.length < 6)
    return { error: "Password must be at least 6 characters." };
  if (!isServiceRoleConfigured())
    return {
      error:
        "User management isn't configured. Add SUPABASE_SERVICE_ROLE_KEY to the server environment.",
    };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return { error: error.message };
  return {};
}

// ---------- Self: notification preferences ----------
export async function setEmailNotifications(enabled: boolean): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("profiles")
    .update({ email_notifications: enabled })
    .eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return {};
}
