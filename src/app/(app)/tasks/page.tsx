import { getCurrentProfile } from "@/lib/auth";
import {
  getFolders,
  getLabels,
  getProfiles,
  getStatuses,
  getTasks,
  getTeams,
  getTemplates,
} from "@/lib/data";
import { TasksView } from "@/components/tasks/tasks-view";

export default async function TasksPage() {
  const [profile, tasks, statuses, teams, profiles, folders, labels, templates] =
    await Promise.all([
      getCurrentProfile(),
      getTasks({ includeArchived: true }),
      getStatuses(),
      getTeams(),
      getProfiles(),
      getFolders(),
      getLabels(),
      getTemplates(),
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
      labels={labels}
      templates={templates}
    />
  );
}
