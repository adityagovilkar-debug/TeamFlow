"use client";

import * as React from "react";
import Link from "next/link";
import {
  parseISO,
  startOfDay,
  differenceInCalendarDays,
  eachDayOfInterval,
  addDays,
  format,
  isWeekend,
  isToday,
} from "date-fns";
import { ChartGantt } from "lucide-react";
import { Select } from "@/components/ui/select";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Avatar } from "@/components/ui/avatar";
import { useRealtime } from "@/lib/use-realtime";
import { cn } from "@/lib/utils";
import { isOverdue } from "@/lib/date";
import {
  PRIORITIES,
  type TaskWithRelations,
  type Team,
} from "@/lib/types";

const DAY_W = 34; // px per day
const LABEL_W = 220; // px for the sticky task-label column

const priorityColor = (p: string) =>
  PRIORITIES.find((x) => x.value === p)?.color ?? "var(--priority-medium)";

export function TimelineView({
  tasks,
  teams,
}: {
  tasks: TaskWithRelations[];
  teams: Team[];
}) {
  useRealtime(["tasks"]);
  const [teamF, setTeamF] = React.useState("");

  const visible = teamF ? tasks.filter((t) => t.team_id === teamF) : tasks;

  // Tasks with a due date get a bar (start = start_date, else created_at).
  const scheduled = visible
    .filter((t) => t.due_date)
    .map((t) => {
      const end = startOfDay(parseISO(t.due_date!));
      let start = startOfDay(parseISO(t.start_date ?? t.created_at));
      if (start > end) start = end;
      return { task: t, start, end };
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const undated = visible.filter((t) => !t.due_date);

  if (scheduled.length === 0) {
    return (
      <div>
        <PageHeader title="Timeline" description="Tasks as bars across their planned dates" />
        <TeamFilter teams={teams} value={teamF} onChange={setTeamF} />
        <EmptyState
          icon={ChartGantt}
          title="Nothing to plot yet"
          description="Give tasks a due date (and optionally a start date) to see them on the timeline."
        />
        {undated.length > 0 && <UndatedList tasks={undated} />}
      </div>
    );
  }

  const today = startOfDay(new Date());
  const minStart = scheduled.reduce(
    (m, s) => (s.start < m ? s.start : m),
    scheduled[0].start,
  );
  const maxEnd = scheduled.reduce(
    (m, s) => (s.end > m ? s.end : m),
    scheduled[0].end,
  );
  const windowStart = addDays(minStart < today ? minStart : today, -2);
  const windowEnd = addDays(maxEnd > today ? maxEnd : today, 3);
  const days = eachDayOfInterval({ start: windowStart, end: windowEnd });
  const gridW = days.length * DAY_W;

  const offset = (d: Date) => differenceInCalendarDays(d, windowStart);
  const todayLeft = offset(today) * DAY_W;
  const showToday = today >= windowStart && today <= windowEnd;

  // Month header segments.
  const months: { label: string; span: number }[] = [];
  for (const d of days) {
    const label = format(d, "MMM yyyy");
    const last = months[months.length - 1];
    if (last && last.label === label) last.span += 1;
    else months.push({ label, span: 1 });
  }

  return (
    <div>
      <PageHeader title="Timeline" description="Tasks as bars across their planned dates" />
      <TeamFilter teams={teams} value={teamF} onChange={setTeamF} />

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <div style={{ width: LABEL_W + gridW }} className="min-w-full">
          {/* Month header */}
          <div className="flex border-b border-border">
            <div
              className="sticky left-0 z-20 shrink-0 border-r border-border bg-card"
              style={{ width: LABEL_W }}
            />
            <div className="flex" style={{ width: gridW }}>
              {months.map((m, i) => (
                <div
                  key={i}
                  className="border-r border-border px-2 py-1 text-xs font-semibold text-muted-foreground"
                  style={{ width: m.span * DAY_W }}
                >
                  {m.label}
                </div>
              ))}
            </div>
          </div>

          {/* Day header */}
          <div className="flex border-b border-border">
            <div
              className="sticky left-0 z-20 flex shrink-0 items-center border-r border-border bg-card px-3 text-xs font-medium text-muted-foreground"
              style={{ width: LABEL_W }}
            >
              Task
            </div>
            <div className="relative flex" style={{ width: gridW }}>
              {days.map((d, i) => (
                <div
                  key={i}
                  className={cn(
                    "shrink-0 border-r border-border/60 text-center text-[10px] leading-tight",
                    isWeekend(d) && "bg-muted/40",
                    isToday(d) && "bg-primary/10",
                  )}
                  style={{ width: DAY_W }}
                >
                  <div className="text-muted-foreground">{format(d, "EEEEE")}</div>
                  <div
                    className={cn(
                      "font-medium",
                      isToday(d) && "text-primary",
                    )}
                  >
                    {format(d, "d")}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rows */}
          <div className="relative">
            {scheduled.map(({ task, start, end }) => {
              const left = offset(start) * DAY_W;
              const width = (differenceInCalendarDays(end, start) + 1) * DAY_W;
              const done = task.status?.category === "done";
              const overdue = isOverdue(task.due_date, done);
              const color = priorityColor(task.priority);
              return (
                <div key={task.id} className="flex border-b border-border last:border-0">
                  <div
                    className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-border bg-card px-3 py-2"
                    style={{ width: LABEL_W }}
                  >
                    {task.assignee && (
                      <Avatar
                        name={task.assignee.full_name}
                        email={task.assignee.email}
                        color={task.assignee.color}
                        size={20}
                      />
                    )}
                    <Link
                      href={`/tasks/${task.id}`}
                      className="truncate text-sm font-medium hover:text-primary"
                      title={task.title}
                    >
                      {task.title}
                    </Link>
                  </div>
                  <div className="relative" style={{ width: gridW, height: 44 }}>
                    {/* weekend / today background stripes */}
                    {days.map((d, i) => (
                      <div
                        key={i}
                        className={cn(
                          "absolute top-0 h-full border-r border-border/40",
                          isWeekend(d) && "bg-muted/30",
                          isToday(d) && "bg-primary/5",
                        )}
                        style={{ left: i * DAY_W, width: DAY_W }}
                      />
                    ))}
                    <Link
                      href={`/tasks/${task.id}`}
                      className={cn(
                        "absolute top-1/2 flex h-6 -translate-y-1/2 items-center overflow-hidden rounded-md px-2 text-[11px] font-medium text-white shadow-sm transition-opacity hover:opacity-90",
                        done && "opacity-60",
                        overdue && "ring-2 ring-destructive ring-offset-1 ring-offset-card",
                      )}
                      style={{
                        left,
                        width: Math.max(width, DAY_W),
                        backgroundColor: color,
                      }}
                      title={`${task.title}${overdue ? " — overdue" : ""}`}
                    >
                      <span className="truncate">{task.title}</span>
                    </Link>
                  </div>
                </div>
              );
            })}

            {/* Today marker spanning all rows */}
            {showToday && (
              <div
                className="pointer-events-none absolute top-0 z-10 h-full w-px bg-primary/70"
                style={{ left: LABEL_W + todayLeft + DAY_W / 2 }}
              />
            )}
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Bars span each task&apos;s start date → due date (start falls back to the
        created date). Color = priority; a red outline marks overdue tasks.
      </p>

      {undated.length > 0 && <UndatedList tasks={undated} />}
    </div>
  );
}

function TeamFilter({
  teams,
  value,
  onChange,
}: {
  teams: Team[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mb-4">
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-auto min-w-40"
      >
        <option value="">All teams</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </Select>
    </div>
  );
}

function UndatedList({ tasks }: { tasks: TaskWithRelations[] }) {
  return (
    <div className="mt-6">
      <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
        No due date ({tasks.length})
      </h3>
      <div className="flex flex-wrap gap-2">
        {tasks.map((t) => (
          <Link
            key={t.id}
            href={`/tasks/${t.id}`}
            className="rounded-full border border-border bg-card px-3 py-1 text-sm hover:border-primary hover:text-primary"
          >
            {t.title}
          </Link>
        ))}
      </div>
    </div>
  );
}
