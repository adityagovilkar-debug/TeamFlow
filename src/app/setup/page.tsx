import { redirect } from "next/navigation";
import { CheckCircle2, Database, KeyRound, Rocket } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function SetupPage() {
  if (isSupabaseConfigured()) redirect("/login");

  const steps = [
    {
      icon: Database,
      title: "Create a free Supabase project",
      body: "Go to supabase.com → New project. Pick a name and a strong database password, then wait ~1 minute for it to provision.",
    },
    {
      icon: KeyRound,
      title: "Copy your API keys into .env.local",
      body: "Project Settings → API. Copy the Project URL and the anon public key into teamflow/.env.local (NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY), then restart the dev server.",
    },
    {
      icon: CheckCircle2,
      title: "Run the database schema",
      body: "Open the SQL Editor in Supabase, paste the contents of supabase/schema.sql, and click Run. This creates all tables, security rules, and seed data.",
    },
    {
      icon: Rocket,
      title: "Sign up — you become the Admin",
      body: "Reload this app and create your account. The first account is automatically an Admin; teammates who sign up after default to Viewer until you promote them.",
    },
  ];

  return (
    <div className="app-backdrop flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl brand-gradient shadow-lg">
            <Rocket className="size-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome to <span className="brand-text">TeamFlow</span>
          </h1>
          <p className="mt-2 text-muted-foreground">
            Four quick steps to connect your shared database and go live.
          </p>
        </div>

        <ol className="space-y-3">
          {steps.map((s, i) => (
            <li
              key={i}
              className="flex gap-4 rounded-xl border border-border bg-card p-5 shadow-sm"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <s.icon className="size-5" />
              </div>
              <div>
                <h3 className="font-semibold">
                  {i + 1}. {s.title}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Full deployment instructions are in{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
            teamflow/README.md
          </code>
          .
        </p>
      </div>
    </div>
  );
}
