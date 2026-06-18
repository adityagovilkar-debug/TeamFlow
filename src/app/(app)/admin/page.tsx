import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import {
  getLabels,
  getProfiles,
  getStatuses,
  getTeams,
  getTemplates,
} from "@/lib/data";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";
import { AdminView } from "@/components/admin/admin-view";

export default async function AdminPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/dashboard");

  const [profiles, teams, statuses, labels, templates] = await Promise.all([
    getProfiles(),
    getTeams(),
    getStatuses(),
    getLabels(),
    getTemplates(),
  ]);

  return (
    <AdminView
      me={profile}
      profiles={profiles}
      teams={teams}
      statuses={statuses}
      labels={labels}
      templates={templates}
      userMgmtEnabled={isServiceRoleConfigured()}
    />
  );
}
