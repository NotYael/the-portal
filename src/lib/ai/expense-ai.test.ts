import { describe, expect, it } from "vitest";
import { seedPortal } from "../data/seed";
import { computeMonthStats, type MonthInput } from "../expense-stats";
import {
  acceptAnswer,
  acceptInsights,
  acceptParsed,
  askData,
  askDataSchema,
  insightData,
  insightDataSchema,
  parsePrompt,
} from "./expense-ai";

const TODAY = "2026-10-27";

function monthInput(month: MonthInput["month"]): MonthInput {
  const seed = seedPortal(TODAY);
  return {
    expenses: seed.expenses,
    categories: seed.categories,
    history: seed.budgetHistory,
    rolloverEnabled: seed.settings.rollover_enabled,
    month,
    today: TODAY,
  };
}

describe("acceptParsed", () => {
  const item = { description: "Grab to ATC", amount: 186, category_slug: "transport", spent_on: TODAY, payment_method: null };

  it("keeps good items and tidies amounts", () => {
    expect(acceptParsed({ items: [{ ...item, amount: 186.004, payment_method: "gcash" }] }, TODAY)).toEqual([
      { ...item, amount: 186, payment_method: "gcash" },
    ]);
  });

  it("turns future, ancient or malformed dates into today", () => {
    const dates = ["2026-10-28", "2024-01-01", "yesterday"].map((spent_on) => acceptParsed({ items: [{ ...item, spent_on }] }, TODAY)![0].spent_on);
    expect(dates).toEqual([TODAY, TODAY, TODAY]);
    expect(acceptParsed({ items: [{ ...item, spent_on: "2026-10-26" }] }, TODAY)![0].spent_on).toBe("2026-10-26");
  });

  it("maps unknown categories and payment methods to safe values", () => {
    const [row] = acceptParsed({ items: [{ ...item, category_slug: "groceries", payment_method: "paypal" }] }, TODAY)!;
    expect(row).toMatchObject({ category_slug: "other", payment_method: null });
  });

  it("drops items without a usable amount, and rejects an answer with none left", () => {
    expect(acceptParsed({ items: [item, { ...item, amount: 0 }] }, TODAY)).toHaveLength(1);
    expect(acceptParsed({ items: [{ ...item, amount: -5 }] }, TODAY)).toBeNull();
    expect(acceptParsed({ items: [] }, TODAY)).toEqual([]);
    expect(acceptParsed({ nope: true }, TODAY)).toBeNull();
  });
});

describe("parsePrompt", () => {
  it("tells the model today's weekday for relative dates", () => {
    expect(parsePrompt("coffee 140 kahapon", TODAY)).toContain("Tuesday, 2026-10-27");
  });
});

describe("acceptInsights / acceptAnswer", () => {
  it("keeps at most four insights and rejects empty ones", () => {
    const five = Array.from({ length: 5 }, (_, i) => ({ text: `Insight number ${i} cites ₱1,000.` }));
    expect(acceptInsights({ insights: five })).toHaveLength(4);
    expect(acceptInsights({ insights: [] })).toBeNull();
    expect(acceptInsights({ insights: [{ text: "" }] })).toBeNull();
  });

  it("accepts a plain answer only", () => {
    expect(acceptAnswer({ answer: "  You spent ₱1,240 on Grab.  " })).toBe("You spent ₱1,240 on Grab.");
    expect(acceptAnswer({ answer: "" })).toBeNull();
    expect(acceptAnswer("₱1,240")).toBeNull();
  });
});

describe("insightData", () => {
  const input = monthInput("2026-10");
  const stats = computeMonthStats(input);
  const data = insightData(stats, input);

  it("passes the route's own validation", () => {
    expect(insightDataSchema.safeParse(data).success).toBe(true);
  });

  it("sends aggregates only, never expense rows", () => {
    const json = JSON.stringify(data);
    const rare = stats.rows.find((r) => stats.rows.filter((o) => o.description === r.description).length === 1);
    expect(rare).toBeDefined();
    expect(json).not.toContain(rare!.description);
    expect(data.total).toBe(Math.round(stats.total));
    expect(data.status).toBe("in progress: day 27 of 31");
  });

  it("lists categories by spend with last month's comparable figure", () => {
    expect(data.categories[0].spent).toBeGreaterThanOrEqual(data.categories.at(-1)!.spent);
    expect(data.comparedWith?.period).toBe("Sep 1–27");
    expect(data.categories.every((c) => c.previousSpent !== null)).toBe(true);
  });

  it("is plain numbers even while amounts are hidden on screen", () => {
    expect(JSON.stringify(data)).not.toContain("*");
  });
});

describe("askData", () => {
  const input = monthInput("2026-10");
  const stats = computeMonthStats(input);
  const data = askData(stats, input);

  it("passes the route's own validation", () => {
    expect(askDataSchema.safeParse(data).success).toBe(true);
  });

  it("has every row of the month, totals per description and six months of totals", () => {
    expect(data.expenses).toHaveLength(stats.count);
    expect(data.recentMonths.map((m) => m.month)).toEqual(["May 2026", "Jun 2026", "Jul 2026", "Aug 2026", "Sep 2026", "Oct 2026"]);
    const sum = data.byDescription.reduce((t, d) => t + d.count, 0);
    expect(sum).toBeLessThanOrEqual(stats.count);
  });
});
