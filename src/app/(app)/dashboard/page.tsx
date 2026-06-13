import { getCurrentProfile } from "@/lib/auth";
import { getProfiles, getStatuses, getTasks, getTeams } from "@/lib/data";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export default async function DashboardPage() {
  const [profile, tasks, statuses, teams, profiles] = await Promise.all([
    getCurrentProfile(),
    getTasks(),
    getStatuses(),
    getTeams(),
    getProfiles(),
  ]);

  return (
    <DashboardView
      name={profile?.full_name || profile?.email || "there"}
      tasks={tasks}
      statuses={statuses}
      teams={teams}
      profiles={profiles}
    />
  );
}
