"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import {
  notifyAssigned,
  notifyComment,
  notifyStatusChange,
  notifyWatching,
} from "@/lib/notify";
import type { Priority, Role, StatusCategory } from "@/lib/types";

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
  watchers: string[];
  parent_id?: string | null;
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
}

export async function createTask(input: TaskInput): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // Subtasks are appended to the end of their epic's pipeline.
  let position = 0;
  if (input.parent_id) {
    const { count } = await supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("parent_id", input.parent_id);
    position = count ?? 0;
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

  // Notify the new assignee and watchers (not the creator themselves).
  if (input.assignee_id) {
    await notifyAssigned(supabase, data.id, user.id, input.assignee_id);
  }
  await notifyWatching(supabase, data.id, user.id, input.watchers);

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
    .select("status_id, assignee_id")
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
    })
    .eq("id", id);

  if (error) return { error: error.message };

  // Reconcile watchers: clear then re-insert.
  await supabase.from("task_watchers").delete().eq("task_id", id);
  if (input.watchers.length > 0) {
    await supabase.from("task_watchers").insert(
      input.watchers.map((uid) => ({ task_id: id, user_id: uid })),
    );
  }

  // Notify on the events we care about: status change, new assignee, new watchers.
  if (input.status_id && input.status_id !== prior?.status_id) {
    await notifyStatusChange(
      supabase,
      id,
      user.id,
      await statusName(supabase, input.status_id),
    );
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
    await notifyStatusChange(
      supabase,
      id,
      user.id,
      await statusName(supabase, statusId),
    );
  }

  revalidateTaskViews();
  return {};
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
): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("comments")
    .insert({ task_id: taskId, author_id: user.id, body });
  if (error) return { error: error.message };

  await notifyComment(supabase, taskId, user.id, body);

  revalidatePath(`/tasks/${taskId}`);
  return {};
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
export async function createTeam(input: {
  name: string;
  color: string;
  description: string | null;
}): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("teams").insert(input);
  if (error) return { error: error.message };
  revalidatePath("/admin");
  revalidateTaskViews();
  return {};
}

export async function updateTeam(
  id: string,
  input: { name: string; color: string; description: string | null },
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("teams").update(input).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin");
  revalidateTaskViews();
  return {};
}

export async function deleteTeam(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("teams").delete().eq("id", id);
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

// ---------- Admin: privileged user management (service role) ----------
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
