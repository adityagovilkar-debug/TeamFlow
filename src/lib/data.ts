import { createClient } from "@/lib/supabase/server";
import {
  computeBlocked,
  type Comment,
  type Profile,
  type SiblingForBlocking,
  type Status,
  type Subtask,
  type Task,
  type TaskWithRelations,
  type Team,
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
  watchers:task_watchers(profile:profiles(*)),
  comment_count:comments(count)
`;

type RawTask = Task & {
  status: Status | null;
  team: Team | null;
  assignee: Profile | null;
  watchers: { profile: Profile }[] | null;
  comment_count: { count: number }[] | null;
};

function shapeTask(raw: RawTask): TaskWithRelations {
  return {
    ...raw,
    status: raw.status ?? null,
    team: raw.team ?? null,
    assignee: raw.assignee ?? null,
    watchers: (raw.watchers ?? []).map((w) => w.profile).filter(Boolean),
    comment_count: raw.comment_count?.[0]?.count ?? 0,
  };
}

export async function getTasks(): Promise<TaskWithRelations[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .order("created_at", { ascending: false });
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

export async function getComments(taskId: string): Promise<Comment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("comments")
    .select("*, author:profiles(*)")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  return (data as Comment[]) ?? [];
}
