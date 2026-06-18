"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { getTheme, toggleTheme, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * Light/dark toggle. `variant="icon"` is the compact sidebar button;
 * `variant="switch"` is the labelled row used on the Settings page.
 */
export function ThemeToggle({
  variant = "icon",
}: {
  variant?: "icon" | "switch";
}) {
  const [theme, setThemeState] = React.useState<Theme>("light");
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setThemeState(getTheme());
    setMounted(true);
  }, []);

  function flip() {
    setThemeState(toggleTheme());
  }

  const isDark = theme === "dark";

  if (variant === "switch") {
    return (
      <button
        role="switch"
        aria-checked={isDark}
        onClick={flip}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer",
          isDark ? "bg-primary" : "bg-muted-foreground/30",
        )}
        title="Toggle dark mode"
      >
        <span
          className={cn(
            "inline-block size-5 transform rounded-full bg-white shadow transition-transform",
            isDark ? "translate-x-[22px]" : "translate-x-[2px]",
          )}
        />
      </button>
    );
  }

  return (
    <button
      onClick={flip}
      className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle theme"
    >
      {/* avoid hydration mismatch: render a stable icon until mounted */}
      {!mounted ? (
        <Sun className="size-4" />
      ) : isDark ? (
        <Sun className="size-4" />
      ) : (
        <Moon className="size-4" />
      )}
    </button>
  );
}
