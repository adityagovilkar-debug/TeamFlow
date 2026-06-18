"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Mail, Bell, MessageSquare, Repeat, UserPlus, TriangleAlert, Moon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { ThemeToggle } from "@/components/app-shell/theme-toggle";
import { setEmailNotifications } from "@/lib/actions";
import { ROLE_LABELS, type Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SettingsView({
  profile,
  emailConfigured,
}: {
  profile: Profile;
  emailConfigured: boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = React.useState(profile.email_notifications);
  const [saving, setSaving] = React.useState(false);

  async function toggle() {
    const next = !enabled;
    setEnabled(next); // optimistic
    setSaving(true);
    const res = await setEmailNotifications(next);
    setSaving(false);
    if (res.error) {
      setEnabled(!next); // revert
      return;
    }
    router.refresh();
  }

  const events = [
    { icon: MessageSquare, label: "New comments on tasks you follow" },
    { icon: Repeat, label: "Status changes (e.g. moved to In Progress / Done)" },
    { icon: UserPlus, label: "When you're assigned or added as a watcher" },
  ];

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Settings"
        description="Manage your account and notifications."
      />

      {/* Account */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Avatar name={profile.full_name} email={profile.email} size={44} />
            <div className="min-w-0">
              <p className="font-medium">{profile.full_name || profile.email}</p>
              <p className="truncate text-sm text-muted-foreground">
                {profile.email}
              </p>
            </div>
            <Badge className="ml-auto bg-muted text-muted-foreground border-border">
              {ROLE_LABELS[profile.role]}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Moon className="size-4" />
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
            <div className="flex items-start gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Moon className="size-5" />
              </span>
              <div>
                <p className="font-medium">Dark mode</p>
                <p className="text-sm text-muted-foreground">
                  Switch between light and dark themes.
                </p>
              </div>
            </div>
            <ThemeToggle variant="switch" />
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="size-4" />
            Email notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!emailConfigured && (
            <div className="mb-4 flex gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
              <TriangleAlert className="size-4 shrink-0 text-warning" />
              <span className="text-foreground">
                Email delivery isn&apos;t configured on the server yet. Set the
                SMTP environment variables (see README) to start sending. Your
                preference below is still saved.
              </span>
            </div>
          )}

          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
            <div className="flex items-start gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Mail className="size-5" />
              </span>
              <div>
                <p className="font-medium">Email me about my tasks</p>
                <p className="text-sm text-muted-foreground">
                  Sent to {profile.email}
                </p>
              </div>
            </div>
            <button
              role="switch"
              aria-checked={enabled}
              onClick={toggle}
              disabled={saving}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:opacity-60",
                enabled ? "bg-primary" : "bg-muted-foreground/30",
              )}
            >
              <span
                className={cn(
                  "inline-block size-5 transform rounded-full bg-white shadow transition-transform",
                  enabled ? "translate-x-[22px]" : "translate-x-[2px]",
                )}
              />
            </button>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-sm font-medium text-muted-foreground">
              You&apos;ll be emailed about:
            </p>
            <ul className="space-y-2">
              {events.map((e) => (
                <li
                  key={e.label}
                  className={cn(
                    "flex items-center gap-2 text-sm",
                    enabled ? "text-foreground" : "text-muted-foreground line-through",
                  )}
                >
                  <e.icon className="size-4 text-muted-foreground" />
                  {e.label}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              You only get emails for tasks you created, are assigned to, or are
              watching — and never for your own actions.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
