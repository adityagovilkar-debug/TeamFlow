import Link from "next/link";
import { CheckSquare } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="app-backdrop grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex brand-gradient">
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:24px_24px]" />
        <Link href="/" className="relative flex items-center gap-2 text-xl font-bold">
          <CheckSquare className="size-6" />
          TeamFlow
        </Link>
        <div className="relative">
          <h2 className="text-3xl font-bold leading-tight">
            Plan, track, and ship work together.
          </h2>
          <p className="mt-4 max-w-md text-white/80">
            A lightweight, modern task manager for small teams — tasks,
            priorities, watchers, roles, reporting, and a calendar, all in one
            clean workspace.
          </p>
          <ul className="mt-8 space-y-2 text-sm text-white/90">
            {[
              "Assign owners & watchers",
              "Role-based access (Admin / User / Viewer)",
              "Live reporting & calendar",
            ].map((f) => (
              <li key={f} className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-white/20">
                  ✓
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-white/60">
          © {new Date().getFullYear()} TeamFlow
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
