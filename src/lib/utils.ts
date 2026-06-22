import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Per-user color palette — deliberately distinct from the app's brand/status
 * swatches (deeper, more varied hues) so people are easy to tell apart.
 */
export const AVATAR_PALETTE = [
  "#dc2626", // red
  "#ea580c", // orange
  "#ca8a04", // gold
  "#16a34a", // green
  "#0d9488", // teal
  "#0ea5e9", // sky
  "#4f46e5", // indigo
  "#9333ea", // purple
  "#db2777", // pink
  "#65a30d", // olive
];

/** Deterministic color from a string, drawn from AVATAR_PALETTE. */
export function colorFromString(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = input.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

/** A user's display color: their custom color if set, else an auto palette color. */
export function userColor(
  seed: string | null | undefined,
  custom?: string | null,
): string {
  return custom?.trim() || colorFromString(seed || "?");
}

export function initials(name: string | null | undefined, fallback = "?"): string {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
