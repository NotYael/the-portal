"use server";

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabaseConfigured } from "@/lib/supabase/config";
import { supabaseServer } from "@/lib/supabase/server";

export type PasswordCheck = { ok: true } | { ok: false; error: string };

/**
 * Checks the signed-in user's password, for the "Hide amounts" switch.
 * Runs on the server so the test sign-in never touches the browser's session.
 */
export async function checkPassword(password: unknown): Promise<PasswordCheck> {
  if (typeof password !== "string" || !password) return { ok: false, error: "Enter your password." };
  // Demo mode has no real accounts, so any password works.
  if (!supabaseConfigured) return { ok: true };

  const { data } = await (await supabaseServer()).auth.getClaims();
  const email = data?.claims.email;
  if (!email) return { ok: false, error: "Your session has ended. Log in again." };

  // A throwaway client that keeps nothing: signing in here mustn't swap the user's session cookies.
  const checker = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error } = await checker.auth.signInWithPassword({ email, password });
  if (error) {
    return {
      ok: false,
      error:
        error.code === "invalid_credentials"
          ? "That password isn’t right."
          : error.status === 429
            ? "Too many attempts. Wait a minute and try again."
            : "Couldn’t check your password right now. Try again.",
    };
  }
  // Revoke the extra session this check created.
  await checker.auth.signOut({ scope: "local" });
  return { ok: true };
}
