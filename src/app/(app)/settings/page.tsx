import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { isEmailConfigured } from "@/lib/email";
import { SettingsView } from "@/components/settings/settings-view";

export default async function SettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return <SettingsView profile={profile} emailConfigured={isEmailConfigured()} />;
}
