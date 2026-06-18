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
import { BoardView } from "@/components/board/board-view";

export default async function BoardPage() {
  const [profile, tasks, statuses, teams, profiles, folders, labels, templates] =
    await Promise.all([
      getCurrentProfile(),
      getTasks(),
      getStatuses(),
      getTeams(),
      getProfiles(),
      getFolders(),
      getLabels(),
      getTemplates(),
    ]);

  return (
    <BoardView
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
