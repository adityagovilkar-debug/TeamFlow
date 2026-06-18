import { createClient } from "@/lib/supabase/server";
import {
  computeBlocked,
  type ActivityEntry,
  type ChecklistItem,
  type Comment,
  type CommentThread,
  type Folder,
  type Label,
  type Profile,
  type SiblingForBlocking,
  type Status,
  type Subtask,
  type Task,
  type TaskTemplate,
  type TaskWithRelations,
  type Team,
  type TimeEntry,
} from "@/lib/types";

export async function getStatuses(): Promise<Status[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("statuses")
    .select("*")
    .order("position", { ascending: true });
  return (data as Status[]) ?? [];
}

export async function getTeams(): Promise<Team[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("teams")
    .select("*")
    .order("name", { ascending: true });
  return (data as Team[]) ?? [];
}

export async function getProfiles(): Promise<Profile[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .order("full_name", { ascending: true });
  return (data as Profile[]) ?? [];
}

const TASK_SELECT = `
  *,
  status:statuses(*),
  team:teams(*),
  assignee:assignee_id(*),
  approver:approval_by(*),
  watchers:task_watchers(profile:profiles(*)),
  labels:task_labels(label:labels(*)),
  comment_count:comments(count),
  checklist:checklist_items(is_done),
  time:time_entries(minutes)
`;

type RawTask = Task & {
  status: Status | null;
  team: Team | null;
  assignee: Profile | null;
  approver: Profile | null;
  watchers: { profile: Profile }[] | null;
  labels: { label: Label }[] | null;
  comment_count: { count: number }[] | null;
  checklist: { is_done: boolean }[] | null;
  time: { minutes: number }[] | null;
};

function shapeTask(raw: RawTask): TaskWithRelations {
  const checklist = raw.checklist ?? [];
  return {
    ...raw,
    status: raw.status ?? null,
    team: raw.team ?? null,
    assignee: raw.assignee ?? null,
    approver: raw.approver ?? null,
    watchers: (raw.watchers ?? []).map((w) => w.profile).filter(Boolean),
    labels: (raw.labels ?? []).map((l) => l.label).filter(Boolean),
    comment_count: raw.comment_count?.[0]?.count ?? 0,
    checklist_total: checklist.length,
    checklist_done: checklist.filter((c) => c.is_done).length,
    time_logged_minutes: (raw.time ?? []).reduce((n, t) => n + (t.minutes || 0), 0),
  };
}

/**
 * All tasks for the active views. Archived tasks are excluded by default; pass
 * `onlyArchived` for the Tasks → Archived view (or `includeArchived` for both).
 */
export async function getTasks(opts?: {
  includeArchived?: boolean;
  onlyArchived?: boolean;
}): Promise<TaskWithRelations[]> {
  const supabase = await createClient();
  let query = supabase
    .from("tasks")
    .select(TASK_SELECT)
    .order("created_at", { ascending: false });

  if (opts?.onlyArchived) query = query.not("archived_at", "is", null);
  else if (!opts?.includeArchived) query = query.is("archived_at", null);

  const { data } = await query;
  return ((data as RawTask[]) ?? []).map(shapeTask);
}

export async function getTaskById(
  id: string,
): Promise<TaskWithRelations | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("id", id)
    .single();
  return data ? shapeTask(data as RawTask) : null;
}

/** Ordered subtasks of an epic, each with its computed lock state. */
export async function getSubtasks(parentId: string): Promise<Subtask[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("parent_id", parentId)
    .order("position", { ascending: true });

  const tasks = ((data as RawTask[]) ?? []).map(shapeTask);
  const siblings: SiblingForBlocking[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    position: t.position,
    category: t.status?.category ?? null,
  }));

  return tasks.map((t) => ({
    ...t,
    ...computeBlocked(t.id, t.position, siblings),
  }));
}

/** Minimal parent (epic) info for a subtask's breadcrumb link. */
export async function getParentSummary(
  parentId: string,
): Promise<{ id: string; title: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select("id, title")
    .eq("id", parentId)
    .single();
  return (data as { id: string; title: string }) ?? null;
}

/**
 * Comments for a task, nested one level deep: top-level comments each carry
 * their replies (a reply-to-a-reply is attached to the same root thread).
 */
export async function getComments(taskId: string): Promise<CommentThread[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("comments")
    .select("*, author:profiles(*)")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  const all = (data as Comment[]) ?? [];
  const roots = new Map<string, CommentThread>();
  for (const c of all) {
    if (!c.parent_id) roots.set(c.id, { ...c, replies: [] });
  }
  for (const c of all) {
    if (!c.parent_id) continue;
    // Attach to the parent if it's a root; otherwise hoist to the grandparent
    // root so deeply-nested replies still appear in their thread.
    let root = roots.get(c.parent_id);
    if (!root) {
      const parent = all.find((p) => p.id === c.parent_id);
      if (parent?.parent_id) root = roots.get(parent.parent_id);
    }
    if (root) root.replies.push(c);
  }
  return [...roots.values()];
}

export async function getChecklist(taskId: string): Promise<ChecklistItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("checklist_items")
    .select("*")
    .eq("task_id", taskId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  return (data as ChecklistItem[]) ?? [];
}

export async function getFolders(): Promise<Folder[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("folders")
    .select("*")
    .order("position", { ascending: true })
    .order("name", { ascending: true });
  return (data as Folder[]) ?? [];
}

export async function getLabels(): Promise<Label[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("labels")
    .select("*")
    .order("name", { ascending: true });
  return (data as Label[]) ?? [];
}

export async function getTimeEntries(taskId: string): Promise<TimeEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("time_entries")
    .select("*, user:profiles(*)")
    .eq("task_id", taskId)
    .order("spent_on", { ascending: false })
    .order("created_at", { ascending: false });
  return (data as TimeEntry[]) ?? [];
}

/** Activity feed. Pass a taskId for one task's timeline, or omit for the global feed. */
export async function getActivity(
  taskId?: string,
  limit = 50,
): Promise<ActivityEntry[]> {
  const supabase = await createClient();
  let query = supabase
    .from("activity")
    .select("*, actor:actor_id(*), task:task_id(id, title)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (taskId) query = query.eq("task_id", taskId);
  const { data } = await query;
  return (data as ActivityEntry[]) ?? [];
}

export async function getTemplates(): Promise<TaskTemplate[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("task_templates")
    .select("*, items:template_checklist_items(*)")
    .order("name", { ascending: true });
  return ((data as TaskTemplate[]) ?? []).map((t) => ({
    ...t,
    items: (t.items ?? []).sort((a, b) => a.position - b.position),
  }));
}
