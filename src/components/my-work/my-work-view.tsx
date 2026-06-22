"use client";

import * as React from "react";
import Link from "next/link";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { ListTodo } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Avatar } from "@/components/ui/avatar";
import { PriorityBadge, StatusBadge } from "@/components/task-badges";
import { useRealtime } from "@/lib/use-realtime";
import { dueLabel, isOverdue } from "@/lib/date";
import { cn } from "@/lib/utils";
import { type Priority, type TaskWithRelations } from "@/lib/types";

type Scope = "assigned" | "created" | "watching";

const GROUPS = [
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Due today" },
  { key: "week", label: "This week" },
  { key: "later", label: "Later" },
  { key: "none", label: "No due date" },
] as const;

type GroupKey = (typeof GROUPS)[number]["key"];

function bucket(t: TaskWithRelations): GroupKey {
  const done = t.status?.category === "done";
  if (!t.due_date) return "none";
  if (isOverdue(t.due_date, done)) return "overdue";
  const days = differenceInCalendarDays(parseISO(t.due_date), new Date());
  if (days <= 0) return "today";
  if (days <= 7) return "week";
  return "later";
}

export function MyWorkView({
  meId,
  tasks,
}: {
  meId: string;
  tasks: TaskWithRelations[];
}) {
  useRealtime(["tasks", "task_watchers"]);
  const [scope, setScope] = React.useState<Scope>("assigned");

  const mine = tasks.filter((t) => {
    if (scope === "assigned") return t.assignee_id === meId;
    if (scope === "created") return t.created_by === meId;
    return t.watchers.some((w) => w.id === meId);
  });

  const grouped = GROUPS.map((g) => ({
    ...g,
    items: mine
      .filter((t) => bucket(t) === g.key)
      .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999")),
  })).filter((g) => g.items.length > 0);

  const scopes: { id: Scope; label: string }[] = [
    { id: "assigned", label: "Assigned to me" },
    { id: "created", label: "Created by me" },
    { id: "watching", label: "Watching" },
  ];

  return (
    <div>
      <PageHeader
        title="My Work"
        description="Your tasks, grouped by when they're due."
      />

      <div className="mb-5 inline-flex rounded-lg border border-border bg-card p-0.5 text-sm">
        {scopes.map((s) => (
          <button
            key={s.id}
            onClick={() => setScope(s.id)}
            className={cn(
              "rounded-md px-3 py-1 font-medium transition-colors cursor-pointer",
              scope === s.id
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {grouped.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title="Nothing here"
          description="No tasks match this view. Enjoy the breathing room!"
        />
      ) : (
        <div className="space-y-6">
          {grouped.map((g) => (
            <div key={g.key}>
              <h3
                className={cn(
                  "mb-2 text-sm font-semibold",
                  g.key === "overdue" ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {g.label}{" "}
                <span className="text-muted-foreground">({g.items.length})</span>
              </h3>
              <Card className="divide-y divide-border">
                {g.items.map((t) => {
                  const due = dueLabel(t.due_date);
                  const overdue = isOverdue(
                    t.due_date,
                    t.status?.category === "done",
                  );
                  return (
                    <Link
                      key={t.id}
                      href={`/tasks/${t.id}`}
                      className="flex items-center gap-3 p-3 hover:bg-muted/40"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium hover:text-primary">
                          {t.title}
                        </p>
                        <div className="mt-0.5 flex items-center gap-2">
                          <StatusBadge status={t.status} />
                          <PriorityBadge priority={t.priority as Priority} />
                          {t.team && (
                            <span className="text-xs text-muted-foreground">
                              {t.team.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 text-sm",
                          overdue
                            ? "font-medium text-destructive"
                            : due.tone === "soon"
                              ? "text-warning"
                              : "text-muted-foreground",
                        )}
                      >
                        {due.text}
                      </span>
                      {t.assignee && (
                        <Avatar
                          name={t.assignee.full_name}
                          email={t.assignee.email}
                          color={t.assignee.color}
                          size={24}
                        />
                      )}
                    </Link>
                  );
                })}
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
