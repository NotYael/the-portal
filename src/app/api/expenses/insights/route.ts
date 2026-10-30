import { acceptInsights, AI_MESSAGES, INSIGHTS_SCHEMA, INSIGHTS_SYSTEM, insightsPrompt, insightsRequest } from "@/lib/ai/expense-ai";
import { generateJson } from "@/lib/ai/gemini";
import { AI_REQUESTS_PER_MINUTE, rateLimit, readBody, requireUser } from "@/lib/api/guard";

/**
 * Insights from this month's aggregates (never rows). The page caches the
 * answer per month and data, so this only runs when the numbers change or
 * on Refresh (force), which is limited to once a minute. On failure the page
 * keeps its template insights.
 */
export async function POST(request: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const body = await readBody(request, insightsRequest);
  if (body instanceof Response) return body;
  const limited =
    (body.force ? rateLimit(`ai-refresh:${user.id}`, 1) : null) ?? rateLimit(`ai:${user.id}`, AI_REQUESTS_PER_MINUTE);
  if (limited) return limited;

  const ai = await generateJson({
    system: INSIGHTS_SYSTEM,
    prompt: insightsPrompt(body.data),
    responseSchema: INSIGHTS_SCHEMA,
    accept: acceptInsights,
    temperature: 0.5,
  });
  if (ai.ok) return Response.json({ insights: ai.data });
  return Response.json({ error: AI_MESSAGES[ai.reason] }, { status: ai.reason === "busy" ? 429 : 503 });
}
