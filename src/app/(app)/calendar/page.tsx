import { getCurrentProfile } from "@/lib/auth";
import { getTasks } from "@/lib/data";
import { CalendarView } from "@/components/calendar/calendar-view";

export default async function CalendarPage() {
  const [profile, tasks] = await Promise.all([
    getCurrentProfile(),
    getTasks(),
  ]);

  return <CalendarView role={profile!.role} tasks={tasks} />;
}
