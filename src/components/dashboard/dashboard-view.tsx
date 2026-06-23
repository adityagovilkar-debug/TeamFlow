"use client";

import * as React from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  ListChecks,
  CircleDot,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { useRealtime } from "@/lib/use-realtime";
import { isOverdue, dueLabel } from "@/lib/date";
import { initials, userColor } from "@/lib/utils";
import {
  PRIORITIES,
  type Profile,
  type Status,
  type TaskWithRelations,
  type Team,
} from "@/lib/types";

export function DashboardView({
  name,
  tasks,
  statuses,
  teams,
  profiles,
}: {
  name: string;
  tasks: TaskWithRelations[];
  statuses: Status[];
  teams: Team[];
  profiles: Profile[];
}) {
  useRealtime(["tasks"]);
  const [teamF, setTeamF] = React.useState("");

  const scoped = teamF ? tasks.filter((t) => t.team_id === teamF) : tasks;

  const total = scoped.length;
  const done = scoped.filter((t) => t.status?.category === "done").length;
  const inProgress = scoped.filter(
    (t) => t.status?.category === "in_progress",
  ).length;
  const overdue = scoped.filter(
    (t) => isOverdue(t.due_date, t.status?.category === "done"),
  ).length;
  const dueSoon = scoped.filter((t) => {
    const tone = dueLabel(t.due_date).tone;
    return tone === "soon" && t.status?.category !== "done";
  }).length;

  // By status (for donut)
  const byStatus = statuses
    .map((s) => ({
      name: s.name,
      value: scoped.filter((t) => t.status_id === s.id).length,
      color: s.color,
    }))
    .filter((d) => d.value > 0);

  // By assignee (top, for bar)
  const byAssignee = profiles
    .map((p) => ({
      name: p.full_name || p.email,
      short: initials(p.full_name || p.email),
      value: scoped.filter((t) => t.assignee_id === p.id).length,
      color: userColor(p.email, p.color),
    }))
    .concat([
      {
        name: "No one",
        short: "—",
        value: scoped.filter((t) => !t.assignee_id).length,
        color: "#94a3b8",
      },
    ])
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  // By priority
  const byPriority = PRIORITIES.map((p) => ({
    name: p.label,
    value: scoped.filter((t) => t.priority === p.value).length,
    color: p.color.startsWith("var")
      ? { low: "#64748b", medium: "#3b82f6", high: "#f59e0b", urgent: "#ef4444" }[
          p.value
        ]
      : p.color,
  }));

  const stats = [
    { label: "Total tasks", value: total, icon: ListChecks, color: "#6366f1" },
    { label: "In progress", value: inProgress, icon: CircleDot, color: "#3b82f6" },
    { label: "Completed", value: done, icon: CheckCircle2, color: "#10b981" },
    { label: "Due soon", value: dueSoon, icon: Clock, color: "#f59e0b" },
    { label: "Overdue", value: overdue, icon: AlertTriangle, color: "#ef4444" },
  ];

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${name.split(" ")[0]} 👋`}
        description="An overview of your team's work."
      >
        <Select
          value={teamF}
          onChange={(e) => setTeamF(e.target.value)}
          className="w-auto min-w-40"
        >
          <option value="">All teams</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </PageHeader>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label} className="overflow-hidden">
            <CardContent className="p-5 pt-5">
              <div className="flex items-center justify-between">
                <span
                  className="flex size-9 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${s.color}1a`, color: s.color }}
                >
                  <s.icon className="size-5" />
                </span>
              </div>
              <p className="mt-3 text-2xl font-bold">{s.value}</p>
              <p className="text-sm text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Tasks by status</CardTitle>
          </CardHeader>
          <CardContent>
            {byStatus.length === 0 ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={byStatus}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {byStatus.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
            <Legend items={byStatus} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Tasks by responsible</CardTitle>
          </CardHeader>
          <CardContent>
            {byAssignee.length === 0 ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={byAssignee} margin={{ left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" vertical={false} />
                  <XAxis
                    dataKey="short"
                    tick={{ fontSize: 12, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(148,163,184,0.18)" }}
                    labelFormatter={(_, p) => p?.[0]?.payload?.name ?? ""}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {byAssignee.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Tasks by priority</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byPriority} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip cursor={{ fill: "rgba(148,163,184,0.18)" }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {byPriority.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Completion</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-6">
            <div className="relative flex size-36 items-center justify-center">
              <svg className="size-36 -rotate-90" viewBox="0 0 120 120">
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke="rgba(148,163,184,0.18)"
                  strokeWidth="12"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 52}`}
                  strokeDashoffset={`${
                    2 * Math.PI * 52 * (1 - (total ? done / total : 0))
                  }`}
                />
              </svg>
              <div className="absolute text-center">
                <p className="text-2xl font-bold">
                  {total ? Math.round((done / total) * 100) : 0}%
                </p>
                <p className="text-xs text-muted-foreground">complete</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {done} of {total} tasks done
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Legend({ items }: { items: { name: string; color: string; value: number }[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
      {items.map((d) => (
        <span key={d.name} className="flex items-center gap-1.5 text-xs">
          <span
            className="size-2.5 rounded-full"
            style={{ backgroundColor: d.color }}
          />
          {d.name} <span className="text-muted-foreground">({d.value})</span>
        </span>
      ))}
    </div>
  );
}

function Empty() {
  return (
    <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">
      No data yet.
    </div>
  );
}
