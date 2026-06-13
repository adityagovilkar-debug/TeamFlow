import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCurrentProfile } from "@/lib/auth";
import { Sidebar } from "@/components/app-shell/sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured()) redirect("/setup");

  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
    <div className="app-backdrop flex min-h-screen">
      <Sidebar profile={profile} />
      <main className="flex-1 min-w-0 pt-14 lg:pt-0 lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
