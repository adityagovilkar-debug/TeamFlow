"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ListChecks,
  KanbanSquare,
  CalendarDays,
  Shield,
  Settings,
  CheckSquare,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, isAdmin, type Profile } from "@/lib/types";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/board", label: "Board", icon: KanbanSquare },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => setOpen(false), [pathname]);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const nav = isAdmin(profile.role)
    ? [...NAV, { href: "/admin", label: "Admin", icon: Shield }]
    : NAV;

  const roleColor =
    profile.role === "admin"
      ? "#8b5cf6"
      : profile.role === "user"
        ? "#3b82f6"
        : profile.role === "contributor"
          ? "#14b8a6"
          : "#64748b";

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold">
          <span className="flex size-7 items-center justify-center rounded-lg brand-gradient text-white">
            <CheckSquare className="size-4" />
          </span>
          TeamFlow
        </Link>
        <button
          onClick={() => setOpen((o) => !o)}
          className="rounded-md p-2 hover:bg-muted cursor-pointer"
          aria-label="Toggle menu"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {/* Backdrop on mobile */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-card transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-border px-5 text-lg font-bold">
          <span className="flex size-8 items-center justify-center rounded-lg brand-gradient text-white shadow">
            <CheckSquare className="size-5" />
          </span>
          <span className="brand-text">TeamFlow</span>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {nav.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <item.icon className="size-4.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <Avatar name={profile.full_name} email={profile.email} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {profile.full_name || profile.email}
              </p>
              <Badge color={roleColor} className="mt-0.5 px-1.5 py-0">
                {ROLE_LABELS[profile.role]}
              </Badge>
            </div>
            <button
              onClick={signOut}
              className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-destructive cursor-pointer"
              title="Sign out"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
