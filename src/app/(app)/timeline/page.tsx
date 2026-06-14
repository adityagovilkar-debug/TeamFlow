import { getTasks, getTeams } from "@/lib/data";
import { TimelineView } from "@/components/timeline/timeline-view";

export default async function TimelinePage() {
  const [tasks, teams] = await Promise.all([getTasks(), getTeams()]);

  return <TimelineView tasks={tasks} teams={teams} />;
}
