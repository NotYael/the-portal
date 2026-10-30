import { acceptAnswer, AI_MESSAGES, ASK_SCHEMA, ASK_SYSTEM, askPrompt, askRequest } from "@/lib/ai/expense-ai";
import { generateJson } from "@/lib/ai/gemini";
import { AI_REQUESTS_PER_MINUTE, rateLimit, readBody, requireUser } from "@/lib/api/guard";

/** Answers a question from the selected month's rows plus six months of totals. No fallback answer. */
export async function POST(request: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const limited = rateLimit(`ai:${user.id}`, AI_REQUESTS_PER_MINUTE);
  if (limited) return limited;
  const body = await readBody(request, askRequest);
  if (body instanceof Response) return body;

  const ai = await generateJson({
    system: ASK_SYSTEM,
    prompt: askPrompt(body.question, body.data),
    responseSchema: ASK_SCHEMA,
    accept: acceptAnswer,
  });
  if (ai.ok) return Response.json({ answer: ai.data });
  return Response.json({ error: AI_MESSAGES[ai.reason] }, { status: ai.reason === "busy" ? 429 : 503 });
}
