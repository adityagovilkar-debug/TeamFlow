"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  ListChecks,
  MoreHorizontal,
  Pencil,
  Trash2,
  MessageSquare,
  Eye,
  CalendarClock,
  GitBranch,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Avatar } from "@/components/ui/avatar";
import { Popover, MenuItem } from "@/components/ui/popover";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { PriorityBadge, StatusBadge } from "@/components/task-badges";
import { TaskDialog } from "@/components/task-dialog";
import { ConfirmDelete } from "@/components/confirm-delete";
import { deleteTask } from "@/lib/actions";
import { useRealtime } from "@/lib/use-realtime";
import { dueLabel, isOverdue } from "@/lib/date";
import { cn } from "@/lib/utils";
import {
  PRIORITIES,
  canWrite,
  computeBlocked,
  isAdmin,
  type Priority,
  type Profile,
  type Role,
  type SiblingForBlocking,
  type Status,
  type TaskWithRelations,
  type Team,
} from "@/lib/types";

export function TasksView({
  role,
  tasks,
  statuses,
  teams,
  profiles,
}: {
  role: Role;
  tasks: TaskWithRelations[];
  statuses: Status[];
  teams: Team[];
  profiles: Profile[];
}) {
  const router = useRouter();
  useRealtime(["tasks", "comments", "task_watchers"]);

  const [q, setQ] = React.useState("");
  const [statusF, setStatusF] = React.useState("");
  const [teamF, setTeamF] = React.useState("");
  const [assigneeF, setAssigneeF] = React.useState("");
  const [priorityF, setPriorityF] = React.useState("");
  const [overdueOnly, setOverdueOnly] = React.useState(false);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<TaskWithRelations | null>(null);
  const [deleting, setDeleting] = React.useState<TaskWithRelations | null>(null);

  const writable = canWrite(role);
  const admin = isAdmin(role);

  // Epic/subtask relationships, computed from the full task set.
  const childCount = new Map<string, number>();
  const siblingsByParent = new Map<string, SiblingForBlocking[]>();
  for (const t of tasks) {
    if (!t.parent_id) continue;
    childCount.set(t.parent_id, (childCount.get(t.parent_id) ?? 0) + 1);
    const arr = siblingsByParent.get(t.parent_id) ?? [];
    arr.push({
      id: t.id,
      title: t.title,
      position: t.position,
      category: t.status?.category ?? null,
    });
    siblingsByParent.set(t.parent_id, arr);
  }
  const isBlocked = (t: TaskWithRelations) =>
    t.parent_id
      ? computeBlocked(t.id, t.position, siblingsByParent.get(t.parent_id) ?? [])
          .blocked
      : false;

  const filtered = tasks.filter((t) => {
    if (q && !t.title.toLowerCase().includes(q.toLowerCase())) return false;
    if (statusF && t.status_id !== statusF) return false;
    if (teamF && t.team_id !== teamF) return false;
    if (assigneeF === "unassigned" && t.assignee_id) return false;
    if (assigneeF && assigneeF !== "unassigned" && t.assignee_id !== assigneeF)
      return false;
    if (priorityF && t.priority !== priorityF) return false;
    if (
      overdueOnly &&
      !isOverdue(t.due_date, t.status?.category === "done")
    )
      return false;
    return true;
  });

  const hasFilters =
    q || statusF || teamF || assigneeF || priorityF || overdueOnly;

  return (
    <div>
      <PageHeader
        title="Tasks"
        description={`${tasks.length} task${tasks.length === 1 ? "" : "s"} across your team`}
      >
        {writable && (
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" />
            New task
          </Button>
        )}
      </PageHeader>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tasks…"
            className="pl-9"
          />
        </div>
        <Select
          value={statusF}
          onChange={(e) => setStatusF(e.target.value)}
          className="w-auto min-w-32"
        >
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Select
          value={teamF}
          onChange={(e) => setTeamF(e.target.value)}
          className="w-auto min-w-32"
        >
          <option value="">All teams</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
        <Select
          value={assigneeF}
          onChange={(e) => setAssigneeF(e.target.value)}
          className="w-auto min-w-32"
        >
          <option value="">All assignees</option>
          <option value="unassigned">Unassigned</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name || p.email}
            </option>
          ))}
        </Select>
        <Select
          value={priorityF}
          onChange={(e) => setPriorityF(e.target.value)}
          className="w-auto min-w-28"
        >
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>
        <Button
          variant={overdueOnly ? "default" : "secondary"}
          size="sm"
          onClick={() => setOverdueOnly((v) => !v)}
        >
          <CalendarClock className="size-4" />
          Overdue
        </Button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title={hasFilters ? "No matching tasks" : "No tasks yet"}
          description={
            hasFilters
              ? "Try clearing some filters."
              : writable
                ? "Create your first task to get started."
                : "Tasks created by your team will show up here."
          }
        >
          {writable && !hasFilters && (
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              New task
            </Button>
          )}
        </EmptyState>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                  <th className="px-4 py-3">Task</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Team</th>
                  <th className="px-4 py-3">Assignee</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const done = t.status?.category === "done";
                  const due = dueLabel(t.due_date);
                  const overdue = isOverdue(t.due_date, done);
                  return (
                    <tr
                      key={t.id}
                      className="group border-b border-border last:border-0 hover:bg-muted/40 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/tasks/${t.id}`}
                          className="font-medium hover:text-primary"
                        >
                          {t.title}
                        </Link>
                        <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                          {childCount.has(t.id) && (
                            <span className="flex items-center gap-1 font-medium text-primary">
                              <GitBranch className="size-3" />
                              Epic · {childCount.get(t.id)}
                            </span>
                          )}
                          {isBlocked(t) && (
                            <span className="flex items-center gap-1 text-warning">
                              <Lock className="size-3" />
                              Locked
                            </span>
                          )}
                          {t.watchers.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Eye className="size-3" />
                              {t.watchers.length}
                            </span>
                          )}
                          {(t.comment_count ?? 0) > 0 && (
                            <span className="flex items-center gap-1">
                              <MessageSquare className="size-3" />
                              {t.comment_count}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="px-4 py-3">
                        <PriorityBadge priority={t.priority as Priority} />
                      </td>
                      <td className="px-4 py-3">
                        {t.team ? (
                          <span className="inline-flex items-center gap-1.5 text-sm">
                            <span
                              className="size-2 rounded-full"
                              style={{ backgroundColor: t.team.color }}
                            />
                            {t.team.name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {t.assignee ? (
                          <span className="inline-flex items-center gap-2">
                            <Avatar
                              name={t.assignee.full_name}
                              email={t.assignee.email}
                              size={24}
                            />
                            <span className="truncate max-w-28">
                              {t.assignee.full_name || t.assignee.email}
                            </span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "text-sm",
                            overdue
                              ? "font-medium text-destructive"
                              : due.tone === "soon"
                                ? "text-warning"
                                : "text-muted-foreground",
                          )}
                        >
                          {due.text}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {writable && (
                          <Popover
                            align="end"
                            trigger={
                              <button className="rounded-md p-1.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted cursor-pointer">
                                <MoreHorizontal className="size-4" />
                              </button>
                            }
                          >
                            {(close) => (
                              <>
                                <MenuItem
                                  onClick={() => {
                                    close();
                                    setEditing(t);
                                    setDialogOpen(true);
                                  }}
                                >
                                  <Pencil /> Edit
                                </MenuItem>
                                {admin && (
                                  <MenuItem
                                    destructive
                                    onClick={() => {
                                      close();
                                      setDeleting(t);
                                    }}
                                  >
                                    <Trash2 /> Delete
                                  </MenuItem>
                                )}
                              </>
                            )}
                          </Popover>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {writable && (
        <TaskDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          statuses={statuses}
          teams={teams}
          profiles={profiles}
          task={editing}
        />
      )}

      {admin && (
        <ConfirmDelete
          open={Boolean(deleting)}
          onClose={() => setDeleting(null)}
          title="Delete task"
          description={`Permanently delete "${deleting?.title}"? This also removes its comments and watchers.`}
          onConfirm={async () => {
            if (!deleting) return;
            await deleteTask(deleting.id);
            setDeleting(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
