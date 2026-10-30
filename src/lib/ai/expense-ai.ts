/**
 * The three expense AI features (docs/PORTAL_SPEC.md → AI features): what the
 * page sends, what Gemini is told, and how its answers are checked. Pure, so
 * both the API routes and the Expenses page use it.
 *
 * Expenses still live in the browser (mock store), so the page builds the
 * payloads with the same stats code as the dashboard: insights get
 * aggregates only, and Ask gets the month's rows. Once expenses move to
 * Supabase, the routes should read the rows server-side instead.
 */
import { z } from "zod";
import { addDays, addMonths, isISODate, monthRange, weekdayMon0 } from "../dates";
import { MAX_PARSE_LENGTH, type ParsedExpense } from "../expense-parser";
import {
  budgetRowForMonth,
  categoryBudgetUsage,
  categoryTotals,
  expensesInMonth,
  mostFrequent,
  previousLabel,
  sumAmounts,
  type MonthInput,
  type MonthStats,
} from "../expense-stats";
import { monthLong, monthShortYear, WEEKDAYS_LONG } from "../format";
import { PAYMENT_LABELS, PAYMENT_METHODS, type CategorySlug, type ISODate } from "../types";

export const MAX_QUESTION_LENGTH = 300;

const SLUGS = ["food", "transport", "living", "gifts", "shopping", "subs", "leisure", "other"] as const satisfies readonly CategorySlug[];

const whole = (n: number) => Math.round(n);
/** 0.3141 → 31.4 */
const pct = (ratio: number) => Math.round(ratio * 1000) / 10;

const money = z.number().finite().min(0).max(1e9);
const label = z.string().trim().max(60);

// ---------- parse (quick add) ----------

export const parseRequest = z.object({ text: z.string().trim().min(1).max(MAX_PARSE_LENGTH) });

export const PARSE_SYSTEM = `You turn a short note about money someone spent into expense records for a budgeting app in the Philippines.
- Split the note into separate expenses. Notes mix English, Filipino and Taglish ("groceries sa Puregold", "pamasahe", "kahapon").
- Amounts are Philippine pesos. "1.5k" means 1500 and "1,240" means 1240. Never invent an amount: skip anything without one.
- description: a short label in the person's own words, without the amount, date words or payment method (at most 60 characters).
- category_slug: by the nature of the purchase, exactly one of food, transport, living, gifts, shopping, subs, leisure, other.
  Hints: Grab, Angkas, jeep, MRT, gas → transport. Rent, Meralco, water, internet → living. Spotify, Netflix, hosting → subs.
  gift, regalo → gifts. Shopee, Lazada → shopping. Meals, coffee, snacks, groceries → food.
- spent_on: YYYY-MM-DD. Resolve relative dates ("yesterday", "kahapon", "last Friday") against today's date below; otherwise use today.
- payment_method: gcash, card, cash or bank, only when the note says so ("via GCash"); otherwise null.
If nothing in the note has an amount, return {"items": []}.`;

export function parsePrompt(text: string, today: ISODate): string {
  return `Today is ${WEEKDAYS_LONG[weekdayMon0(today)]}, ${today}.\nNote:\n"""\n${text}\n"""`;
}

export const PARSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          description: { type: "STRING" },
          amount: { type: "NUMBER" },
          category_slug: { type: "STRING", enum: [...SLUGS] },
          spent_on: { type: "STRING", description: "YYYY-MM-DD" },
          payment_method: { type: "STRING", enum: [...PAYMENT_METHODS], nullable: true },
        },
        required: ["description", "amount", "category_slug", "spent_on"],
      },
    },
  },
  required: ["items"],
};

const parsedItem = z.object({
  description: z.string().trim().min(1),
  amount: z.number().finite().positive().max(10_000_000),
  category_slug: z.enum(SLUGS).catch("other"),
  spent_on: z.string(),
  payment_method: z.enum(PAYMENT_METHODS).nullish().catch(null),
});

/**
 * Checks the model's items. Bad items are dropped; if every item is bad the
 * answer is rejected so the next model gets a turn. Dates in the future or
 * over a year back become today.
 */
export function acceptParsed(raw: unknown, today: ISODate): ParsedExpense[] | null {
  const shape = z.object({ items: z.array(z.unknown()).max(30) }).safeParse(raw);
  if (!shape.success) return null;
  const items = shape.data.items.flatMap((item) => {
    const parsed = parsedItem.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
  if (shape.data.items.length > 0 && items.length === 0) return null;
  const oldest = addDays(today, -366);
  return items.map((item) => ({
    description: item.description.slice(0, 200),
    amount: Math.round(item.amount * 100) / 100,
    category_slug: item.category_slug,
    spent_on: isISODate(item.spent_on) && item.spent_on <= today && item.spent_on >= oldest ? item.spent_on : today,
    payment_method: item.payment_method ?? null,
  }));
}

// ---------- insights ----------

export const insightDataSchema = z.object({
  month: label,
  status: label,
  total: money,
  expenseCount: z.number().int().min(0).max(100_000),
  dailyAverage: money,
  projectedMonthEnd: money.nullable(),
  budget: z.object({ total: money, rolloverIncluded: money, usedPct: z.number().min(0).max(1e6) }).nullable(),
  comparedWith: z.object({ period: label, total: money, changePct: z.number().nullable() }).nullable(),
  categories: z
    .array(
      z.object({
        name: label,
        spent: money,
        sharePct: z.number().min(0).max(100),
        count: z.number().int().min(0),
        previousSpent: money.nullable(),
        budget: money.nullable(),
        overBudget: z.boolean(),
      }),
    )
    .max(20),
  mostFrequentInTopCategory: z
    .object({ category: label, description: z.string().trim().max(200), count: z.number().int().min(2) })
    .nullable(),
});
export type InsightData = z.infer<typeof insightDataSchema>;

export const insightsRequest = z.object({ data: insightDataSchema, force: z.boolean().optional() });

/** Aggregates only, never rows (the spec's privacy rule for insights). */
export function insightData(stats: MonthStats, input: MonthInput): InsightData {
  const previous = stats.previous.hasRecords
    ? new Map(categoryTotals(stats.previous.rows, input.categories).map((c) => [c.category.id, c.total]))
    : null;
  const budgets = new Map(
    categoryBudgetUsage(stats.rows, input.categories, budgetRowForMonth(input.history, stats.month)).map((r) => [r.category.id, r]),
  );
  const current = new Map(stats.categories.map((c) => [c.category.id, c]));
  const top = stats.topCategory;
  const frequent = top ? mostFrequent(stats.rows.filter((r) => r.category_id === top.category.id)) : null;

  return {
    month: monthLong(stats.month),
    status: stats.isCurrent ? `in progress: day ${stats.daysCounted} of ${stats.daysInMonth}` : "complete",
    total: whole(stats.total),
    expenseCount: stats.count,
    dailyAverage: whole(stats.dailyAverage),
    projectedMonthEnd: stats.isCurrent ? whole(stats.projected) : null,
    budget:
      stats.budget.total > 0
        ? { total: whole(stats.budget.total), rolloverIncluded: whole(stats.budget.rollover), usedPct: pct(stats.usage.ratio ?? 0) }
        : null,
    comparedWith: stats.previous.hasRecords
      ? {
          period: previousLabel(stats.previous, stats.month),
          total: whole(stats.previous.total),
          changePct: stats.change === null ? null : pct(stats.change),
        }
      : null,
    categories: input.categories
      .filter((c) => current.has(c.id) || (previous?.get(c.id) ?? 0) > 0)
      .map((c) => {
        const now = current.get(c.id);
        const budget = budgets.get(c.id);
        return {
          name: c.label,
          spent: whole(now?.total ?? 0),
          sharePct: pct(now?.share ?? 0),
          count: now?.count ?? 0,
          previousSpent: previous ? whole(previous.get(c.id) ?? 0) : null,
          budget: budget ? whole(budget.budget) : null,
          overBudget: budget?.isOver ?? false,
        };
      })
      .sort((a, b) => b.spent - a.spent),
    mostFrequentInTopCategory:
      top && frequent && frequent.n >= 2
        ? { category: top.category.label, description: frequent.label.slice(0, 200), count: frequent.n }
        : null,
  };
}

export const INSIGHTS_SYSTEM = `You write short insights for one person's monthly spending dashboard. Amounts are Philippine pesos.
Write 3 or 4 insights from the data you're given:
- Each is one sentence of at most 30 words that cites at least one ₱ figure or percentage.
- Use only numbers in the data or ones that follow directly from it. Write pesos like ₱1,240 (no centavos).
- Plain, neutral tone. No lecturing and no advice beyond spending.
- Pick what's notable: pace against the budget, the biggest changes from the comparison period, categories over budget, repeated purchases.
- "comparedWith" is the same stretch of last month, so compare category spending against "previousSpent".
Examples of the style:
- At this pace you'll spend ₱27,900 by Oct 31 — ₱2,900 over your ₱25,000 budget.
- Food is 31% of your spending — “Coffee” alone shows up 7×.
- Transport is up ₱640 vs Sep 1–24.
- Food and Gifts are already past their category budget.`;

export function insightsPrompt(data: InsightData): string {
  return `Spending data for ${data.month}:\n${JSON.stringify(data, null, 1)}`;
}

export const INSIGHTS_SCHEMA = {
  type: "OBJECT",
  properties: {
    insights: { type: "ARRAY", items: { type: "OBJECT", properties: { text: { type: "STRING" } }, required: ["text"] } },
  },
  required: ["insights"],
};

export function acceptInsights(raw: unknown): string[] | null {
  const result = z
    .object({ insights: z.array(z.object({ text: z.string().trim().min(8).max(300) })).min(1) })
    .safeParse(raw);
  return result.success ? result.data.insights.slice(0, 4).map((i) => i.text) : null;
}

// ---------- ask ----------

export const askDataSchema = z.object({
  month: label,
  expenses: z
    .array(
      z.object({
        date: z.string().refine(isISODate),
        description: z.string().trim().max(200),
        category: label,
        amount: money,
        paidWith: label,
      }),
    )
    .max(2_000),
  byDescription: z.array(z.object({ description: z.string().trim().max(200), count: z.number().int().min(1), total: money })).max(40),
  recentMonths: z
    .array(z.object({ month: label, total: money, byCategory: z.array(z.object({ name: label, total: money })).max(20) }))
    .max(6),
});
export type AskData = z.infer<typeof askDataSchema>;

export const askRequest = z.object({ question: z.string().trim().min(1).max(MAX_QUESTION_LENGTH), data: askDataSchema });

/** The selected month's rows plus six months of totals: what Ask sends, and only when you ask. */
export function askData(stats: MonthStats, input: MonthInput): AskData {
  const names = new Map(input.categories.map((c) => [c.id, c.label]));
  const groups = new Map<string, { description: string; count: number; total: number }>();
  for (const e of stats.rows) {
    const key = e.description.trim().toLowerCase();
    const group = groups.get(key) ?? { description: e.description.trim().slice(0, 200), count: 0, total: 0 };
    group.count += 1;
    group.total += e.amount;
    groups.set(key, group);
  }
  return {
    month: monthLong(stats.month),
    expenses: [...stats.rows]
      .sort((a, b) => a.spent_on.localeCompare(b.spent_on))
      .map((e) => ({
        date: e.spent_on,
        description: e.description.slice(0, 200),
        category: names.get(e.category_id) ?? "Other",
        amount: e.amount,
        paidWith: PAYMENT_LABELS[e.payment_method],
      })),
    byDescription: [...groups.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, 40)
      .map((g) => ({ ...g, total: Math.round(g.total * 100) / 100 })),
    recentMonths: monthRange(addMonths(stats.month, -5), stats.month).map((key) => {
      const rows = expensesInMonth(input.expenses, key);
      return {
        month: monthShortYear(key),
        total: whole(sumAmounts(rows)),
        byCategory: categoryTotals(rows, input.categories).map((c) => ({ name: c.category.label, total: whole(c.total) })),
      };
    }),
  };
}

export const CANT_TELL = "I can't tell from your data.";

export const ASK_SYSTEM = `You answer one question about a person's spending, using only the data you're given. Amounts are Philippine pesos.
- Answer in at most 80 words, and include the ₱ figure(s) that answer it, written like ₱1,240.
- The data has the month's expenses (one row each), totals per description, and totals for recent months.
  When you add rows up, check the sum twice.
- If the data doesn't cover the question, reply exactly: "${CANT_TELL}"
- Describe the spending only: no financial advice.`;

export function askPrompt(question: string, data: AskData): string {
  return `Question: ${question}\n\nData:\n${JSON.stringify(data)}`;
}

export const ASK_SCHEMA = {
  type: "OBJECT",
  properties: { answer: { type: "STRING" } },
  required: ["answer"],
};

export function acceptAnswer(raw: unknown): string | null {
  const result = z.object({ answer: z.string().trim().min(1).max(1_000) }).safeParse(raw);
  return result.success ? result.data.answer : null;
}

// ---------- messages ----------

/** What the page shows when AI isn't available (spec: "AI is busy — try again in a minute"). */
export const AI_MESSAGES = {
  busy: "AI is busy — try again in a minute.",
  unavailable: "AI is unavailable right now.",
  not_configured: "AI isn’t set up yet (add GEMINI_API_KEY).",
} as const;
