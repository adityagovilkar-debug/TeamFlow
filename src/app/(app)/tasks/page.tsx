import { getCurrentProfile } from "@/lib/auth";
import { getProfiles, getStatuses, getTasks, getTeams } from "@/lib/data";
import { TasksView } from "@/components/tasks/tasks-view";

export default async function TasksPage() {
  const [profile, tasks, statuses, teams, profiles] = await Promise.all([
    getCurrentProfile(),
    getTasks(),
    getStatuses(),
    getTeams(),
    getProfiles(),
  ]);

  return (
    <TasksView
      role={profile!.role}
      tasks={tasks}
      statuses={statuses}
      teams={teams}
      profiles={profiles}
    />
  );
}
