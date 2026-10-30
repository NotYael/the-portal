import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "./lib/auth/session-cookie";
import { supabaseConfigured } from "./lib/supabase/config";
import { updateSession } from "./lib/supabase/proxy";

/**
 * Auth gate: every route except /login needs a session, and /login sends
 * signed-in users home. The session is Supabase's when it's configured,
 * otherwise demo mode's mock cookie.
 */
export async function proxy(request: NextRequest) {
  const { response, signedIn } = supabaseConfigured
    ? await updateSession(request)
    : { response: NextResponse.next(), signedIn: request.cookies.has(SESSION_COOKIE) };
  const { pathname, search } = request.nextUrl;

  if (pathname === "/login") {
    return signedIn ? redirect(new URL("/", request.url), response) : response;
  }

  if (!signedIn) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return redirect(url, response);
  }

  return response;
}

/** A redirect that keeps any session cookies the refresh just set. */
function redirect(url: URL, from: NextResponse) {
  const to = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie));
  return to;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
