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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { PriorityBadge, StatusBadge } from "@/components/task-badges";
import { TaskDialog } from "@/components/task-dialog";
import { ConfirmDelete } from "@/components/confirm-delete";
import {
  addComment,
  deleteComment,
  deleteTask,
  reorderSubtasks,
} from "@/lib/actions";
import { useRealtime } from "@/lib/use-realtime";
import { fmtDate, fmtDateTime, isOverdue } from "@/lib/date";
import { cn } from "@/lib/utils";
import {
  canEditTask,
  canWrite,
  isAdmin,
  type Comment,
  type Priority,
  type Profile,
  type Status,
  type Subtask,
  type TaskWithRelations,
  type Team,
} from "@/lib/types";

export function TaskDetail({
  me,
  task,
  parent,
  subtasks,
  comments,
  statuses,
  teams,
  profiles,
}: {
  me: Profile;
  task: TaskWithRelations;
  parent: { id: string; title: string } | null;
  subtasks: Subtask[];
  comments: Comment[];
  statuses: Status[];
  teams: Team[];
  profiles: Profile[];
}) {
  const router = useRouter();
  useRealtime(["tasks", "comments", "task_watchers"]);

  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [subtaskOpen, setSubtaskOpen] = React.useState(false);
  const [body, setBody] = React.useState("");
  const [posting, setPosting] = React.useState(false);

  const writable = canWrite(me.role); // can create (e.g. add subtasks)
  const canEdit = canEditTask(me.role, task, me.id); // can edit/comment this task
  const admin = isAdmin(me.role);
  const done = task.status?.category === "done";
  const overdue = isOverdue(task.due_date, done);

  async function postComment(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setPosting(true);
    await addComment(task.id, body.trim());
    setBody("");
    setPosting(false);
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
              <span className="text-muted-foreground">({comments.length})</span>
            </h3>

            {canEdit && (
              <form onSubmit={postComment} className="mb-5 flex gap-3">
                <Avatar name={me.full_name} email={me.email} size={36} />
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
                <div key={c.id} className="flex gap-3">
                  <Avatar
                    name={c.author?.full_name}
                    email={c.author?.email}
                    size={36}
                  />
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
                              await deleteComment(c.id, task.id);
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
                      {c.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
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
                      <Avatar name={w.full_name} email={w.email} size={20} />
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
          parentId={task.id}
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
