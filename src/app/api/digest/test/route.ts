import { summarizeDigest } from "@/lib/ai/digest-ai";
import { rateLimit, readBody, requireUser } from "@/lib/api/guard";
import { digestDataSchema, digestEmail } from "@/lib/email/digest-email";
import { sendEmail } from "@/lib/email/resend";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * "Send test" on /digest: emails the digest the page built to the owner,
 * marked [Test], with Gemini's subject and note like the Sunday cron.
 */
export async function POST(request: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const limited = rateLimit(`email:${user.id}`, 3);
  if (limited) return limited;
  const digest = await readBody(request, digestDataSchema);
  if (digest instanceof Response) return digest;

  // The journal setting decides whether Win and Target text may go to Gemini; off unless it reads true.
  const { data: profile } = await (await supabaseServer())
    .from("profiles")
    .select("journal_ai_summary_enabled")
    .eq("user_id", user.id)
    .maybeSingle();
  const { digest: final, source } = await summarizeDigest(digest, profile?.journal_ai_summary_enabled === true);

  const sent = await sendEmail(digestEmail(final, new URL(request.url).origin, { test: true }));
  if (!sent.ok) return Response.json({ error: `Couldn’t send the test: ${sent.error}` }, { status: 502 });
  return Response.json({ id: sent.id, to: sent.to, ai: source === "ai" });
}
