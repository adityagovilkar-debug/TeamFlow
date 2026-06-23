import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import {
  getLabels,
  getProfiles,
  getStatuses,
  getTeams,
  getTemplates,
} from "@/lib/data";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import type { Profile, Team, TeamWithMembers } from "@/lib/types";
import { AdminView } from "@/components/admin/admin-view";

/**
 * Admins manage all teams here — including private ones they can't see via RLS — so
 * this list is fetched with the service role (this page is already admin-gated).
 */
async function getAdminTeams(): Promise<TeamWithMembers[]> {
  if (!isServiceRoleConfigured()) {
    const visible = await getTeams();
    return visible.map((t) => ({ ...t, members: [] }));
  }
  const admin = createAdminClient();
  const { data } = await admin
    .from("teams")
    .select("*, members:team_members(profile:profiles(*))")
    .order("name", { ascending: true });
  type Raw = Team & { members: { profile: Profile }[] | null };
  return ((data as Raw[]) ?? []).map((t) => ({
    ...t,
    members: (t.members ?? []).map((m) => m.profile).filter(Boolean),
  }));
}

export default async function AdminPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/dashboard");

  const [profiles, teams, statuses, labels, templates] = await Promise.all([
    getProfiles(),
    getAdminTeams(),
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
