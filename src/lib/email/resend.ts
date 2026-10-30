/** Sends email to the owner through Resend's REST API (server only: it reads RESEND_API_KEY). */
import { DIGEST_FROM, DIGEST_TO } from "./addresses";

const TIMEOUT_MS = 15_000;

export type SendResult = { ok: true; id: string } | { ok: false; error: string };

export async function sendEmail(
  message: { subject: string; html: string; text: string },
  apiKey = process.env.RESEND_API_KEY,
): Promise<SendResult> {
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY isn’t set." };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from: DIGEST_FROM, to: [DIGEST_TO], ...message }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
    if (!res.ok || !body?.id) return { ok: false, error: body?.message ?? `Resend answered HTTP ${res.status}.` };
    return { ok: true, id: body.id };
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    return { ok: false, error: timedOut ? "Resend didn’t answer in time." : "Couldn’t reach Resend." };
  }
}
