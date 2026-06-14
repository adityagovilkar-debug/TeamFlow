"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  Plus,
  KanbanSquare,
  MessageSquare,
  Eye,
  Lock,
  GitBranch,
  CheckSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { PriorityBadge } from "@/components/task-badges";
import { TaskDialog } from "@/components/task-dialog";
import { updateTaskStatus } from "@/lib/actions";
import { useRealtime } from "@/lib/use-realtime";
import { dueLabel, isOverdue } from "@/lib/date";
import { cn } from "@/lib/utils";
import {
  canEditTask,
  canWrite,
  computeBlocked,
  type Folder,
  type Priority,
  type Profile,
  type Role,
  type SiblingForBlocking,
  type Status,
  type TaskWithRelations,
  type Team,
} from "@/lib/types";

export function BoardView({
  role,
  meId,
  tasks,
  statuses,
  teams,
  profiles,
  folders,
}: {
  role: Role;
  meId: string;
  tasks: TaskWithRelations[];
  statuses: Status[];
  teams: Team[];
  profiles: Profile[];
  folders: Folder[];
}) {
  const router = useRouter();
  useRealtime(["tasks", "comments", "task_watchers"]);
  const writable = canWrite(role);

  const [items, setItems] = React.useState(tasks);
  React.useEffect(() => setItems(tasks), [tasks]);

  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [defaultStatus, setDefaultStatus] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const activeTask = items.find((t) => t.id === activeId) || null;

  // Epic / blocked relationships computed from the current board state.
  const childCount = new Map<string, number>();
  const doneCount = new Map<string, number>();
  const siblingsByParent = new Map<string, SiblingForBlocking[]>();
  for (const t of items) {
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
  const blockInfo = (t: TaskWithRelations) =>
    t.parent_id
      ? computeBlocked(t.id, t.position, siblingsByParent.get(t.parent_id) ?? [])
      : { blocked: false, blockedBy: null };

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const taskId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;

    const newStatusId = overId.startsWith("col:") ? overId.slice(4) : null;
    if (!newStatusId) return;

    const task = items.find((t) => t.id === taskId);
    if (!task || task.status_id === newStatusId) return;

    // Pipeline rule: don't let a locked subtask move past "todo".
    const target = statuses.find((s) => s.id === newStatusId);
    if (target && target.category !== "todo") {
      const info = blockInfo(task);
      if (info.blocked) {
        setToast(`🔒 Locked — finish “${info.blockedBy}” first.`);
        return;
      }
    }

    // Optimistic move.
    setItems((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status_id: newStatusId,
              status: statuses.find((s) => s.id === newStatusId) ?? null,
            }
          : t,
      ),
    );
    const res = await updateTaskStatus(taskId, newStatusId);
    if (res.error) {
      setToast(res.error);
      router.refresh();
    }
  }

  if (statuses.length === 0) {
    return (
      <div>
        <PageHeader title="Board" />
        <EmptyState
          icon={KanbanSquare}
          title="No statuses defined"
          description="An admin needs to add statuses before the board can be used."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Board" description="Drag tasks between columns to update status">
        {writable && (
          <Button
            onClick={() => {
              setDefaultStatus(statuses[0]?.id ?? null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" />
            New task
          </Button>
        )}
      </PageHeader>

      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {statuses.map((status) => {
            const colTasks = items.filter((t) => t.status_id === status.id);
            return (
              <Column
                key={status.id}
                status={status}
                count={colTasks.length}
                writable={writable}
                onAdd={() => {
                  setDefaultStatus(status.id);
                  setDialogOpen(true);
                }}
              >
                {colTasks.map((t) => (
                  <BoardCard
                    key={t.id}
                    task={t}
                    draggable={canEditTask(role, t, meId)}
                    blocked={blockInfo(t).blocked}
                    childCount={childCount.get(t.id) ?? 0}
                    doneCount={doneCount.get(t.id) ?? 0}
                  />
                ))}
              </Column>
            );
          })}
        </div>

        <DragOverlay>
          {activeTask ? (
            <div className="rotate-2">
              <CardInner task={activeTask} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg animate-fade-in">
          {toast}
        </div>
      )}

      {writable && (
        <TaskDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          statuses={statuses}
          teams={teams}
          profiles={profiles}
          folders={folders}
          defaultStatusId={defaultStatus}
        />
      )}
    </div>
  );
}

function Column({
  status,
  count,
  writable,
  onAdd,
  children,
}: {
  status: Status;
  count: number;
  writable: boolean;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${status.id}` });
  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span
            className="size-2.5 rounded-full"
            style={{ backgroundColor: status.color }}
          />
          <span className="text-sm font-semibold">{status.name}</span>
          <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground">
            {count}
          </span>
        </div>
        {writable && (
          <button
            onClick={onAdd}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
            title="Add task"
          >
            <Plus className="size-4" />
          </button>
        )}
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-32 flex-1 flex-col gap-2 rounded-xl border border-dashed border-transparent bg-muted/40 p-2 transition-colors",
          isOver && "border-primary/40 bg-accent/60",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function BoardCard({
  task,
  draggable,
  blocked,
  childCount,
  doneCount,
}: {
  task: TaskWithRelations;
  draggable: boolean;
  blocked?: boolean;
  childCount?: number;
  doneCount?: number;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    disabled: !draggable,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(isDragging && "opacity-40")}
      {...(draggable ? { ...listeners, ...attributes } : {})}
    >
      <CardInner
        task={task}
        blocked={blocked}
        childCount={childCount}
        doneCount={doneCount}
      />
    </div>
  );
}

function CardInner({
  task,
  blocked,
  childCount,
  doneCount,
}: {
  task: TaskWithRelations;
  blocked?: boolean;
  childCount?: number;
  doneCount?: number;
}) {
  const done = task.status?.category === "done";
  const due = dueLabel(task.due_date);
  const overdue = isOverdue(task.due_date, done);

  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="mb-2 flex items-start justify-between gap-2">
        <Link
          href={`/tasks/${task.id}`}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="text-sm font-medium leading-snug hover:text-primary"
        >
          {task.title}
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <PriorityBadge priority={task.priority as Priority} />
        {childCount ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
            <GitBranch className="size-3" />
            {doneCount ?? 0}/{childCount}
            <span className="inline-block h-1.5 w-8 overflow-hidden rounded-full bg-muted align-middle">
              <span
                className="block h-full rounded-full bg-success"
                style={{
                  width: `${Math.round(((doneCount ?? 0) / childCount) * 100)}%`,
                }}
              />
            </span>
          </span>
        ) : null}
        {blocked && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-warning">
            <Lock className="size-3" />
            Locked
          </span>
        )}
        {task.team && (
          <span
            className="inline-flex items-center gap-1 text-xs text-muted-foreground"
          >
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: task.team.color }}
            />
            {task.team.name}
          </span>
        )}
      </div>
      <div className="mt-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {task.due_date && (
            <span className={cn(overdue && "font-medium text-destructive")}>
              {due.text}
            </span>
          )}
          {(task.checklist_total ?? 0) > 0 && (
            <span className="flex items-center gap-0.5">
              <CheckSquare className="size-3" />
              {task.checklist_done ?? 0}/{task.checklist_total}
            </span>
          )}
          {task.watchers.length > 0 && (
            <span className="flex items-center gap-0.5">
              <Eye className="size-3" />
              {task.watchers.length}
            </span>
          )}
          {(task.comment_count ?? 0) > 0 && (
            <span className="flex items-center gap-0.5">
              <MessageSquare className="size-3" />
              {task.comment_count}
            </span>
          )}
        </div>
        {task.assignee && (
          <Avatar
            name={task.assignee.full_name}
            email={task.assignee.email}
            size={22}
          />
        )}
      </div>
    </div>
  );
}
