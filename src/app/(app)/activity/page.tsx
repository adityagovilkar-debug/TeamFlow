import Link from "next/link";
import { History } from "lucide-react";
import { getActivity } from "@/lib/data";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { fmtDateTime } from "@/lib/date";

export default async function ActivityPage() {
  const activity = await getActivity(undefined, 100);

  return (
    <div>
      <PageHeader
        title="Activity"
        description="Everything happening across DrivenWise's tasks."
      />

      {activity.length === 0 ? (
        <EmptyState
          icon={History}
          title="No activity yet"
          description="Task changes, comments, and approvals will show up here."
        />
      ) : (
        <Card className="divide-y divide-border">
          {activity.map((a) => (
            <div key={a.id} className="flex items-start gap-3 p-4">
              <Avatar
                name={a.actor?.full_name}
                email={a.actor?.email}
                color={a.actor?.color}
                size={32}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug">
                  <span className="font-medium">
                    {a.actor?.full_name || a.actor?.email || "Someone"}
                  </span>{" "}
                  {a.summary}
                  {a.task && (
                    <>
                      {" — "}
                      <Link
                        href={`/tasks/${a.task.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {a.task.title}
                      </Link>
                    </>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {fmtDateTime(a.created_at)}
                </p>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
