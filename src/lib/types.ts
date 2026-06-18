export type Role = "admin" | "user" | "contributor" | "viewer";
export type Priority = "low" | "medium" | "high" | "urgent";
export type StatusCategory = "todo" | "in_progress" | "done";
export type ApprovalStatus =
  | "none"
  | "pending"
  | "approved"
  | "changes_requested";
export type Recurrence = "none" | "daily" | "weekly" | "monthly";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  avatar_url: string | null;
  email_notifications: boolean;
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  color: string;
  description: string | null;
  created_at: string;
}

export interface Status {
  id: string;
  name: string;
  color: string;
  position: number;
  category: StatusCategory;
  is_default: boolean;
  created_at: string;
}

export interface Comment {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  parent_id: string | null;
  created_at: string;
  author?: Profile | null;
}

/** A top-level comment with its (one level of) replies, for threaded display. */
export interface CommentThread extends Comment {
  replies: Comment[];
}

export interface ChecklistItem {
  id: string;
  task_id: string;
  body: string;
  is_done: boolean;
  position: number;
  created_at: string;
}

export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  color: string;
  position: number;
  created_at: string;
}

/** A folder with its nested children, for tree display. */
export interface FolderNode extends Folder {
  children: FolderNode[];
  depth: number;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: Priority;
  status_id: string | null;
  team_id: string | null;
  assignee_id: string | null;
  due_date: string | null;
  start_date: string | null;
  parent_id: string | null;
  folder_id: string | null;
  position: number;
  archived_at: string | null;
  estimate_minutes: number | null;
  recurrence: Recurrence;
  approval_status: ApprovalStatus;
  approval_by: string | null;
  approval_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface Label {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface TimeEntry {
  id: string;
  task_id: string;
  user_id: string;
  minutes: number;
  note: string | null;
  spent_on: string;
  created_at: string;
  user?: Profile | null;
}

export interface ActivityEntry {
  id: string;
  task_id: string | null;
  actor_id: string | null;
  type: string;
  summary: string;
  created_at: string;
  actor?: Profile | null;
  task?: { id: string; title: string } | null;
}

export interface TemplateChecklistItem {
  id: string;
  template_id: string;
  body: string;
  position: number;
}

export interface TaskTemplate {
  id: string;
  name: string;
  title: string;
  description: string | null;
  priority: Priority;
  team_id: string | null;
  estimate_minutes: number | null;
  created_at: string;
  items?: TemplateChecklistItem[];
}

/** Task joined with its related entities for display. */
export interface TaskWithRelations extends Task {
  status: Status | null;
  team: Team | null;
  assignee: Profile | null;
  approver?: Profile | null;
  watchers: Profile[];
  labels: Label[];
  comment_count?: number;
  checklist_done?: number;
  checklist_total?: number;
  time_logged_minutes?: number;
}

/** A subtask in an epic's pipeline, with its computed lock state. */
export interface Subtask extends TaskWithRelations {
  blocked: boolean;
  blockedBy: string | null; // title of the predecessor that blocks it
}

/** Minimal shape needed to decide if a subtask is blocked by predecessors. */
export interface SiblingForBlocking {
  id: string;
  title: string;
  position: number;
  category: StatusCategory | null;
}

/**
 * A subtask is blocked if any earlier sibling (lower position) is not yet in a
 * "done" status. Returns the blocking predecessor's title, if any.
 */
export function computeBlocked(
  taskId: string,
  position: number,
  siblings: SiblingForBlocking[],
): { blocked: boolean; blockedBy: string | null } {
  const predecessors = siblings
    .filter((s) => s.id !== taskId && s.position < position)
    .sort((a, b) => a.position - b.position);
  const blocker = predecessors.find((p) => p.category !== "done");
  return blocker
    ? { blocked: true, blockedBy: blocker.title }
    : { blocked: false, blockedBy: null };
}

export const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: "low", label: "Low", color: "var(--priority-low)" },
  { value: "medium", label: "Medium", color: "var(--priority-medium)" },
  { value: "high", label: "High", color: "var(--priority-high)" },
  { value: "urgent", label: "Urgent", color: "var(--priority-urgent)" },
];

export const RECURRENCE_OPTIONS: { value: Recurrence; label: string }[] = [
  { value: "none", label: "Does not repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

export const APPROVAL_LABELS: Record<ApprovalStatus, string> = {
  none: "Not requested",
  pending: "Pending approval",
  approved: "Approved",
  changes_requested: "Changes requested",
};

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  user: "User",
  contributor: "Contributor",
  viewer: "Viewer",
};

/** Can create new tasks (and edit any task). Admins and Users. */
export function canWrite(role: Role | undefined | null): boolean {
  return role === "admin" || role === "user";
}

export function isAdmin(role: Role | undefined | null): boolean {
  return role === "admin";
}

/**
 * Can this user edit/comment on a specific task?
 * - admin/user: any task
 * - contributor: only tasks assigned to them
 * - viewer: none
 */
export function canEditTask(
  role: Role | undefined | null,
  task: { assignee_id: string | null },
  userId: string | undefined | null,
): boolean {
  if (canWrite(role)) return true;
  if (role === "contributor")
    return Boolean(userId) && task.assignee_id === userId;
  return false;
}

/**
 * Turn a flat folder list into a nested tree, sorted by position then name and
 * annotated with depth (root folders are depth 0). Orphans (missing parent)
 * surface at the root so nothing is hidden.
 */
export function buildFolderTree(folders: Folder[]): FolderNode[] {
  const byId = new Map<string, FolderNode>();
  for (const f of folders) byId.set(f.id, { ...f, children: [], depth: 0 });

  const roots: FolderNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parent_id ? byId.get(node.parent_id) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const sortRec = (nodes: FolderNode[], depth: number) => {
    nodes.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
    for (const n of nodes) {
      n.depth = depth;
      sortRec(n.children, depth + 1);
    }
  };
  sortRec(roots, 0);
  return roots;
}

/** Flatten a folder tree to a list (pre-order), useful for rendering rows. */
export function flattenFolderTree(nodes: FolderNode[]): FolderNode[] {
  const out: FolderNode[] = [];
  const walk = (ns: FolderNode[]) => {
    for (const n of ns) {
      out.push(n);
      walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

/** All descendant folder ids of a folder (inclusive), for "filter by folder". */
export function folderWithDescendants(
  folderId: string,
  folders: Folder[],
): Set<string> {
  const childrenOf = new Map<string, string[]>();
  for (const f of folders) {
    if (!f.parent_id) continue;
    const arr = childrenOf.get(f.parent_id) ?? [];
    arr.push(f.id);
    childrenOf.set(f.parent_id, arr);
  }
  const ids = new Set<string>();
  const walk = (id: string) => {
    ids.add(id);
    for (const c of childrenOf.get(id) ?? []) walk(c);
  };
  walk(folderId);
  return ids;
}
