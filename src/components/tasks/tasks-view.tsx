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
  CheckSquare,
  Archive,
  ArchiveRestore,
  FolderClosed,
  FolderPlus,
  Folders,
  Loader2,
  LayoutDashboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Avatar } from "@/components/ui/avatar";
import { Popover, MenuItem } from "@/components/ui/popover";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import {
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { PriorityBadge, StatusBadge } from "@/components/task-badges";
import { TaskDialog } from "@/components/task-dialog";
import { ConfirmDelete } from "@/components/confirm-delete";
import {
  archiveTask,
  createFolder,
  deleteFolder,
  deleteTask,
  renameFolder,
  unarchiveTask,
} from "@/lib/actions";
import { useRealtime } from "@/lib/use-realtime";
import { dueLabel, isOverdue } from "@/lib/date";
import { cn } from "@/lib/utils";
import {
  PRIORITIES,
  buildFolderTree,
  canEditTask,
  canWrite,
  computeBlocked,
  flattenFolderTree,
  folderWithDescendants,
  isAdmin,
  type Folder,
  type FolderNode,
  type Label as LabelType,
  type Priority,
  type Profile,
  type Role,
  type SiblingForBlocking,
  type Status,
  type TaskTemplate,
  type TaskWithRelations,
  type Team,
} from "@/lib/types";

export function TasksView({
  role,
  meId,
  tasks,
  statuses,
  teams,
  profiles,
  folders,
  labels,
  templates,
}: {
  role: Role;
  meId: string;
  tasks: TaskWithRelations[];
  statuses: Status[];
  teams: Team[];
  profiles: Profile[];
  folders: Folder[];
  labels: LabelType[];
  templates: TaskTemplate[];
}) {
  const router = useRouter();
  useRealtime(["tasks", "comments", "task_watchers", "checklist_items", "folders"]);

  const [q, setQ] = React.useState("");
  const [statusF, setStatusF] = React.useState("");
  const [teamF, setTeamF] = React.useState("");
  const [assigneeF, setAssigneeF] = React.useState("");
  const [priorityF, setPriorityF] = React.useState("");
  const [labelF, setLabelF] = React.useState("");
  const [overdueOnly, setOverdueOnly] = React.useState(false);
  const [view, setView] = React.useState<"active" | "archived">("active");
  const [folderF, setFolderF] = React.useState<string | null>(null); // null=all, "none"=no folder

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<TaskWithRelations | null>(null);
  const [deleting, setDeleting] = React.useState<TaskWithRelations | null>(null);

  const writable = canWrite(role);
  const admin = isAdmin(role);

  const tree = React.useMemo(() => buildFolderTree(folders), [folders]);

  // Epic/subtask relationships, computed from the full task set.
  const childCount = new Map<string, number>();
  const doneCount = new Map<string, number>();
  const siblingsByParent = new Map<string, SiblingForBlocking[]>();
  for (const t of tasks) {
    if (!t.parent_id) continue;
    childCount.set(t.parent_id, (childCount.get(t.parent_id) ?? 0) + 1);
    if (t.status?.category === "done")
      doneCount.set(t.parent_id, (doneCount.get(t.parent_id) ?? 0) + 1);
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

  // Tasks in the current archive view, for folder counts.
  const inView = tasks.filter((t) =>
    view === "archived" ? t.archived_at : !t.archived_at,
  );
  const folderCount = (folderId: string) => {
    const ids = folderWithDescendants(folderId, folders);
    return inView.filter((t) => t.folder_id && ids.has(t.folder_id)).length;
  };
  const selectedFolderIds =
    folderF && folderF !== "none"
      ? folderWithDescendants(folderF, folders)
      : null;

  const filtered = inView.filter((t) => {
    if (folderF === "none" && t.folder_id) return false;
    if (selectedFolderIds && !(t.folder_id && selectedFolderIds.has(t.folder_id)))
      return false;
    if (q && !t.title.toLowerCase().includes(q.toLowerCase())) return false;
    if (statusF && t.status_id !== statusF) return false;
    if (teamF && t.team_id !== teamF) return false;
    if (assigneeF === "unassigned" && t.assignee_id) return false;
    if (assigneeF && assigneeF !== "unassigned" && t.assignee_id !== assigneeF)
      return false;
    if (priorityF && t.priority !== priorityF) return false;
    if (labelF && !t.labels.some((l) => l.id === labelF)) return false;
    if (overdueOnly && !isOverdue(t.due_date, t.status?.category === "done"))
      return false;
    return true;
  });

  const hasFilters =
    q || statusF || teamF || assigneeF || priorityF || labelF || overdueOnly || folderF;
  const activeCount = tasks.filter((t) => !t.archived_at).length;
  const archivedCount = tasks.filter((t) => t.archived_at).length;

  return (
    <div>
      <PageHeader
        title="Tasks"
        description={`${activeCount} active · ${archivedCount} archived`}
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

      <div className="flex flex-col gap-5 lg:flex-row">
        {/* Folder tree */}
        <FolderPanel
          tree={tree}
          selected={folderF}
          onSelect={setFolderF}
          counts={folderCount}
          totalCount={inView.length}
          noFolderCount={inView.filter((t) => !t.folder_id).length}
          writable={writable}
        />

        <div className="min-w-0 flex-1">
          {/* Active / Archived toggle */}
          <div className="mb-4 inline-flex rounded-lg border border-border bg-card p-0.5 text-sm">
            {(["active", "archived"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "rounded-md px-3 py-1 font-medium capitalize transition-colors cursor-pointer",
                  view === v
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {v} ({v === "active" ? activeCount : archivedCount})
              </button>
            ))}
          </div>

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
            {labels.length > 0 && (
              <Select
                value={labelF}
                onChange={(e) => setLabelF(e.target.value)}
                className="w-auto min-w-28"
              >
                <option value="">All labels</option>
                {labels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            )}
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
              icon={view === "archived" ? Archive : ListChecks}
              title={
                view === "archived"
                  ? "No archived tasks"
                  : hasFilters
                    ? "No matching tasks"
                    : "No tasks yet"
              }
              description={
                view === "archived"
                  ? "Tasks you archive will show up here."
                  : hasFilters
                    ? "Try clearing some filters."
                    : writable
                      ? "Create your first task to get started."
                      : "Tasks created by your team will show up here."
              }
            >
              {writable && !hasFilters && view === "active" && (
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
                      const canEditThis = canEditTask(role, t, meId);
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
                            <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              {childCount.has(t.id) && (
                                <span className="flex items-center gap-1.5 font-medium text-primary">
                                  <GitBranch className="size-3" />
                                  Epic · {doneCount.get(t.id) ?? 0}/
                                  {childCount.get(t.id)}
                                  <span className="inline-block h-1.5 w-12 overflow-hidden rounded-full bg-muted align-middle">
                                    <span
                                      className="block h-full rounded-full bg-success"
                                      style={{
                                        width: `${Math.round(
                                          ((doneCount.get(t.id) ?? 0) /
                                            (childCount.get(t.id) || 1)) *
                                            100,
                                        )}%`,
                                      }}
                                    />
                                  </span>
                                </span>
                              )}
                              {isBlocked(t) && (
                                <span className="flex items-center gap-1 text-warning">
                                  <Lock className="size-3" />
                                  Locked
                                </span>
                              )}
                              {(t.checklist_total ?? 0) > 0 && (
                                <span className="flex items-center gap-1">
                                  <CheckSquare className="size-3" />
                                  {t.checklist_done ?? 0}/{t.checklist_total}
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
                              {t.approval_status === "approved" && (
                                <span className="font-medium text-success">✓ Approved</span>
                              )}
                              {t.approval_status === "pending" && (
                                <span className="font-medium text-warning">⏳ Approval</span>
                              )}
                            </div>
                            {t.labels.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {t.labels.map((l) => (
                                  <span
                                    key={l.id}
                                    className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                                    style={{ backgroundColor: l.color }}
                                  >
                                    {l.name}
                                  </span>
                                ))}
                              </div>
                            )}
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
                            {(canEditThis || admin) && (
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
                                    {canEditThis && (
                                      <MenuItem
                                        onClick={() => {
                                          close();
                                          setEditing(t);
                                          setDialogOpen(true);
                                        }}
                                      >
                                        <Pencil /> Edit
                                      </MenuItem>
                                    )}
                                    {canEditThis && (
                                      <MenuItem
                                        onClick={async () => {
                                          close();
                                          if (t.archived_at)
                                            await unarchiveTask(t.id);
                                          else await archiveTask(t.id);
                                          router.refresh();
                                        }}
                                      >
                                        {t.archived_at ? (
                                          <>
                                            <ArchiveRestore /> Restore
                                          </>
                                        ) : (
                                          <>
                                            <Archive /> Archive
                                          </>
                                        )}
                                      </MenuItem>
                                    )}
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
        </div>
      </div>

      {(writable || role === "contributor") && (
        <TaskDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          statuses={statuses}
          teams={teams}
          profiles={profiles}
          folders={folders}
          labels={labels}
          templates={templates}
          task={editing}
          defaultFolderId={
            !editing && folderF && folderF !== "none" ? folderF : null
          }
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

function FolderPanel({
  tree,
  selected,
  onSelect,
  counts,
  totalCount,
  noFolderCount,
  writable,
}: {
  tree: FolderNode[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  counts: (folderId: string) => number;
  totalCount: number;
  noFolderCount: number;
  writable: boolean;
}) {
  const router = useRouter();
  // Folder add/rename dialog state.
  const [dialog, setDialog] = React.useState<{
    mode: "create-root" | "create-child" | "rename";
    folder?: FolderNode;
  } | null>(null);
  const [name, setName] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [confirmDel, setConfirmDel] = React.useState<FolderNode | null>(null);

  const rows = flattenFolderTree(tree);

  function openDialog(d: {
    mode: "create-root" | "create-child" | "rename";
    folder?: FolderNode;
  }) {
    setName(d.mode === "rename" ? (d.folder?.name ?? "") : "");
    setDialog(d);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !dialog) return;
    setSaving(true);
    if (dialog.mode === "rename" && dialog.folder)
      await renameFolder(dialog.folder.id, name.trim());
    else if (dialog.mode === "create-child" && dialog.folder)
      await createFolder(name.trim(), dialog.folder.id);
    else await createFolder(name.trim());
    setSaving(false);
    setDialog(null);
    router.refresh();
  }

  const itemCls = (active: boolean) =>
    cn(
      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors cursor-pointer",
      active
        ? "bg-accent text-accent-foreground font-medium"
        : "text-muted-foreground hover:bg-muted hover:text-foreground",
    );

  return (
    <aside className="lg:w-56 lg:shrink-0">
      <div className="rounded-xl border border-border bg-card p-2 shadow-sm">
        <div className="mb-1 flex items-center justify-between px-2 py-1">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Folders className="size-3.5" />
            Folders
          </span>
          {writable && (
            <button
              onClick={() => openDialog({ mode: "create-root" })}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
              title="New folder"
            >
              <FolderPlus className="size-4" />
            </button>
          )}
        </div>

        <button onClick={() => onSelect(null)} className={itemCls(selected === null)}>
          <ListChecks className="size-4" />
          <span className="flex-1">All tasks</span>
          <span className="text-xs">{totalCount}</span>
        </button>

        <div className="my-1 max-h-[60vh] space-y-0.5 overflow-y-auto">
          {rows.map((f) => (
            <div
              key={f.id}
              className="group flex items-center"
              style={{ paddingLeft: `${f.depth * 12}px` }}
            >
              <button
                onClick={() => onSelect(f.id)}
                className={itemCls(selected === f.id)}
              >
                <FolderClosed
                  className="size-4 shrink-0"
                  style={{ color: f.color }}
                />
                <span className="flex-1 truncate">{f.name}</span>
                <span className="text-xs">{counts(f.id)}</span>
              </button>
              <Link
                href={`/folders/${f.id}`}
                className="rounded p-1 text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground group-hover:opacity-100"
                title="Open folder dashboard"
              >
                <LayoutDashboard className="size-3.5" />
              </Link>
              {writable && (
                <Popover
                  align="end"
                  trigger={
                    <button className="rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted cursor-pointer">
                      <MoreHorizontal className="size-3.5" />
                    </button>
                  }
                >
                  {(close) => (
                    <>
                      <MenuItem
                        onClick={() => {
                          close();
                          openDialog({ mode: "create-child", folder: f });
                        }}
                      >
                        <FolderPlus /> Add subfolder
                      </MenuItem>
                      <MenuItem
                        onClick={() => {
                          close();
                          openDialog({ mode: "rename", folder: f });
                        }}
                      >
                        <Pencil /> Rename
                      </MenuItem>
                      <MenuItem
                        destructive
                        onClick={() => {
                          close();
                          setConfirmDel(f);
                        }}
                      >
                        <Trash2 /> Delete
                      </MenuItem>
                    </>
                  )}
                </Popover>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={() => onSelect("none")}
          className={itemCls(selected === "none")}
        >
          <FolderClosed className="size-4" />
          <span className="flex-1">No folder</span>
          <span className="text-xs">{noFolderCount}</span>
        </button>
      </div>

      <Dialog open={Boolean(dialog)} onClose={() => setDialog(null)} className="max-w-sm">
        <DialogHeader
          title={
            dialog?.mode === "rename"
              ? "Rename folder"
              : dialog?.mode === "create-child"
                ? `New subfolder in “${dialog.folder?.name}”`
                : "New folder"
          }
        />
        <form onSubmit={submit}>
          <DialogBody>
            <Label htmlFor="folder-name">Name</Label>
            <Input
              id="folder-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Corp"
              autoFocus
              required
            />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {dialog?.mode === "rename" ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      <ConfirmDelete
        open={Boolean(confirmDel)}
        onClose={() => setConfirmDel(null)}
        title="Delete folder"
        description={`Delete "${confirmDel?.name}"? Tasks inside move to “No folder” and any subfolders are deleted. Tasks themselves are not deleted.`}
        onConfirm={async () => {
          if (!confirmDel) return;
          await deleteFolder(confirmDel.id);
          if (selected === confirmDel.id) onSelect(null);
          setConfirmDel(null);
          router.refresh();
        }}
      />
    </aside>
  );
}
