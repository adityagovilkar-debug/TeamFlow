"use client";

import * as React from "react";
import Link from "next/link";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { useRealtime } from "@/lib/use-realtime";
import { isOverdue } from "@/lib/date";
import { cn } from "@/lib/utils";
import type { Role, TaskWithRelations } from "@/lib/types";

const PRIORITY_COLOR: Record<string, string> = {
  low: "#64748b",
  medium: "#3b82f6",
  high: "#f59e0b",
  urgent: "#ef4444",
};

export function CalendarView({
  tasks,
}: {
  role: Role;
  tasks: TaskWithRelations[];
}) {
  useRealtime(["tasks"]);
  const [cursor, setCursor] = React.useState(() => new Date());

  const monthStart = startOfMonth(cursor);
  const days = eachDayOfInterval({
    start: startOfWeek(monthStart),
    end: endOfWeek(endOfMonth(cursor)),
  });

  const dated = tasks.filter((t) => t.due_date);
  const tasksFor = (day: Date) =>
    dated.filter((t) => isSameDay(parseISO(t.due_date!), day));

  const undated = tasks.filter((t) => !t.due_date).length;

  return (
    <div>
      <PageHeader
        title="Calendar"
        description="Tasks placed on their due dates."
      >
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setCursor(new Date())}
          >
            Today
          </Button>
          <div className="flex items-center rounded-md border border-border bg-card">
            <button
              onClick={() => setCursor((c) => addMonths(c, -1))}
              className="p-1.5 hover:bg-muted cursor-pointer rounded-l-md"
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              onClick={() => setCursor((c) => addMonths(c, 1))}
              className="p-1.5 hover:bg-muted cursor-pointer rounded-r-md"
              aria-label="Next month"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <span className="ml-1 min-w-36 text-right font-semibold">
            {format(cursor, "MMMM yyyy")}
          </span>
        </div>
      </PageHeader>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {/* Weekday header */}
        <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center text-xs font-medium text-muted-foreground">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((day) => {
            const dayTasks = tasksFor(day);
            const inMonth = isSameMonth(day, cursor);
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "min-h-28 border-b border-r border-border p-1.5 [&:nth-child(7n)]:border-r-0",
                  !inMonth && "bg-muted/30",
                )}
              >
                <div className="mb-1 flex justify-end">
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full text-xs",
                      isToday(day)
                        ? "brand-gradient font-semibold text-white"
                        : inMonth
                          ? "text-foreground"
                          : "text-muted-foreground",
                    )}
                  >
                    {format(day, "d")}
                  </span>
                </div>
                <div className="space-y-1">
                  {dayTasks.slice(0, 3).map((t) => {
                    const done = t.status?.category === "done";
                    const overdue = isOverdue(t.due_date, done);
                    return (
                      <Link
                        key={t.id}
                        href={`/tasks/${t.id}`}
                        className={cn(
                          "block truncate rounded-md px-1.5 py-0.5 text-xs font-medium transition-opacity hover:opacity-80",
                          done && "line-through opacity-60",
                        )}
                        style={{
                          backgroundColor: overdue
                            ? "#ef444418"
                            : `${PRIORITY_COLOR[t.priority]}18`,
                          color: overdue
                            ? "#ef4444"
                            : PRIORITY_COLOR[t.priority],
                        }}
                        title={t.title}
                      >
                        {t.title}
                      </Link>
                    );
                  })}
                  {dayTasks.length > 3 && (
                    <span className="px-1.5 text-xs text-muted-foreground">
                      +{dayTasks.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="font-medium">Priority:</span>
        {Object.entries(PRIORITY_COLOR).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1.5 capitalize">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: v }} />
            {k}
          </span>
        ))}
        {undated > 0 && (
          <span className="ml-auto">
            {undated} task{undated === 1 ? "" : "s"} without a due date
          </span>
        )}
      </div>
    </div>
  );
}
