import { describe, expect, it } from "vitest";
import { DEFAULT_CATEGORIES } from "./data/defaults";
import {
  budgetForMonth,
  computeMonthStats,
  computeYearOverview,
  daysCounted,
  effectiveBudget,
  monthTotalsSeries,
  paceSummary,
  paymentSplit,
  previousComparable,
  previousLabel,
  projectedMonthEnd,
  sameMonthsLabel,
  templateInsights,
  type MonthInput,
} from "./expense-stats";
import type { BudgetHistoryRow, CategorySlug, Expense, PaymentMethod } from "./types";

let seq = 0;
function exp(spent_on: string, amount: number, slug: CategorySlug = "food", payment_method: PaymentMethod = "gcash", description = "Coffee"): Expense {
  seq += 1;
  return {
    id: `e${seq}`,
    category_id: `cat-${slug}`,
    amount,
    spent_on,
    description,
    payment_method,
    source: "manual",
    created_at: `${spent_on}T12:00:00+08:00`,
    updated_at: `${spent_on}T12:00:00+08:00`,
  };
}

const HISTORY: BudgetHistoryRow[] = [
  { effective_month: "2026-01-01", monthly_budget: 25000, category_budgets: { food: 7000, gifts: 2000 } },
  { effective_month: "2025-03-01", monthly_budget: 22000, category_budgets: { food: 6500 } },
];

function input(expenses: Expense[], month: string, today: string, extra: Partial<MonthInput> = {}): MonthInput {
  return { expenses, categories: DEFAULT_CATEGORIES, history: HISTORY, rolloverEnabled: false, month, today, ...extra };
}

describe("daysCounted", () => {
  it("uses today's day for the current month, full length for past months, 0 for future", () => {
    expect(daysCounted("2026-10", "2026-10-24")).toBe(24);
    expect(daysCounted("2026-09", "2026-10-24")).toBe(30);
    expect(daysCounted("2026-02", "2026-10-24")).toBe(28);
    expect(daysCounted("2026-11", "2026-10-24")).toBe(0);
  });
});

describe("vs last month", () => {
  it("cuts last month at today's day when the month is in progress", () => {
    const rows = [exp("2026-09-05", 100), exp("2026-09-24", 200), exp("2026-09-25", 999), exp("2026-10-02", 450)];
    const prev = previousComparable(rows, "2026-10", "2026-10-24");
    expect(prev.key).toBe("2026-09");
    expect(prev.total).toBe(300);
    expect(previousLabel(prev, "2026-10")).toBe("Sep 1–24");

    const stats = computeMonthStats(input(rows, "2026-10", "2026-10-24"));
    expect(stats.change).toBeCloseTo(0.5);
  });

  it("clamps the cut to last month's length", () => {
    const rows = [exp("2026-02-28", 100), exp("2026-03-31", 100)];
    const prev = previousComparable(rows, "2026-03", "2026-03-31");
    expect(prev.throughDay).toBe(28);
    expect(prev.total).toBe(100);
  });

  it("compares a past month against last month's full total", () => {
    const rows = [exp("2026-08-31", 500), exp("2026-09-10", 250)];
    const prev = previousComparable(rows, "2026-09", "2026-10-24");
    expect(prev.throughDay).toBeNull();
    expect(prev.total).toBe(500);
    expect(previousLabel(prev, "2026-09")).toBe("Aug");
  });

  it("compares January against December of the previous year", () => {
    const rows = [exp("2025-12-20", 1000), exp("2026-01-05", 1500)];
    const stats = computeMonthStats(input(rows, "2026-01", "2026-03-10"));
    expect(stats.previous.key).toBe("2025-12");
    expect(stats.change).toBeCloseTo(0.5);
    expect(previousLabel(stats.previous, "2026-01")).toBe("Dec 2025");
  });

  it("labels a current-month comparison that crosses years", () => {
    const prev = previousComparable([exp("2025-12-03", 10)], "2026-01", "2026-01-24");
    expect(previousLabel(prev, "2026-01")).toBe("Dec 1–24, 2025");
  });
});

describe("empty months", () => {
  it("returns zeros and nulls instead of NaN", () => {
    const stats = computeMonthStats(input([], "2026-02", "2026-10-24"));
    expect(stats.total).toBe(0);
    expect(stats.count).toBe(0);
    expect(stats.dailyAverage).toBe(0);
    expect(stats.change).toBeNull();
    expect(stats.topCategory).toBeNull();
    expect(stats.biggestDay).toBeNull();
    expect(templateInsights(stats, input([], "2026-02", "2026-10-24"))).toEqual([]);
  });
});

describe("budgets", () => {
  it("resolves a month's budget from budget_history, never from current settings", () => {
    expect(budgetForMonth(HISTORY, "2025-02")).toBe(22000); // before the first row → earliest row
    expect(budgetForMonth(HISTORY, "2025-12")).toBe(22000);
    expect(budgetForMonth(HISTORY, "2026-01")).toBe(25000);
    expect(budgetForMonth(HISTORY, "2026-10")).toBe(25000);
    expect(budgetForMonth([], "2026-10")).toBe(0);
  });

  it("handles a 0 budget", () => {
    const history: BudgetHistoryRow[] = [{ effective_month: "2026-01-01", monthly_budget: 0, category_budgets: {} }];
    const rows = [exp("2026-10-03", 500)];
    const stats = computeMonthStats({ ...input(rows, "2026-10", "2026-10-24"), history });
    expect(stats.usage.ratio).toBeNull();
    expect(stats.usage.isOver).toBe(false);
    expect(paceSummary(stats)).toBe("No monthly budget set — add one in Settings.");
  });

  it("adds last month's unused budget when rollover is on", () => {
    const rows = [exp("2026-09-10", 20000, "living"), exp("2026-10-01", 100)];
    expect(effectiveBudget(rows, HISTORY, "2026-10", false).total).toBe(25000);
    const withRollover = effectiveBudget(rows, HISTORY, "2026-10", true);
    expect(withRollover.rollover).toBe(5000);
    expect(withRollover.total).toBe(30000);
  });

  it("rolls December into January using December's own budget", () => {
    const rows = [exp("2025-12-10", 20000, "living")];
    expect(effectiveBudget(rows, HISTORY, "2026-01", true).rollover).toBe(2000);
  });

  it("reports budget used, left and over", () => {
    const rows = [exp("2026-10-01", 20000, "living"), exp("2026-10-02", 6000)];
    const stats = computeMonthStats(input(rows, "2026-10", "2026-10-24"));
    expect(stats.usage.ratio).toBeCloseTo(26000 / 25000);
    expect(stats.usage.isOver).toBe(true);
    expect(stats.usage.over).toBe(1000);
  });
});

describe("projection", () => {
  it("counts fixed costs once and extrapolates only variable spend", () => {
    const rows = [exp("2026-10-01", 6500, "living"), exp("2026-10-05", 3100, "food")];
    expect(projectedMonthEnd(rows, DEFAULT_CATEGORIES, "2026-10", "2026-10-10")).toBe(6500 + (3100 / 10) * 31);
  });

  it("projects a past month to its actual total", () => {
    const rows = [exp("2026-09-01", 6500, "living"), exp("2026-09-05", 3100)];
    expect(projectedMonthEnd(rows, DEFAULT_CATEGORIES, "2026-09", "2026-10-10")).toBe(9600);
  });
});

describe("month dashboard", () => {
  it("computes the six stat cards", () => {
    const rows = [
      exp("2026-10-01", 6500, "living", "bank", "Rent"),
      exp("2026-10-03", 140),
      exp("2026-10-03", 160),
      exp("2026-10-07", 186, "transport", "gcash", "Grab"),
    ];
    const stats = computeMonthStats(input(rows, "2026-10", "2026-10-10"));
    expect(stats.total).toBe(6986);
    expect(stats.count).toBe(4);
    expect(stats.dailyAverage).toBeCloseTo(698.6);
    expect(stats.topCategory?.category.slug).toBe("living");
    expect(stats.biggestDay).toEqual({ date: "2026-10-01", total: 6500 });
  });

  it("writes four template insights", () => {
    const rows = [
      exp("2026-09-02", 200, "transport", "gcash", "Grab"),
      exp("2026-10-01", 6500, "living", "bank", "Rent"),
      exp("2026-10-02", 4000, "food", "card", "Groceries"),
      exp("2026-10-03", 3500),
      exp("2026-10-04", 150),
      exp("2026-10-05", 840, "transport", "gcash", "Grab"),
    ];
    const i = input(rows, "2026-10", "2026-10-10");
    const insights = templateInsights(computeMonthStats(i), i);
    expect(insights).toHaveLength(4);
    expect(insights[0]).toMatch(/^At this pace you’ll spend ₱[\d,]+ by Oct 31/);
    expect(insights[1]).toBe("Food is 51% of your spending — “Coffee” alone shows up 2×.");
    expect(insights[2]).toBe("Food is up ₱7,650 vs Sep 1–10.");
    expect(insights[3]).toBe("Food is already past its category budget.");
  });

  it("splits spending by payment method with a count per method", () => {
    const rows = [
      exp("2026-10-01", 6500, "living", "bank", "Rent"),
      exp("2026-10-03", 140),
      exp("2026-10-03", 160),
      exp("2026-10-07", 200, "transport", "cash", "Jeep"),
    ];
    expect(paymentSplit(rows)).toEqual([
      { method: "gcash", total: 300, share: 300 / 7000, count: 2 },
      { method: "card", total: 0, share: 0, count: 0 },
      { method: "cash", total: 200, share: 200 / 7000, count: 1 },
      { method: "bank", total: 6500, share: 6500 / 7000, count: 1 },
    ]);
  });
});

describe("six-month trend", () => {
  it("ends at the selected month and crosses year boundaries", () => {
    const rows = [exp("2025-11-03", 100), exp("2026-02-03", 300)];
    const series = monthTotalsSeries(rows, "2026-03", 6);
    expect(series.map((s) => s.key)).toEqual(["2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03"]);
    expect(series.map((s) => s.total)).toEqual([0, 100, 0, 0, 300, 0]);
  });
});

describe("year overview", () => {
  it("compares only months both years have, cutting the current month at today", () => {
    const rows = [
      exp("2025-03-10", 1000),
      exp("2025-10-05", 400),
      exp("2025-10-28", 9999), // after today's day → excluded
      exp("2026-02-10", 700), // no Feb 2025 records → excluded
      exp("2026-03-11", 1200),
      exp("2026-10-04", 600),
    ];
    const year = computeYearOverview({ expenses: rows, categories: DEFAULT_CATEGORIES, history: HISTORY, today: "2026-10-24", year: 2026 });
    expect(year.vsLastYear).not.toBeNull();
    expect(year.vsLastYear!.current).toBe(1800);
    expect(year.vsLastYear!.previous).toBe(1400);
    expect(sameMonthsLabel(year.vsLastYear!)).toBe("Mar–Oct 24");
    expect(year.monthsWithRecords).toBe(3);
    expect(year.total).toBe(2500);
  });

  it("judges completed months against their own budget", () => {
    const rows = [exp("2025-11-03", 23000, "living"), exp("2025-12-03", 21000, "living")];
    const year = computeYearOverview({ expenses: rows, categories: DEFAULT_CATEGORIES, history: HISTORY, today: "2026-10-24", year: 2025 });
    expect(year.monthsUnderBudget).toEqual({ under: 1, completed: 2 });
    expect(year.months[10].isOver).toBe(true);
    expect(year.vsLastYear).toBeNull();
    expect(year.yoyByCategory).toBeNull();
  });
});
