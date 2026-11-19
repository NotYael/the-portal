import { createClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { SUPABASE_URL } from "./config";

/**
 * Supabase with the secret key, for the crons only. It bypasses row-level
 * security, so every query must filter by user_id itself. Never import it
 * from client code: SUPABASE_SERVICE_ROLE_KEY has no NEXT_PUBLIC_ prefix, so
 * it would be undefined in the browser anyway.
 */
export function supabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !key) return null;
  return createClient<Database>(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type SupabaseAdmin = NonNullable<ReturnType<typeof supabaseAdmin>>;
