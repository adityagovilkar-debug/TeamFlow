"use client";

export type Theme = "light" | "dark";

const KEY = "teamflow-theme";

/** The currently-applied theme (reads the <html> class, set by the no-FOUC script). */
export function getTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/** Apply + persist a theme. */
export function setTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // ignore (private mode, etc.)
  }
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === "dark" ? "light" : "dark";
  setTheme(next);
  return next;
}

/**
 * Inline script (stringified) that applies the saved theme before first paint,
 * avoiding a flash. Falls back to the OS preference when nothing is stored.
 */
export const THEME_INIT_SCRIPT = `(()=>{try{var t=localStorage.getItem('${KEY}');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}if(t==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`;
