import type { z } from "zod";
import { supabaseConfigured } from "../supabase/config";
import { supabaseServer } from "../supabase/server";

/**
 * Shared checks for the API routes. Each returns a Response to send back
 * when the request can't go on.
 */

/** The signed-in user; with ALLOWED_USER_ID set, only that user. */
export async function requireUser(): Promise<{ id: string } | Response> {
  if (!supabaseConfigured) return Response.json({ error: "AI needs the Supabase login (demo mode)." }, { status: 503 });
  const { data } = await (await supabaseServer()).auth.getClaims();
  const id = data?.claims.sub;
  if (!id) return Response.json({ error: "Your session has ended. Log in again." }, { status: 401 });
  const allowed = process.env.ALLOWED_USER_ID;
  if (allowed && id !== allowed) return Response.json({ error: "Not allowed." }, { status: 403 });
  return { id };
}

const MAX_BODY_BYTES = 256 * 1024;

/** Reads and validates a JSON body. */
export async function readBody<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T> | Response> {
  const size = Number(request.headers.get("content-length") ?? 0);
  if (size > MAX_BODY_BYTES) return Response.json({ error: "Request too large." }, { status: 413 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  return parsed.data;
}

// In memory, so per server instance: enough to stop a stuck loop or a
// double-click from burning the free Gemini quota, not a hard guarantee.
const hits = new Map<string, number[]>();

/** A 429 when `key` has had `limit` requests in the last `windowMs`; otherwise records this one. */
export function rateLimit(key: string, limit: number, windowMs = 60_000, now = Date.now()): Response | null {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    const retryAfter = Math.ceil((windowMs - (now - recent[0])) / 1000);
    return Response.json(
      { error: `Too many requests. Try again in ${retryAfter}s.` },
      { status: 429, headers: { "retry-after": String(retryAfter) } },
    );
  }
  recent.push(now);
  hits.set(key, recent);
  return null;
}

/** Every AI route shares this budget per user. */
export const AI_REQUESTS_PER_MINUTE = 12;
