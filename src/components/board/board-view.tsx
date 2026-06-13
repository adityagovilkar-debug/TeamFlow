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
import { Plus, KanbanSquare, MessageSquare, Eye } from "lucide-react";
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
  canWrite,
  type Priority,
  type Profile,
  type Role,
  type Status,
  type TaskWithRelations,
  type Team,
} from "@/lib/types";

export function BoardView({
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
  const writable = canWrite(role);

  const [items, setItems] = React.useState(tasks);
  React.useEffect(() => setItems(tasks), [tasks]);

  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [defaultStatus, setDefaultStatus] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const activeTask = items.find((t) => t.id === activeId) || null;

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
    if (res.error) router.refresh();
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
                  <BoardCard key={t.id} task={t} draggable={writable} />
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

      {writable && (
        <TaskDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          statuses={statuses}
          teams={teams}
          profiles={profiles}
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
}: {
  task: TaskWithRelations;
  draggable: boolean;
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
      <CardInner task={task} />
    </div>
  );
}

function CardInner({ task }: { task: TaskWithRelations }) {
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
