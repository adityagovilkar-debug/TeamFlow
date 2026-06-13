export type Role = "admin" | "user" | "viewer";
export type Priority = "low" | "medium" | "high" | "urgent";
export type StatusCategory = "todo" | "in_progress" | "done";

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
  created_at: string;
  author?: Profile | null;
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
  created_by: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

/** Task joined with its related entities for display. */
export interface TaskWithRelations extends Task {
  status: Status | null;
  team: Team | null;
  assignee: Profile | null;
  watchers: Profile[];
  comment_count?: number;
}

export const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: "low", label: "Low", color: "var(--priority-low)" },
  { value: "medium", label: "Medium", color: "var(--priority-medium)" },
  { value: "high", label: "High", color: "var(--priority-high)" },
  { value: "urgent", label: "Urgent", color: "var(--priority-urgent)" },
];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  user: "User",
  viewer: "Viewer",
};

export function canWrite(role: Role | undefined | null): boolean {
  return role === "admin" || role === "user";
}

export function isAdmin(role: Role | undefined | null): boolean {
  return role === "admin";
}
