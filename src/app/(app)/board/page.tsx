import { getCurrentProfile } from "@/lib/auth";
import { getProfiles, getStatuses, getTasks, getTeams } from "@/lib/data";
import { BoardView } from "@/components/board/board-view";

export default async function BoardPage() {
  const [profile, tasks, statuses, teams, profiles] = await Promise.all([
    getCurrentProfile(),
    getTasks(),
    getStatuses(),
    getTeams(),
    getProfiles(),
  ]);

  return (
    <BoardView
      role={profile!.role}
      meId={profile!.id}
      tasks={tasks}
      statuses={statuses}
      teams={teams}
      profiles={profiles}
    />
  );
}
