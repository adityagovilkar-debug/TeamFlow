import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { getProfiles, getStatuses, getTeams } from "@/lib/data";
import { AdminView } from "@/components/admin/admin-view";

export default async function AdminPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/dashboard");

  const [profiles, teams, statuses] = await Promise.all([
    getProfiles(),
    getTeams(),
    getStatuses(),
  ]);

  return (
    <AdminView
      me={profile}
      profiles={profiles}
      teams={teams}
      statuses={statuses}
    />
  );
}
