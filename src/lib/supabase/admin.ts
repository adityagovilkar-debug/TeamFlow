import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Privileged Supabase client using the service-role key. This BYPASSES Row
 * Level Security, so it must only ever be used server-side and only after the
 * caller has been verified as an admin. Never expose the service-role key to
 * the browser (it is not prefixed NEXT_PUBLIC_).
 */

export function isServiceRoleConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
