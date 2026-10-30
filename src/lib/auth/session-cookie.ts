/**
 * Frontend-only stand-in for the Supabase session. `src/proxy.ts` checks this
 * cookie to gate every route except /login. Replace with Supabase SSR auth
 * (and its session cookies) when the backend is connected.
 */
export const SESSION_COOKIE = "portal_session";

const THIRTY_DAYS = 60 * 60 * 24 * 30;

export function startMockSession() {
  document.cookie = `${SESSION_COOKIE}=demo; Path=/; Max-Age=${THIRTY_DAYS}; SameSite=Lax`;
}

export function endMockSession() {
  document.cookie = `${SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
