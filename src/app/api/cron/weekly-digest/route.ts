import { connection } from "next/server";
import { startOfWeek, todayInManila } from "@/lib/dates";
import { buildDigest } from "@/lib/digest";
import { cronAuthorized, runWeeklyDigest } from "@/lib/digest-cron";
import { loadDigestSource } from "@/lib/digest-source";
import { digestEmail } from "@/lib/email/digest-email";
import { sendEmail } from "@/lib/email/resend";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const maxDuration = 60;

/**
 * The Sunday digest, called by Vercel Cron (vercel.json: Sunday 12:00 UTC =
 * 8:00 PM Manila). Sends to DIGEST_TO_EMAIL once per week: the digest_runs row
 * is claimed before sending, and its one-send-per-week index stops a second
 * run. `?dryRun=1` builds the digest and returns it without sending or logging.
 */
export async function GET(request: Request) {
  // Always run at request time, never prerendered.
  await connection();
  if (!cronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  const userId = process.env.ALLOWED_USER_ID;
  const supabase = supabaseAdmin();
  if (!userId || !supabase) {
    return Response.json(
      { error: "Set ALLOWED_USER_ID, NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." },
      { status: 500 },
    );
  }

  const url = new URL(request.url);
  const today = todayInManila();
  if (url.searchParams.get("dryRun") === "1") {
    const source = await loadDigestSource(supabase, userId, today);
    if (!source) return Response.json({ error: "Couldn’t load this week’s data." }, { status: 500 });
    return Response.json({ dryRun: true, weekStart: startOfWeek(today), digest: buildDigest(source.state, today, source.reminders) });
  }

  const result = await runWeeklyDigest(
    {
      async claim(weekStart) {
        // While sending, the row reads status 'sent' with no sent_at yet.
        const { data, error } = await supabase
          .from("digest_runs")
          .insert({ user_id: userId, week_start: weekStart, status: "sent" })
          .select("id")
          .single();
        if (error?.code === "23505") return "taken";
        if (error || !data) return { error: "Couldn’t record the send in digest_runs." };
        return { id: data.id };
      },
      load: () => loadDigestSource(supabase, userId, today),
      send: (digest) => sendEmail(digestEmail(digest, url.origin)),
      async finish(id, outcome) {
        await supabase
          .from("digest_runs")
          .update(
            outcome.status === "sent"
              ? { sent_at: new Date().toISOString(), resend_id: outcome.resendId }
              : { status: "failed", error: outcome.error.slice(0, 500) },
          )
          .eq("id", id);
      },
    },
    today,
  );
  return Response.json(result, { status: result.status === "failed" ? 500 : 200 });
}
