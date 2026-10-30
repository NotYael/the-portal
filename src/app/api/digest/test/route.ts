import { rateLimit, readBody, requireUser } from "@/lib/api/guard";
import { digestDataSchema, digestEmail } from "@/lib/email/digest-email";
import { sendEmail } from "@/lib/email/resend";

/** "Send test" on /digest: emails the digest the page built to the owner, marked [Test]. */
export async function POST(request: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const limited = rateLimit(`email:${user.id}`, 3);
  if (limited) return limited;
  const digest = await readBody(request, digestDataSchema);
  if (digest instanceof Response) return digest;

  const sent = await sendEmail(digestEmail(digest, new URL(request.url).origin, { test: true }));
  if (!sent.ok) return Response.json({ error: `Couldn’t send the test: ${sent.error}` }, { status: 502 });
  return Response.json({ id: sent.id });
}
