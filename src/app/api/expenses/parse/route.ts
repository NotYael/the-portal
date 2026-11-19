import { acceptParsed, AI_MESSAGES, PARSE_SCHEMA, PARSE_SYSTEM, PARSE_TIME_LIMIT, parsePrompt, parseRequest } from "@/lib/ai/expense-ai";
import { generateJson } from "@/lib/ai/gemini";
import { AI_REQUESTS_PER_MINUTE, rateLimit, readBody, requireUser } from "@/lib/api/guard";
import { todayInManila } from "@/lib/dates";
import { parseExpensesWithRules } from "@/lib/expense-parser";

/**
 * Quick add: splits and categorizes a typed note. Gemini only sees the text.
 * Falls back to the rule parser (source: "rules") when every model fails or
 * the short PARSE_TIME_LIMIT runs out.
 */
export async function POST(request: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const limited = rateLimit(`ai:${user.id}`, AI_REQUESTS_PER_MINUTE);
  if (limited) return limited;
  const body = await readBody(request, parseRequest);
  if (body instanceof Response) return body;

  const today = todayInManila();
  const ai = await generateJson({
    system: PARSE_SYSTEM,
    prompt: parsePrompt(body.text, today),
    responseSchema: PARSE_SCHEMA,
    accept: (raw) => acceptParsed(raw, today),
    timeLimit: PARSE_TIME_LIMIT,
  });
  if (ai.ok) return Response.json({ items: ai.data, source: "ai" });

  const rules = parseExpensesWithRules(body.text, today);
  return Response.json({ ...rules, notice: AI_MESSAGES[ai.reason] });
}
