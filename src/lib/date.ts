import { format, isPast, isToday, parseISO, differenceInCalendarDays } from "date-fns";

export function fmtDate(date: string | null | undefined): string {
  if (!date) return "—";
  return format(parseISO(date), "MMM d, yyyy");
}

export function fmtDateTime(date: string | null | undefined): string {
  if (!date) return "—";
  return format(parseISO(date), "MMM d, yyyy · h:mm a");
}

/** A due date is overdue if it's strictly in the past (before today). */
export function isOverdue(
  due: string | null | undefined,
  done = false,
): boolean {
  if (!due || done) return false;
  const d = parseISO(due);
  return isPast(d) && !isToday(d);
}

export function dueLabel(due: string | null | undefined): {
  text: string;
  tone: "overdue" | "soon" | "normal" | "none";
} {
  if (!due) return { text: "No due date", tone: "none" };
  const d = parseISO(due);
  const days = differenceInCalendarDays(d, new Date());
  if (days < 0) return { text: fmtDate(due), tone: "overdue" };
  if (days === 0) return { text: "Today", tone: "soon" };
  if (days === 1) return { text: "Tomorrow", tone: "soon" };
  if (days <= 3) return { text: `In ${days} days`, tone: "soon" };
  return { text: fmtDate(due), tone: "normal" };
}
