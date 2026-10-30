/**
 * Supabase connection, from .env.local. Both values are safe in the browser:
 * the publishable key only reaches rows that row-level security allows.
 * Without them the Portal runs in demo mode (mock login and data).
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
