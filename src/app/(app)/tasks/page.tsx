import { getCurrentProfile } from "@/lib/auth";
import {
  getFolders,
  getProfiles,
  getStatuses,
  getTasks,
  getTeams,
} from "@/lib/data";
import { TasksView } from "@/components/tasks/tasks-view";

export default async function TasksPage() {
  const [profile, tasks, statuses, teams, profiles, folders] =
    await Promise.all([
      getCurrentProfile(),
      getTasks({ includeArchived: true }),
      getStatuses(),
      getTeams(),
      getProfiles(),
      getFolders(),
    ]);

  return (
    <TasksView
      role={profile!.role}
      meId={profile!.id}
      tasks={tasks}
      statuses={statuses}
      teams={teams}
      profiles={profiles}
      folders={folders}
    />
  );
}
