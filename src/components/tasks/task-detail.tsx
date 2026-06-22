"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Send,
  Eye,
  CalendarDays,
  Loader2,
  Plus,
  Lock,
  CheckCircle2,
  GitBranch,
  ChevronRight,
  GripVertical,
  CheckSquare,
  Square,
  Reply,
  Archive,
  ArchiveRestore,
  FolderClosed,
  X,
  Clock,
  History,
  CheckCheck,
  ShieldQuestion,
  ThumbsUp,
  Undo2,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { PriorityBadge, StatusBadge } from "@/components/task-badges";
import { TaskDialog } from "@/components/task-dialog";
import { ConfirmDelete } from "@/components/confirm-delete";
import {
  addChecklistItem,
  addComment,
  addTimeEntry,
  archiveTask,
  deleteChecklistItem,
  deleteComment,
  deleteTask,
  deleteTimeEntry,
  reorderSubtasks,
  requestApproval,
  setApproval,
  toggleChecklistItem,
  unarchiveTask,
} from "@/lib/actions";
import { useRealtime } from "@/lib/use-realtime";
import { fmtDate, fmtDateTime, fmtHours, isOverdue } from "@/lib/date";
import { cn } from "@/lib/utils";
import {
  APPROVAL_LABELS,
  canEditTask,
  canWrite,
  isAdmin,
  type ActivityEntry,
  type ChecklistItem,
  type Comment,
  type CommentThread,
  type Folder,
  type Label,
  type Priority,
  type Profile,
  type Status,
  type Subtask,
  type TaskTemplate,
  type TaskWithRelations,
  type Team,
  type TimeEntry,
} from "@/lib/types";

export function TaskDetail({
  me,
  task,
  parent,
  subtasks,
  comments,
  checklist,
  statuses,
  teams,
  profiles,
  folders,
  labels,
  templates,
  timeEntries,
  activity,
}: {
  me: Profile;
  task: TaskWithRelations;
  parent: { id: string; title: string } | null;
  subtasks: Subtask[];
  comments: CommentThread[];
  checklist: ChecklistItem[];
  statuses: Status[];
  teams: Team[];
  profiles: Profile[];
  folders: Folder[];
  labels: Label[];
  templates: TaskTemplate[];
  timeEntries: TimeEntry[];
  activity: ActivityEntry[];
}) {
  const router = useRouter();
  useRealtime([
    "tasks",
    "comments",
    "task_watchers",
    "checklist_items",
    "time_entries",
    "activity",
    "task_labels",
  ]);

  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [subtaskOpen, setSubtaskOpen] = React.useState(false);
  const [body, setBody] = React.useState("");
  const [posting, setPosting] = React.useState(false);
  const [archiving, setArchiving] = React.useState(false);

  const writable = canWrite(me.role); // can create (e.g. add subtasks)
  const canEdit = canEditTask(me.role, task, me.id); // can edit/comment this task
  const admin = isAdmin(me.role);
  const done = task.status?.category === "done";
  const overdue = isOverdue(task.due_date, done);
  const archived = Boolean(task.archived_at);
  const folder = folders.find((f) => f.id === task.folder_id) ?? null;
  const commentCount = comments.reduce((n, c) => n + 1 + c.replies.length, 0);

  async function postComment(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setPosting(true);
    await addComment(task.id, body.trim());
    setBody("");
    setPosting(false);
    router.refresh();
  }

  async function toggleArchive() {
    setArchiving(true);
    if (archived) await unarchiveTask(task.id);
    else await archiveTask(task.id);
    setArchiving(false);
    router.refresh();
  }

  return (
    <div className="animate-fade-in">
      <Link
        href="/tasks"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to tasks
      </Link>

      {parent && (
        <Link
          href={`/tasks/${parent.id}`}
          className="mt-2 flex w-fit items-center gap-1.5 rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground hover:opacity-80"
        >
          <GitBranch className="size-3.5" />
          Part of epic: {parent.title}
        </Link>
      )}
      <div className="mb-4" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-bold tracking-tight">{task.title}</h1>
            {(canEdit || admin) && (
              <div className="flex shrink-0 gap-2">
                {canEdit && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setEditOpen(true)}
                  >
                    <Pencil className="size-4" />
                    Edit
                  </Button>
                )}
                {canEdit && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={toggleArchive}
                    disabled={archiving}
                    title={archived ? "Restore task" : "Archive task"}
                  >
                    {archiving ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : archived ? (
                      <ArchiveRestore className="size-4" />
                    ) : (
                      <Archive className="size-4" />
                    )}
                    {archived ? "Restore" : "Archive"}
                  </Button>
                )}
                {admin && (
                  <Button
                    variant="secondary"
                    size="icon-sm"
                    onClick={() => setDeleteOpen(true)}
                    title="Delete task"
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority as Priority} />
            {task.team && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-xs font-medium">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: task.team.color }}
                />
                {task.team.name}
              </span>
            )}
            {folder && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-xs font-medium">
                <FolderClosed
                  className="size-3"
                  style={{ color: folder.color }}
                />
                {folder.name}
              </span>
            )}
            {archived && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                <Archive className="size-3" />
                Archived
              </span>
            )}
            {task.is_private && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                <Lock className="size-3" />
                Private
              </span>
            )}
            {task.recurrence && task.recurrence !== "none" && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-xs font-medium capitalize text-muted-foreground">
                <History className="size-3" />
                {task.recurrence}
              </span>
            )}
            {task.labels.map((l) => (
              <span
                key={l.id}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                style={{ backgroundColor: l.color }}
              >
                {l.name}
              </span>
            ))}
          </div>

          <Card className="p-5">
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
              Description
            </h3>
            {task.description ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {task.description}
              </p>
            ) : (
              <p className="text-sm italic text-muted-foreground">
                No description provided.
              </p>
            )}
          </Card>

          {/* Approval */}
          <ApprovalCard task={task} canEdit={canEdit} canReview={writable} />

          {/* Checklist */}
          {(checklist.length > 0 || canEdit) && (
            <Checklist taskId={task.id} items={checklist} canEdit={canEdit} />
          )}

          {/* Time tracking */}
          <TimeCard
            taskId={task.id}
            entries={timeEntries}
            estimateMinutes={task.estimate_minutes}
            meId={me.id}
            canEdit={canEdit}
            admin={admin}
          />

          {/* Epic burndown */}
          {subtasks.length > 0 && <Burndown subtasks={subtasks} />}

          {/* Subtask pipeline */}
          {(subtasks.length > 0 || writable) && (
            <SubtaskPipeline
              subtasks={subtasks}
              writable={writable}
              canReorder={admin}
              parentId={task.id}
              onAdd={() => setSubtaskOpen(true)}
            />
          )}

          {/* Comments */}
          <div>
            <h3 className="mb-3 font-semibold">
              Comments{" "}
              <span className="text-muted-foreground">({commentCount})</span>
            </h3>

            {canEdit && (
              <form onSubmit={postComment} className="mb-5 flex gap-3">
                <Avatar name={me.full_name} email={me.email} color={me.color} size={36} />
                <div className="flex-1">
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Write a comment…"
                    className="min-h-16"
                  />
                  <div className="mt-2 flex justify-end">
                    <Button type="submit" size="sm" disabled={posting || !body.trim()}>
                      {posting ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Send className="size-4" />
                      )}
                      Comment
                    </Button>
                  </div>
                </div>
              </form>
            )}

            <div className="space-y-4">
              {comments.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No comments yet.
                </p>
              )}
              {comments.map((c) => (
                <CommentItem
                  key={c.id}
                  comment={c}
                  taskId={task.id}
                  me={me}
                  admin={admin}
                  canEdit={canEdit}
                  people={profiles}
                />
              ))}
            </div>
          </div>

          {/* Activity */}
          <ActivityTimeline activity={activity} />
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card className="divide-y divide-border">
            <Field label="Assignee">
              {task.assignee ? (
                <span className="flex items-center gap-2">
                  <Avatar
                    name={task.assignee.full_name}
                    email={task.assignee.email}
                    color={task.assignee.color}
                    size={24}
                  />
                  <span className="text-sm">
                    {task.assignee.full_name || task.assignee.email}
                  </span>
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">Unassigned</span>
              )}
            </Field>

            <Field label="Due date">
              <span
                className={cn(
                  "flex items-center gap-1.5 text-sm",
                  overdue && "font-medium text-destructive",
                )}
              >
                <CalendarDays className="size-4" />
                {fmtDate(task.due_date)}
                {overdue && " (overdue)"}
              </span>
            </Field>

            <Field label={`Watchers (${task.watchers.length})`}>
              {task.watchers.length === 0 ? (
                <span className="text-sm text-muted-foreground">
                  No watchers
                </span>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {task.watchers.map((w) => (
                    <span
                      key={w.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-muted py-0.5 pl-0.5 pr-2 text-xs"
                    >
                      <Avatar name={w.full_name} email={w.email} color={w.color} size={20} />
                      {w.full_name || w.email}
                    </span>
                  ))}
                </div>
              )}
            </Field>

            <Field label="Created">
              <span className="text-sm text-muted-foreground">
                {fmtDate(task.created_at)}
              </span>
            </Field>
            {task.completed_at && (
              <Field label="Completed">
                <span className="text-sm text-success">
                  {fmtDate(task.completed_at)}
                </span>
              </Field>
            )}
          </Card>

          <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
            <Eye className="size-4" />
            Watchers get visibility into this task&apos;s progress.
          </div>
        </div>
      </div>

      {canEdit && (
        <TaskDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          statuses={statuses}
          teams={teams}
          profiles={profiles}
          folders={folders}
          labels={labels}
          templates={templates}
          task={task}
        />
      )}
      {writable && (
        <TaskDialog
          open={subtaskOpen}
          onClose={() => setSubtaskOpen(false)}
          statuses={statuses}
          teams={teams}
          profiles={profiles}
          folders={folders}
          labels={labels}
          templates={templates}
          parentId={task.id}
          defaultFolderId={task.folder_id}
        />
      )}
      {admin && (
        <ConfirmDelete
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          title="Delete task"
          description={`Permanently delete "${task.title}"? This also removes its comments and watchers.`}
          onConfirm={async () => {
            await deleteTask(task.id);
            router.push("/tasks");
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-4">
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function SubtaskPipeline({
  subtasks,
  writable,
  canReorder,
  parentId,
  onAdd,
}: {
  subtasks: Subtask[];
  writable: boolean;
  canReorder: boolean;
  parentId: string;
  onAdd: () => void;
}) {
  const router = useRouter();
  const [items, setItems] = React.useState(subtasks);
  React.useEffect(() => setItems(subtasks), [subtasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const done = items.filter((s) => s.status?.category === "done").length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldI = items.findIndex((i) => i.id === active.id);
    const newI = items.findIndex((i) => i.id === over.id);
    if (oldI < 0 || newI < 0) return;
    const next = arrayMove(items, oldI, newI);
    setItems(next); // optimistic
    await reorderSubtasks(
      parentId,
      next.map((i) => i.id),
    );
    router.refresh();
  }

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold">
          <GitBranch className="size-4 text-primary" />
          Pipeline
          {items.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              {done}/{items.length} done
            </span>
          )}
        </h3>
        {writable && (
          <Button variant="secondary" size="sm" onClick={onAdd}>
            <Plus className="size-4" />
            Add subtask
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Break this into a sequence of subtasks. Each one unlocks only when the
          previous is done.
        </p>
      ) : (
        <>
          <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-success transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          {canReorder ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
            >
              <SortableContext
                items={items.map((i) => i.id)}
                strategy={verticalListSortingStrategy}
              >
                <ol className="space-y-1">
                  {items.map((s, i) => (
                    <SubtaskRow key={s.id} index={i + 1} subtask={s} sortable />
                  ))}
                </ol>
              </SortableContext>
              {canReorder && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Drag the handle to reorder the pipeline.
                </p>
              )}
            </DndContext>
          ) : (
            <ol className="space-y-1">
              {items.map((s, i) => (
                <SubtaskRow key={s.id} index={i + 1} subtask={s} />
              ))}
            </ol>
          )}
        </>
      )}
    </Card>
  );
}

function SubtaskRowContent({
  index,
  subtask,
}: {
  index: number;
  subtask: Subtask;
}) {
  const done = subtask.status?.category === "done";
  return (
    <>
      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          done
            ? "bg-success text-white"
            : subtask.blocked
              ? "bg-muted text-muted-foreground"
              : "bg-accent text-accent-foreground",
        )}
      >
        {done ? <CheckCircle2 className="size-4" /> : index}
      </span>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm font-medium group-hover:text-primary",
            done && "text-muted-foreground line-through",
          )}
        >
          {subtask.title}
        </p>
        {subtask.blocked && subtask.blockedBy && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="size-3" />
            Locked until “{subtask.blockedBy}” is done
          </p>
        )}
      </div>

      <StatusBadge status={subtask.status} />
      {subtask.assignee && (
        <Avatar
          name={subtask.assignee.full_name}
          email={subtask.assignee.email}
          color={subtask.assignee.color}
          size={22}
        />
      )}
    </>
  );
}

function SubtaskRow({
  index,
  subtask,
  sortable,
}: {
  index: number;
  subtask: Subtask;
  sortable?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: subtask.id, disabled: !sortable });

  const style = sortable
    ? { transform: CSS.Transform.toString(transform), transition }
    : undefined;

  return (
    <li
      ref={sortable ? setNodeRef : undefined}
      style={style}
      className={cn(
        "flex items-center gap-1 rounded-lg",
        isDragging && "z-10 bg-card shadow-md",
        subtask.blocked && "opacity-70",
      )}
    >
      {sortable && (
        <button
          type="button"
          className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
      )}
      <Link
        href={`/tasks/${subtask.id}`}
        className="group flex flex-1 items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted"
      >
        <SubtaskRowContent index={index} subtask={subtask} />
        <ChevronRight className="size-4 text-muted-foreground" />
      </Link>
    </li>
  );
}

function Checklist({
  taskId,
  items,
  canEdit,
}: {
  taskId: string;
  items: ChecklistItem[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [newItem, setNewItem] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);

  const done = items.filter((i) => i.is_done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!newItem.trim()) return;
    setAdding(true);
    await addChecklistItem(taskId, newItem.trim());
    setNewItem("");
    setAdding(false);
    router.refresh();
  }

  async function toggle(item: ChecklistItem) {
    setBusy(item.id);
    await toggleChecklistItem(item.id, taskId, !item.is_done);
    setBusy(null);
    router.refresh();
  }

  async function remove(item: ChecklistItem) {
    setBusy(item.id);
    await deleteChecklistItem(item.id, taskId);
    setBusy(null);
    router.refresh();
  }

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold">
          <CheckSquare className="size-4 text-primary" />
          Checklist
          {items.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              {done}/{items.length} done
            </span>
          )}
        </h3>
      </div>

      {items.length > 0 && (
        <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-success transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Add quick to-dos to knock out the easy wins.
        </p>
      ) : (
        <ul className="space-y-1">
          {items.map((item) => (
            <li
              key={item.id}
              className="group flex items-center gap-2 rounded-lg px-1 py-1"
            >
              <button
                type="button"
                disabled={!canEdit || busy === item.id}
                onClick={() => toggle(item)}
                className={cn(
                  "shrink-0 text-muted-foreground",
                  canEdit && "cursor-pointer hover:text-primary",
                )}
                title={item.is_done ? "Mark not done" : "Mark done"}
              >
                {item.is_done ? (
                  <CheckSquare className="size-4.5 text-success" />
                ) : (
                  <Square className="size-4.5" />
                )}
              </button>
              <span
                className={cn(
                  "flex-1 text-sm",
                  item.is_done && "text-muted-foreground line-through",
                )}
              >
                {item.body}
              </span>
              {canEdit && (
                <button
                  type="button"
                  disabled={busy === item.id}
                  onClick={() => remove(item)}
                  className="shrink-0 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100 cursor-pointer"
                  title="Remove item"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <form onSubmit={add} className="mt-3 flex gap-2">
          <Input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder="Add an item…"
            className="h-9"
          />
          <Button type="submit" size="sm" disabled={adding || !newItem.trim()}>
            {adding ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Add
          </Button>
        </form>
      )}
    </Card>
  );
}

function CommentItem({
  comment,
  taskId,
  me,
  admin,
  canEdit,
  people,
}: {
  comment: CommentThread;
  taskId: string;
  me: Profile;
  admin: boolean;
  canEdit: boolean;
  people: Profile[];
}) {
  const router = useRouter();
  const [replyOpen, setReplyOpen] = React.useState(false);
  const [reply, setReply] = React.useState("");
  const [sending, setSending] = React.useState(false);

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    await addComment(taskId, reply.trim(), comment.id);
    setReply("");
    setSending(false);
    setReplyOpen(false);
    router.refresh();
  }

  return (
    <div className="flex gap-3">
      <Avatar
        name={comment.author?.full_name}
        email={comment.author?.email}
        color={comment.author?.color}
        size={36}
      />
      <div className="flex-1">
        <Bubble c={comment} me={me} admin={admin} taskId={taskId} people={people} />

        {canEdit && (
          <button
            type="button"
            onClick={() => setReplyOpen((o) => !o)}
            className="mt-1 ml-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <Reply className="size-3" />
            Reply
          </button>
        )}

        {(comment.replies.length > 0 || replyOpen) && (
          <div className="mt-3 space-y-3 border-l-2 border-border pl-4">
            {comment.replies.map((r) => (
              <div key={r.id} className="flex gap-3">
                <Avatar
                  name={r.author?.full_name}
                  email={r.author?.email}
                  color={r.author?.color}
                  size={28}
                />
                <Bubble c={r} me={me} admin={admin} taskId={taskId} people={people} />
              </div>
            ))}

            {replyOpen && (
              <form onSubmit={sendReply} className="flex gap-3">
                <Avatar name={me.full_name} email={me.email} color={me.color} size={28} />
                <div className="flex-1">
                  <Textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder={`Reply to ${
                      comment.author?.full_name || "comment"
                    }…`}
                    className="min-h-14"
                    autoFocus
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setReplyOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={sending || !reply.trim()}
                    >
                      {sending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Send className="size-4" />
                      )}
                      Reply
                    </Button>
                  </div>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Bubble({
  c,
  me,
  admin,
  taskId,
  people,
}: {
  c: Comment;
  me: Profile;
  admin: boolean;
  taskId: string;
  people: Profile[];
}) {
  const router = useRouter();
  return (
    <div className="flex-1 rounded-lg border border-border bg-card p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-sm font-medium">
          {c.author?.full_name || c.author?.email || "Unknown"}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {fmtDateTime(c.created_at)}
          </span>
          {(c.author_id === me.id || admin) && (
            <button
              onClick={async () => {
                await deleteComment(c.id, taskId);
                router.refresh();
              }}
              className="text-muted-foreground hover:text-destructive cursor-pointer"
              title="Delete comment"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">
        {renderWithMentions(c.body, people)}
      </p>
    </div>
  );
}

/** Render comment text, bolding @mentions that match a teammate name/handle. */
function renderWithMentions(body: string, people: Profile[]) {
  const names = people
    .map((p) => (p.full_name || "").trim())
    .concat(people.map((p) => p.email?.split("@")[0] ?? ""))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length); // longest first
  if (names.length === 0) return body;
  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`@(${escaped.join("|")})`, "gi");
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    if (m.index > last) out.push(body.slice(last, m.index));
    out.push(
      <span key={m.index} className="font-semibold text-primary">
        {m[0]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < body.length) out.push(body.slice(last));
  return out;
}

function ApprovalCard({
  task,
  canEdit,
  canReview,
}: {
  task: TaskWithRelations;
  canEdit: boolean;
  canReview: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const status = task.approval_status;

  async function run(fn: () => Promise<{ error?: string }>) {
    setBusy(true);
    await fn();
    setBusy(false);
    router.refresh();
  }

  const tone =
    status === "approved"
      ? "border-success/40 bg-success/10"
      : status === "changes_requested"
        ? "border-destructive/40 bg-destructive/10"
        : status === "pending"
          ? "border-warning/40 bg-warning/10"
          : "border-border";

  return (
    <Card className={cn("p-5", tone)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldQuestion className="size-4 text-primary" />
          <span className="font-semibold">Approval</span>
          <span className="text-sm text-muted-foreground">
            {APPROVAL_LABELS[status]}
            {task.approval_at && task.approver
              ? ` · ${task.approver.full_name || task.approver.email}, ${fmtDate(task.approval_at)}`
              : ""}
          </span>
        </div>
        <div className="flex gap-2">
          {canEdit && status !== "pending" && (
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(() => requestApproval(task.id))}>
              <ShieldQuestion className="size-4" />
              Request approval
            </Button>
          )}
          {canReview && status === "pending" && (
            <>
              <Button size="sm" disabled={busy} onClick={() => run(() => setApproval(task.id, "approved"))}>
                <ThumbsUp className="size-4" />
                Approve
              </Button>
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(() => setApproval(task.id, "changes_requested"))}>
                <Undo2 className="size-4" />
                Request changes
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

function TimeCard({
  taskId,
  entries,
  estimateMinutes,
  meId,
  canEdit,
  admin,
}: {
  taskId: string;
  entries: TimeEntry[];
  estimateMinutes: number | null;
  meId: string;
  canEdit: boolean;
  admin: boolean;
}) {
  const router = useRouter();
  const [hours, setHours] = React.useState("");
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const logged = entries.reduce((n, e) => n + e.minutes, 0);
  const pct = estimateMinutes ? Math.min(100, Math.round((logged / estimateMinutes) * 100)) : 0;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const h = parseFloat(hours);
    if (!h || h <= 0) return;
    setSaving(true);
    await addTimeEntry({
      taskId,
      minutes: Math.round(h * 60),
      note: note.trim() || null,
      spentOn: new Date().toISOString().slice(0, 10),
    });
    setHours("");
    setNote("");
    setSaving(false);
    router.refresh();
  }

  if (!canEdit && entries.length === 0 && !estimateMinutes) return null;

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <Clock className="size-4 text-primary" />
        <h3 className="font-semibold">Time</h3>
        <span className="text-sm font-normal text-muted-foreground">
          {fmtHours(logged)} logged
          {estimateMinutes ? ` of ${fmtHours(estimateMinutes)} estimated` : ""}
        </span>
      </div>

      {estimateMinutes ? (
        <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full", pct >= 100 ? "bg-destructive" : "bg-primary")}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}

      {entries.length > 0 && (
        <ul className="mb-3 space-y-1">
          {entries.map((e) => (
            <li key={e.id} className="group flex items-center gap-2 text-sm">
              <span className="w-12 shrink-0 font-medium">{fmtHours(e.minutes)}</span>
              <span className="text-muted-foreground">{fmtDate(e.spent_on)}</span>
              {e.user && (
                <span className="text-muted-foreground">· {e.user.full_name || e.user.email}</span>
              )}
              {e.note && <span className="truncate">— {e.note}</span>}
              {(e.user_id === meId || admin) && (
                <button
                  onClick={async () => {
                    await deleteTimeEntry(e.id, taskId);
                    router.refresh();
                  }}
                  className="ml-auto text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100 cursor-pointer"
                  title="Delete entry"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <form onSubmit={add} className="flex flex-wrap items-end gap-2">
          <div className="w-24">
            <Input
              type="number"
              min="0"
              step="0.25"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="Hours"
              className="h-9"
            />
          </div>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What did you work on? (optional)"
            className="h-9 flex-1"
          />
          <Button type="submit" size="sm" disabled={saving || !hours}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Log
          </Button>
        </form>
      )}
    </Card>
  );
}

function Burndown({ subtasks }: { subtasks: Subtask[] }) {
  const total = subtasks.length;
  // Cumulative completions over time → remaining count per day.
  const completions = subtasks
    .filter((s) => s.completed_at)
    .map((s) => s.completed_at!.slice(0, 10))
    .sort();
  if (completions.length === 0) return null;

  const start = subtasks
    .map((s) => (s.created_at || "").slice(0, 10))
    .filter(Boolean)
    .sort()[0];
  const points: { date: string; remaining: number }[] = [
    { date: start, remaining: total },
  ];
  let remaining = total;
  for (const d of completions) {
    remaining -= 1;
    points.push({ date: d, remaining });
  }

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <GitBranch className="size-4 text-primary" />
        <h3 className="font-semibold">Burndown</h3>
        <span className="text-sm font-normal text-muted-foreground">
          {total - remaining}/{total} subtasks done
        </span>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={points} margin={{ left: -20, top: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
          <Tooltip />
          <Area type="stepAfter" dataKey="remaining" stroke="#6366f1" fill="#6366f1" fillOpacity={0.15} />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}

function ActivityTimeline({ activity }: { activity: ActivityEntry[] }) {
  if (activity.length === 0) return null;
  return (
    <div>
      <h3 className="mb-3 flex items-center gap-2 font-semibold">
        <History className="size-4" />
        Activity
      </h3>
      <ul className="space-y-3">
        {activity.map((a) => (
          <li key={a.id} className="flex items-start gap-3 text-sm">
            <span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <CheckCheck className="size-3.5" />
            </span>
            <div className="min-w-0">
              <p className="leading-snug">
                <span className="font-medium">
                  {a.actor?.full_name || a.actor?.email || "Someone"}
                </span>{" "}
                {a.summary}
              </p>
              <p className="text-xs text-muted-foreground">
                {fmtDateTime(a.created_at)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
