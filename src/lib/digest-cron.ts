/**
 * The Sunday digest cron (docs/PORTAL_SPEC.md → Weekly digest and cron jobs):
 * build this week's digest from the database and email it once. The route
 * (app/api/cron/weekly-digest) wires these steps to Supabase and Resend; here
 * they're plain functions so the order of claim → load → send → finish is tested.
 */
import { timingSafeEqual } from "node:crypto";
import type { PortalState } from "./data/portal-state";
import { startOfWeek } from "./dates";
import { buildDigest, type DigestData } from "./digest";
import type { SendResult } from "./email/resend";
import type { ISODate, Reminder } from "./types";

/** Vercel sends `Authorization: Bearer $CRON_SECRET` with every cron call. No secret set = nobody gets in. */
export function cronAuthorized(header: string | null, secret: string | undefined): boolean {
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const got = Buffer.from(header ?? "");
  return got.length === expected.length && timingSafeEqual(got, expected);
}

/** What buildDigest needs, read from the database. */
export interface DigestSource {
  state: PortalState;
  reminders: Reminder[];
}

export type Claim = { id: string } | "taken" | { error: string };
export type Outcome = { status: "sent"; resendId: string } | { status: "failed"; error: string };

export interface DigestCronSteps {
  /**
   * Reserves this week's send before anything goes out, so two runs can't both
   * send: "taken" when the week was already sent (or is being sent right now).
   */
  claim(weekStart: ISODate): Promise<Claim>;
  load(): Promise<DigestSource | null>;
  send(digest: DigestData): Promise<SendResult>;
  /** Records how it went; a failed send frees the week, so the next run can try again. */
  finish(id: string, outcome: Outcome): Promise<void>;
}

export type DigestCronResult =
  | { status: "sent"; weekStart: ISODate; resendId: string }
  | { status: "already-sent"; weekStart: ISODate }
  | { status: "failed"; weekStart: ISODate; error: string };

/** The digest for the week (Monday to Sunday, Manila) that `today` falls in. */
export async function runWeeklyDigest(steps: DigestCronSteps, today: ISODate): Promise<DigestCronResult> {
  const weekStart = startOfWeek(today);
  const claim = await steps.claim(weekStart);
  if (claim === "taken") return { status: "already-sent", weekStart };
  if ("error" in claim) return { status: "failed", weekStart, error: claim.error };

  const fail = async (error: string): Promise<DigestCronResult> => {
    await steps.finish(claim.id, { status: "failed", error });
    return { status: "failed", weekStart, error };
  };
  try {
    const source = await steps.load();
    if (!source) return await fail("Couldn’t load this week’s data.");
    const sent = await steps.send(buildDigest(source.state, today, source.reminders));
    if (!sent.ok) return await fail(sent.error);
    await steps.finish(claim.id, { status: "sent", resendId: sent.id });
    return { status: "sent", weekStart, resendId: sent.id };
  } catch {
    return await fail("The digest crashed before it was sent.");
  }
}
