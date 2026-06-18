"use client";

import * as React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader } from "@/components/ui/page-header";
import { useRealtime } from "@/lib/use-realtime";
import { fmtHours, isOverdue, dueLabel } from "@/lib/date";
import { initials } from "@/lib/utils";
import { type Profile, type TaskWithRelations } from "@/lib/types";

export function WorkloadView({
  tasks,
  profiles,
}: {
  tasks: TaskWithRelations[];
  profiles: Profile[];
}) {
  useRealtime(["tasks", "time_entries"]);

  const rows = profiles
    .map((p) => {
      const mine = tasks.filter((t) => t.assignee_id === p.id);
      const open = mine.filter((t) => t.status?.category !== "done");
      return {
        profile: p,
        short: initials(p.full_name || p.email),
        total: mine.length,
        open: open.length,
        overdue: mine.filter((t) =>
          isOverdue(t.due_date, t.status?.category === "done"),
        ).length,
        soon: mine.filter(
          (t) =>
            dueLabel(t.due_date).tone === "soon" &&
            t.status?.category !== "done",
        ).length,
        todo: mine.filter((t) => t.status?.category === "todo").length,
        in_progress: mine.filter((t) => t.status?.category === "in_progress")
          .length,
        done: mine.filter((t) => t.status?.category === "done").length,
        estMin: mine.reduce((n, t) => n + (t.estimate_minutes ?? 0), 0),
        logMin: mine.reduce((n, t) => n + (t.time_logged_minutes ?? 0), 0),
      };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.open - a.open);

  return (
    <div>
      <PageHeader
        title="Workload"
        description="Who's carrying what — open tasks and hours per person."
      />

      {rows.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Tasks by person & status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={rows} margin={{ left: -20 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(148,163,184,0.18)"
                  vertical={false}
                />
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
                  cursor={{ fill: "rgba(148,163,184,0.12)" }}
                  labelFormatter={(_, p) => p?.[0]?.payload?.profile?.full_name ?? ""}
                />
                <Legend />
                <Bar dataKey="todo" stackId="s" name="To do" fill="#94a3b8" radius={[0, 0, 0, 0]} />
                <Bar dataKey="in_progress" stackId="s" name="In progress" fill="#3b82f6" />
                <Bar dataKey="done" stackId="s" name="Done" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs font-medium text-muted-foreground">
              <th className="px-4 py-3">Member</th>
              <th className="px-4 py-3">Open</th>
              <th className="px-4 py-3">Overdue</th>
              <th className="px-4 py-3">Due soon</th>
              <th className="px-4 py-3">Estimated</th>
              <th className="px-4 py-3">Logged</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  No assigned tasks yet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.profile.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-2">
                    <Avatar
                      name={r.profile.full_name}
                      email={r.profile.email}
                      size={26}
                    />
                    {r.profile.full_name || r.profile.email}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium">{r.open}</td>
                <td className="px-4 py-3">
                  {r.overdue > 0 ? (
                    <span className="font-medium text-destructive">{r.overdue}</span>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {r.soon > 0 ? (
                    <span className="font-medium text-warning">{r.soon}</span>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{fmtHours(r.estMin)}</td>
                <td className="px-4 py-3 text-muted-foreground">{fmtHours(r.logMin)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
