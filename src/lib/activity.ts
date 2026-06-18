import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Append an entry to the activity log. Best-effort: a failure here must never
 * break the action that triggered it. The row is written as the current user
 * (RLS requires actor_id = auth.uid()).
 */
export async function logActivity(
  supabase: SupabaseClient,
  entry: { taskId?: string | null; type: string; summary: string },
): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("activity").insert({
      task_id: entry.taskId ?? null,
      actor_id: user.id,
      type: entry.type,
      summary: entry.summary,
    });
  } catch {
    // best-effort
  }
}
