/**
 * The Gemini-written parts of the weekly digest (docs/PORTAL_SPEC.md → Weekly
 * digest): the subject line and the summary note, from aggregates only.
 * Win and Target entries go to Gemini only when the journal setting is on
 * (profiles.journal_ai_summary_enabled, off by default), and then only to be
 * tidied, never added to. When every model fails, the template digest from
 * lib/digest.ts is sent as it is.
 */
import { z } from "zod";
import type { DigestData } from "../digest";
import { generateJson, type AiResult, type GenerateRequest } from "./gemini";

/** What Gemini sees: counts and totals; journal text only with the opt-in. */
export function digestAiData(digest: DigestData, includeJournal: boolean) {
  const { expenses, goals, jobs, reminders } = digest;
  return {
    week: digest.week,
    dates: digest.rangeLabel,
    spending: expenses
      ? {
          thisWeek: Math.round(expenses.thisWeek),
          sameDaysLastWeek: Math.round(expenses.lastWeek),
          change: Math.round(expenses.diff),
          monthBudgetUsedPct: expenses.monthUsedPct,
          topCategoryThisMonth: expenses.topCategory,
        }
      : null,
    goals: { onTrack: goals.onTrack, total: goals.total, behindAreas: goals.behind },
    jobs: { newMatches: jobs.fresh, bestMatchPct: jobs.topMatch },
    reminders: { dueInWeekAhead: reminders.filter((r) => !r.overdue).length, overdue: reminders.filter((r) => r.overdue).length },
    journal: includeJournal ? { wins: digest.wins, targets: digest.targets } : { winCount: digest.wins.length, targetCount: digest.targets.length },
  };
}

export const DIGEST_SYSTEM = `You write the weekly recap email for one person's private dashboard: spending in Philippine pesos, yearly goals, a job search and reminders.
Return:
- subject: one line of at most 70 characters that starts with "Week <week>:" and names the one or two things that stand out.
- note: 2 or 3 sentences, at most 60 words, summing up the week. Cite figures as given, pesos like ₱1,240 (no centavos).
- wins and targets: only when journal entries are given, rewrite each entry as a short bullet of at most 20 words that keeps its meaning, in the same order and the same number. Never add, merge or drop entries. When only counts are given, return empty lists.
Use only facts in the data. Never invent numbers, names or events. Plain, warm, neutral tone: no lecturing, no advice, no emoji.
A null section means that module is off: leave it out.`;

export function digestPrompt(data: ReturnType<typeof digestAiData>): string {
  return `This week's data:\n${JSON.stringify(data, null, 1)}`;
}

export const DIGEST_SCHEMA = {
  type: "OBJECT",
  properties: {
    subject: { type: "STRING" },
    note: { type: "STRING" },
    wins: { type: "ARRAY", items: { type: "STRING" } },
    targets: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["subject", "note", "wins", "targets"],
};

export type DigestAi = Pick<DigestData, "subject" | "note" | "wins" | "targets">;

const bullet = z.string().trim().min(3).max(200);

/** Checks Gemini's answer against the digest it was given; null rejects it. */
export function acceptDigest(raw: unknown, digest: DigestData, includeJournal: boolean): DigestAi | null {
  const parsed = z
    .object({
      subject: z.string().trim().min(8).max(90),
      note: z.string().trim().min(20).max(600),
      wins: z.array(bullet),
      targets: z.array(bullet),
    })
    .safeParse(raw);
  if (!parsed.success) return null;
  const { subject, note, wins, targets } = parsed.data;
  if (!subject.startsWith(`Week ${digest.week}:`)) return null;
  if (!includeJournal) return { subject, note, wins: digest.wins, targets: digest.targets };
  // Tidied, never added to or dropped: one bullet per entry.
  if (wins.length !== digest.wins.length || targets.length !== digest.targets.length) return null;
  return { subject, note, wins, targets };
}

export type DigestSummary = { digest: DigestData; source: "ai" | "template" };

/** The digest with Gemini's subject, note and (opt-in) bullets; the template one when AI isn't available. */
export async function summarizeDigest(
  digest: DigestData,
  includeJournal: boolean,
  generate: <T>(request: GenerateRequest<T>) => Promise<AiResult<T>> = generateJson,
): Promise<DigestSummary> {
  const ai = await generate({
    system: DIGEST_SYSTEM,
    prompt: digestPrompt(digestAiData(digest, includeJournal)),
    responseSchema: DIGEST_SCHEMA,
    accept: (raw) => acceptDigest(raw, digest, includeJournal),
    temperature: 0.5,
  });
  return ai.ok ? { digest: { ...digest, ...ai.data }, source: "ai" } : { digest, source: "template" };
}
