import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FolderClosed } from "lucide-react";
import { getActivity, getFolders, getTasks } from "@/lib/data";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { PriorityBadge, StatusBadge } from "@/components/task-badges";
import { fmtDate, fmtDateTime, fmtHours, isOverdue } from "@/lib/date";
import { folderWithDescendants, type Priority } from "@/lib/types";

export default async function FolderDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [folders, allTasks, activity] = await Promise.all([
    getFolders(),
    getTasks({ includeArchived: false }),
    getActivity(undefined, 100),
  ]);

  const folder = folders.find((f) => f.id === id);
  if (!folder) notFound();

  const ids = folderWithDescendants(id, folders);
  const tasks = allTasks.filter((t) => t.folder_id && ids.has(t.folder_id));

  const total = tasks.length;
  const done = tasks.filter((t) => t.status?.category === "done").length;
  const overdue = tasks.filter((t) =>
    isOverdue(t.due_date, t.status?.category === "done"),
  ).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const estMin = tasks.reduce((n, t) => n + (t.estimate_minutes ?? 0), 0);
  const logMin = tasks.reduce((n, t) => n + (t.time_logged_minutes ?? 0), 0);

  const taskIds = new Set(tasks.map((t) => t.id));
  const recent = activity.filter((a) => a.task_id && taskIds.has(a.task_id)).slice(0, 12);

  const stats = [
    { label: "Open", value: total - done },
    { label: "Completed", value: done },
    { label: "Overdue", value: overdue },
    { label: "Logged", value: fmtHours(logMin) },
    { label: "Estimated", value: fmtHours(estMin) },
  ];

  return (
    <div>
      <Link
        href="/tasks"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to tasks
      </Link>

      <div className="mt-2 mb-6 flex items-center gap-3">
        <span
          className="flex size-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${folder.color}1a`, color: folder.color }}
        >
          <FolderClosed className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{folder.name}</h1>
          <p className="text-sm text-muted-foreground">
            {total} task{total === 1 ? "" : "s"} · {pct}% complete
          </p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-sm text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} />
      </div>
      <p className="mb-6 text-xs text-muted-foreground">
        {done} of {total} tasks done
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Tasks */}
        <div className="lg:col-span-2">
          <h3 className="mb-2 font-semibold">Tasks</h3>
          {tasks.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                No tasks in this folder yet.
              </CardContent>
            </Card>
          ) : (
            <Card className="divide-y divide-border">
              {tasks.map((t) => (
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
                    </div>
                  </div>
                  {t.due_date && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {fmtDate(t.due_date)}
                    </span>
                  )}
                  {t.assignee && (
                    <Avatar
                      name={t.assignee.full_name}
                      email={t.assignee.email}
                      color={t.assignee.color}
                      size={24}
                    />
                  )}
                </Link>
              ))}
            </Card>
          )}
        </div>

        {/* Recent activity */}
        <div>
          <h3 className="mb-2 font-semibold">Recent activity</h3>
          <Card className="p-4">
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity.</p>
            ) : (
              <ul className="space-y-3">
                {recent.map((a) => (
                  <li key={a.id} className="text-sm">
                    <span className="font-medium">
                      {a.actor?.full_name || a.actor?.email || "Someone"}
                    </span>{" "}
                    {a.summary}
                    <p className="text-xs text-muted-foreground">
                      {fmtDateTime(a.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
