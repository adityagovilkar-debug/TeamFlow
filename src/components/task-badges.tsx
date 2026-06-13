import { ArrowDown, ArrowUp, Minus, ChevronsUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Priority, Status } from "@/lib/types";

const PRIORITY_META: Record<
  Priority,
  { label: string; color: string; icon: React.ElementType }
> = {
  low: { label: "Low", color: "#64748b", icon: ArrowDown },
  medium: { label: "Medium", color: "#3b82f6", icon: Minus },
  high: { label: "High", color: "#f59e0b", icon: ArrowUp },
  urgent: { label: "Urgent", color: "#ef4444", icon: ChevronsUp },
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  const meta = PRIORITY_META[priority];
  const Icon = meta.icon;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${meta.color}1a`, color: meta.color }}
    >
      <Icon className="size-3" />
      {meta.label}
    </span>
  );
}

export function StatusBadge({ status }: { status: Status | null }) {
  if (!status)
    return (
      <Badge className="bg-muted text-muted-foreground border-border">
        No status
      </Badge>
    );
  return <Badge color={status.color}>{status.name}</Badge>;
}
