/**
 * Expense statistics as pure functions — no React, no I/O.
 * The dashboard imports these today; the /api insights and digest routes will
 * import the same functions when the backend lands (see docs/PORTAL_SPEC.md).
 *
 * Every calculation works from real dates (`spent_on`), never month indexes,
 * so comparisons cross year boundaries. `today` is always passed in.
 */
import {
  addMonths,
  dayOfMonth,
  daysInMonth,
  firstDayOfMonth,
  monthKeyOf,
  monthsOfYear,
  parseMonthKey,
  toISODate,
  weekdayMon0,
} from "./dates";
import { MONTHS_SHORT, monthLong, monthShort, peso } from "./format";
import {
  PAYMENT_METHODS,
  type BudgetHistoryRow,
  type Category,
  type Expense,
  type ISODate,
  type MonthKey,
  type PaymentMethod,
} from "./types";

const round2 = (n: number) => Math.round(n * 100) / 100;

export function sumAmounts(list: readonly Expense[]): number {
  return round2(list.reduce((total, e) => total + e.amount, 0));
}

// ---------- months ----------

export function expensesInMonth(expenses: readonly Expense[], key: MonthKey): Expense[] {
  return expenses.filter((e) => monthKeyOf(e.spent_on) === key);
}

export function isCurrentMonth(key: MonthKey, today: ISODate): boolean {
  return monthKeyOf(today) === key;
}

export function isFutureMonth(key: MonthKey, today: ISODate): boolean {
  return key > monthKeyOf(today);
}

/** Today's day for the current month, the full length for past months, 0 for future ones. */
export function daysCounted(key: MonthKey, today: ISODate): number {
  if (isCurrentMonth(key, today)) return dayOfMonth(today);
  if (isFutureMonth(key, today)) return 0;
  return daysInMonth(key);
}

export function monthsWithRecords(expenses: readonly Expense[]): Set<MonthKey> {
  return new Set(expenses.map((e) => monthKeyOf(e.spent_on)));
}

export function firstRecordMonth(expenses: readonly Expense[]): MonthKey | null {
  let first: MonthKey | null = null;
  for (const e of expenses) {
    const key = monthKeyOf(e.spent_on);
    if (first === null || key < first) first = key;
  }
  return first;
}

// ---------- budgets ----------

function sortedHistory(history: readonly BudgetHistoryRow[]): BudgetHistoryRow[] {
  return [...history].sort((a, b) => a.effective_month.localeCompare(b.effective_month));
}

/**
 * The budget row in force for a month: the latest `effective_month` ≤ that month.
 * Months before the first row use the earliest row.
 */
export function budgetRowForMonth(
  history: readonly BudgetHistoryRow[],
  key: MonthKey,
): BudgetHistoryRow | null {
  const rows = sortedHistory(history);
  if (rows.length === 0) return null;
  const start = firstDayOfMonth(key);
  let found: BudgetHistoryRow | null = null;
  for (const row of rows) if (row.effective_month <= start) found = row;
  return found ?? rows[0];
}

export function budgetForMonth(history: readonly BudgetHistoryRow[], key: MonthKey): number {
  return budgetRowForMonth(history, key)?.monthly_budget ?? 0;
}

export interface EffectiveBudget {
  /** That month's budget from budget_history. */
  base: number;
  /** Unused budget carried over from last month (0 unless rollover is on). */
  rollover: number;
  total: number;
  /** Month the base budget was set. */
  setFrom: MonthKey | null;
}

export function effectiveBudget(
  expenses: readonly Expense[],
  history: readonly BudgetHistoryRow[],
  key: MonthKey,
  rolloverEnabled: boolean,
): EffectiveBudget {
  const row = budgetRowForMonth(history, key);
  const base = row?.monthly_budget ?? 0;
  let rollover = 0;
  if (rolloverEnabled) {
    const prev = addMonths(key, -1);
    const prevRows = expensesInMonth(expenses, prev);
    if (prevRows.length > 0) {
      rollover = Math.max(0, budgetForMonth(history, prev) - sumAmounts(prevRows));
    }
  }
  return {
    base,
    rollover: round2(rollover),
    total: round2(base + rollover),
    setFrom: row ? monthKeyOf(row.effective_month) : null,
  };
}

export interface BudgetUsage {
  budget: number;
  spent: number;
  /** null when there is no budget. */
  ratio: number | null;
  left: number;
  over: number;
  isOver: boolean;
}

export function budgetUsage(spent: number, budget: number): BudgetUsage {
  if (budget <= 0) {
    return { budget: 0, spent, ratio: null, left: 0, over: 0, isOver: false };
  }
  return {
    budget,
    spent,
    ratio: spent / budget,
    left: round2(Math.max(0, budget - spent)),
    over: round2(Math.max(0, spent - budget)),
    isOver: spent > budget,
  };
}

// ---------- comparisons ----------

export interface PreviousComparison {
  key: MonthKey;
  rows: Expense[];
  total: number;
  /** Day the comparison is cut at, or null when it uses the full month. */
  throughDay: number | null;
  hasRecords: boolean;
}

/**
 * Last month, cut to match the selected month: for the current month it only
 * counts days ≤ today's day (clamped to last month's length).
 * January compares against December of the previous year.
 */
export function previousComparable(
  expenses: readonly Expense[],
  key: MonthKey,
  today: ISODate,
): PreviousComparison {
  const prevKey = addMonths(key, -1);
  const prevAll = expensesInMonth(expenses, prevKey);
  let rows = prevAll;
  let throughDay: number | null = null;
  if (isCurrentMonth(key, today)) {
    throughDay = Math.min(dayOfMonth(today), daysInMonth(prevKey));
    const cut = throughDay;
    rows = prevAll.filter((e) => dayOfMonth(e.spent_on) <= cut);
  }
  return { key: prevKey, rows, total: sumAmounts(rows), throughDay, hasRecords: prevAll.length > 0 };
}

/** "Sep 1–24", "Sep", or with the year when it differs: "Dec 1–24, 2025". */
export function previousLabel(prev: PreviousComparison, current: MonthKey): string {
  const { year } = parseMonthKey(prev.key);
  const crossesYear = year !== parseMonthKey(current).year;
  const base = monthShort(prev.key);
  if (prev.throughDay !== null) {
    return `${base} 1–${prev.throughDay}` + (crossesYear ? `, ${year}` : "");
  }
  return base + (crossesYear ? ` ${year}` : "");
}

/** (current − previous) ÷ previous, or null when there's nothing to compare against. */
export function changeRatio(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return (current - previous) / previous;
}

// ---------- breakdowns ----------

export interface CategoryTotal {
  category: Category;
  total: number;
  share: number;
  count: number;
}

/** Categories sorted by amount, zero categories hidden. */
export function categoryTotals(
  list: readonly Expense[],
  categories: readonly Category[],
): CategoryTotal[] {
  const total = sumAmounts(list);
  return categories
    .map((category) => {
      const rows = list.filter((e) => e.category_id === category.id);
      const sum = sumAmounts(rows);
      return { category, total: sum, share: total > 0 ? sum / total : 0, count: rows.length };
    })
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total || a.category.sort_order - b.category.sort_order);
}

export interface DayTotal {
  date: ISODate;
  day: number;
  total: number;
  /** A day after today in the current month. */
  future: boolean;
}

export function dailyTotals(list: readonly Expense[], key: MonthKey, today: ISODate): DayTotal[] {
  const { year, month } = parseMonthKey(key);
  const counted = daysCounted(key, today);
  const totals = new Map<number, number>();
  for (const e of list) {
    const d = dayOfMonth(e.spent_on);
    totals.set(d, (totals.get(d) ?? 0) + e.amount);
  }
  return Array.from({ length: daysInMonth(key) }, (_, i) => {
    const day = i + 1;
    return {
      date: toISODate(year, month, day),
      day,
      total: round2(totals.get(day) ?? 0),
      future: day > counted,
    };
  });
}

export function biggestDay(list: readonly Expense[]): { date: ISODate; total: number } | null {
  const totals = new Map<ISODate, number>();
  for (const e of list) totals.set(e.spent_on, (totals.get(e.spent_on) ?? 0) + e.amount);
  let best: { date: ISODate; total: number } | null = null;
  for (const [date, total] of [...totals].sort(([a], [b]) => a.localeCompare(b))) {
    if (!best || total > best.total) best = { date, total: round2(total) };
  }
  return best;
}

function isFixed(e: Expense, categories: readonly Category[]): boolean {
  return categories.find((c) => c.id === e.category_id)?.is_fixed ?? false;
}

/**
 * Projected month-end. Fixed costs (rent, subscriptions) count once; only
 * variable spend is extrapolated. Past months project to their actual total.
 */
export function projectedMonthEnd(
  list: readonly Expense[],
  categories: readonly Category[],
  key: MonthKey,
  today: ISODate,
): number {
  const total = sumAmounts(list);
  if (!isCurrentMonth(key, today)) return total;
  const counted = daysCounted(key, today);
  const fixed = sumAmounts(list.filter((e) => isFixed(e, categories)));
  const variable = total - fixed;
  return round2(fixed + (variable / counted) * daysInMonth(key));
}

export function topExpenses(list: readonly Expense[], n = 5): Expense[] {
  return [...list]
    .sort((a, b) => b.amount - a.amount || b.spent_on.localeCompare(a.spent_on))
    .slice(0, n);
}

/** Sum per weekday, Monday first. */
export function weekdayTotals(list: readonly Expense[]): number[] {
  const totals = [0, 0, 0, 0, 0, 0, 0];
  for (const e of list) totals[weekdayMon0(e.spent_on)] += e.amount;
  return totals.map(round2);
}

export interface PaymentShare {
  method: PaymentMethod;
  total: number;
  share: number;
  count: number;
}

export function paymentSplit(list: readonly Expense[]): PaymentShare[] {
  const total = sumAmounts(list);
  return PAYMENT_METHODS.map((method) => {
    const paid = list.filter((e) => e.payment_method === method);
    const sum = sumAmounts(paid);
    return { method, total: sum, share: total > 0 ? sum / total : 0, count: paid.length };
  });
}

export function fixedVariableSplit(
  list: readonly Expense[],
  categories: readonly Category[],
): { fixed: number; variable: number; averagePerExpense: number } {
  const total = sumAmounts(list);
  const fixed = sumAmounts(list.filter((e) => isFixed(e, categories)));
  return {
    fixed,
    variable: round2(total - fixed),
    averagePerExpense: list.length ? round2(total / list.length) : 0,
  };
}

export interface CategoryBudgetRow {
  category: Category;
  spent: number;
  budget: number;
  ratio: number;
  isOver: boolean;
}

/** Only categories that have a budget in that month's budget_history row. */
export function categoryBudgetUsage(
  list: readonly Expense[],
  categories: readonly Category[],
  row: BudgetHistoryRow | null,
): CategoryBudgetRow[] {
  if (!row) return [];
  return categories
    .filter((c) => (row.category_budgets[c.slug] ?? 0) > 0)
    .map((category) => {
      const budget = row.category_budgets[category.slug] ?? 0;
      const spent = sumAmounts(list.filter((e) => e.category_id === category.id));
      return { category, spent, budget, ratio: spent / budget, isOver: spent > budget };
    });
}

/** Month totals for the `n` months ending at `end`. */
export function monthTotalsSeries(
  expenses: readonly Expense[],
  end: MonthKey,
  n = 6,
): { key: MonthKey; total: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const key = addMonths(end, i - (n - 1));
    return { key, total: sumAmounts(expensesInMonth(expenses, key)) };
  });
}

export interface PaceSeries {
  days: number;
  /** Cumulative actual spend for days 1…daysCounted. */
  actual: number[];
  /** Straight line from today's cumulative to the projected month-end. Empty for past months. */
  projection: { day: number; value: number }[];
  projected: number;
}

export function paceSeries(
  list: readonly Expense[],
  categories: readonly Category[],
  key: MonthKey,
  today: ISODate,
): PaceSeries {
  const days = daysInMonth(key);
  const counted = daysCounted(key, today);
  const daily = dailyTotals(list, key, today);
  const actual: number[] = [];
  let running = 0;
  for (let i = 0; i < counted; i++) {
    running += daily[i].total;
    actual.push(round2(running));
  }
  const projected = projectedMonthEnd(list, categories, key, today);
  const projection: { day: number; value: number }[] = [];
  if (isCurrentMonth(key, today) && counted < days) {
    const start = actual[counted - 1] ?? 0;
    for (let day = counted; day <= days; day++) {
      const t = (day - counted) / (days - counted);
      projection.push({ day, value: round2(start + (projected - start) * t) });
    }
  }
  return { days, actual, projection, projected };
}

// ---------- the month dashboard ----------

export interface MonthInput {
  expenses: readonly Expense[];
  categories: readonly Category[];
  history: readonly BudgetHistoryRow[];
  rolloverEnabled: boolean;
  month: MonthKey;
  today: ISODate;
}

export interface MonthStats {
  month: MonthKey;
  isCurrent: boolean;
  rows: Expense[];
  total: number;
  count: number;
  daysCounted: number;
  daysInMonth: number;
  dailyAverage: number;
  previous: PreviousComparison;
  change: number | null;
  categories: CategoryTotal[];
  topCategory: CategoryTotal | null;
  biggestDay: { date: ISODate; total: number } | null;
  budget: EffectiveBudget;
  usage: BudgetUsage;
  projected: number;
}

export function computeMonthStats(input: MonthInput): MonthStats {
  const { expenses, categories, history, rolloverEnabled, month, today } = input;
  const rows = expensesInMonth(expenses, month);
  const total = sumAmounts(rows);
  const counted = daysCounted(month, today);
  const previous = previousComparable(expenses, month, today);
  const cats = categoryTotals(rows, categories);
  const budget = effectiveBudget(expenses, history, month, rolloverEnabled);
  return {
    month,
    isCurrent: isCurrentMonth(month, today),
    rows,
    total,
    count: rows.length,
    daysCounted: counted,
    daysInMonth: daysInMonth(month),
    dailyAverage: counted > 0 ? round2(total / counted) : 0,
    previous,
    change: changeRatio(total, previous.total),
    categories: cats,
    topCategory: cats[0] ?? null,
    biggestDay: biggestDay(rows),
    budget,
    usage: budgetUsage(total, budget.total),
    projected: projectedMonthEnd(rows, categories, month, today),
  };
}

/** The pace sentence shared by the insights panel and the pace chart. */
export function paceSummary(stats: MonthStats): string {
  const budget = stats.budget.total;
  if (budget <= 0) return "No monthly budget set — add one in Settings.";
  const amount = stats.isCurrent ? stats.projected : stats.total;
  const gap = amount - budget;
  const gapText = `${peso(Math.abs(gap))} ${gap > 0 ? "over" : "under"}`;
  if (stats.isCurrent) {
    return `At this pace you’ll spend ${peso(stats.projected)} by ${monthShort(stats.month)} ${stats.daysInMonth} — ${gapText} your ${peso(budget)} budget.`;
  }
  return `You ended ${monthLong(stats.month)} at ${peso(stats.total)} — ${gapText} your ${peso(budget)} budget.`;
}

/** The description that shows up most often (case-insensitive), with its count. */
export function mostFrequent(rows: readonly Expense[]): { label: string; n: number } | null {
  const counts = new Map<string, { label: string; n: number }>();
  for (const e of rows) {
    const k = e.description.trim().toLowerCase();
    const entry = counts.get(k) ?? { label: e.description.trim(), n: 0 };
    entry.n += 1;
    counts.set(k, entry);
  }
  return [...counts.values()].sort((a, b) => b.n - a.n)[0] ?? null;
}

/**
 * The four template insights. They are the fallback when Gemini is
 * unavailable and the few-shot examples for the AI prompt.
 */
export function templateInsights(stats: MonthStats, input: MonthInput): string[] {
  if (stats.count === 0) return [];
  const insights = [paceSummary(stats)];

  const top = stats.topCategory;
  if (top) {
    const frequent = mostFrequent(stats.rows.filter((r) => r.category_id === top.category.id));
    insights.push(
      `${top.category.label} is ${Math.round(top.share * 100)}% of your spending` +
        (frequent && frequent.n >= 2 ? ` — “${frequent.label}” alone shows up ${frequent.n}×.` : "."),
    );
  }

  if (stats.previous.hasRecords) {
    const before = new Map(categoryTotals(stats.previous.rows, input.categories).map((c) => [c.category.id, c.total]));
    const now = new Map(stats.categories.map((c) => [c.category.id, c.total]));
    let biggest: { label: string; diff: number } | null = null;
    for (const c of input.categories) {
      const diff = (now.get(c.id) ?? 0) - (before.get(c.id) ?? 0);
      if (!biggest || Math.abs(diff) > Math.abs(biggest.diff)) biggest = { label: c.label, diff };
    }
    if (biggest && Math.abs(biggest.diff) >= 1) {
      insights.push(
        `${biggest.label} is ${biggest.diff > 0 ? "up" : "down"} ${peso(Math.abs(biggest.diff))} vs ${previousLabel(stats.previous, stats.month)}.`,
      );
    }
  }

  const over = categoryBudgetUsage(stats.rows, input.categories, budgetRowForMonth(input.history, stats.month))
    .filter((r) => r.isOver)
    .map((r) => r.category.label);
  if (over.length > 0) {
    const names = over.length === 1 ? over[0] : `${over.slice(0, -1).join(", ")} and ${over.at(-1)}`;
    insights.push(
      stats.isCurrent
        ? `${names} ${over.length === 1 ? "is" : "are"} already past ${over.length === 1 ? "its" : "their"} category budget.`
        : `${names} went past ${over.length === 1 ? "its" : "their"} category budget.`,
    );
  } else {
    insights.push(
      stats.isCurrent ? "Every category is within its budget so far." : "Every category stayed within its budget.",
    );
  }
  return insights;
}

// ---------- the year overview ----------

export interface YearMonth {
  key: MonthKey;
  total: number;
  count: number;
  budget: number;
  hasRecords: boolean;
  inProgress: boolean;
  future: boolean;
  isOver: boolean;
}

export interface YearOverview {
  year: number;
  isCurrentYear: boolean;
  months: YearMonth[];
  rows: Expense[];
  total: number;
  count: number;
  monthsWithRecords: number;
  monthlyAverage: number;
  vsLastYear: {
    ratio: number | null;
    current: number;
    previous: number;
    from: MonthKey;
    to: MonthKey;
    /** Day the current month is cut at in both years. */
    cutDay: number | null;
  } | null;
  monthsUnderBudget: { under: number; completed: number };
  categories: CategoryTotal[];
  topCategory: CategoryTotal | null;
  biggestMonth: { key: MonthKey; total: number } | null;
  yoyByCategory: { category: Category; current: number; previous: number; ratio: number | null }[] | null;
  /** Budget rows that took effect during this year. */
  budgetChanges: BudgetHistoryRow[];
}

export function computeYearOverview(input: Omit<MonthInput, "month" | "rolloverEnabled"> & { year: number }): YearOverview {
  const { expenses, categories, history, today, year } = input;
  const keys = monthsOfYear(year);
  const rows = expenses.filter((e) => e.spent_on.startsWith(`${year}-`));

  const months: YearMonth[] = keys.map((key) => {
    const list = expensesInMonth(rows, key);
    const total = sumAmounts(list);
    const budget = budgetForMonth(history, key);
    return {
      key,
      total,
      count: list.length,
      budget,
      hasRecords: list.length > 0,
      inProgress: isCurrentMonth(key, today),
      future: isFutureMonth(key, today),
      isOver: budget > 0 && total > budget,
    };
  });

  const withRecords = months.filter((m) => m.hasRecords);
  const total = sumAmounts(rows);

  // vs last year: same months only, both years need records, current month cut at today's day.
  const prevRows = expenses.filter((e) => e.spent_on.startsWith(`${year - 1}-`));
  const prevMonths = new Set(prevRows.map((e) => monthKeyOf(e.spent_on).slice(5)));
  const shared = withRecords.filter((m) => prevMonths.has(m.key.slice(5)));
  const cutDay = shared.some((m) => m.inProgress) ? dayOfMonth(today) : null;
  const inShared = (e: Expense) => {
    const match = shared.find((m) => m.key.slice(5) === e.spent_on.slice(5, 7));
    if (!match) return false;
    return !match.inProgress || cutDay === null || dayOfMonth(e.spent_on) <= cutDay;
  };
  const curSame = rows.filter(inShared);
  const prevSame = prevRows.filter(inShared);
  const vsLastYear = shared.length
    ? {
        ratio: changeRatio(sumAmounts(curSame), sumAmounts(prevSame)),
        current: sumAmounts(curSame),
        previous: sumAmounts(prevSame),
        from: shared[0].key,
        to: shared[shared.length - 1].key,
        cutDay,
      }
    : null;

  const completed = withRecords.filter((m) => !m.inProgress && m.budget > 0);
  const cats = categoryTotals(rows, categories);
  const biggest = withRecords.reduce<YearMonth | null>((best, m) => (!best || m.total > best.total ? m : best), null);

  const yoyByCategory = shared.length
    ? categories.map((category) => {
        const current = sumAmounts(curSame.filter((e) => e.category_id === category.id));
        const previous = sumAmounts(prevSame.filter((e) => e.category_id === category.id));
        return { category, current, previous, ratio: changeRatio(current, previous) };
      })
    : null;

  return {
    year,
    isCurrentYear: parseMonthKey(monthKeyOf(today)).year === year,
    months,
    rows,
    total,
    count: rows.length,
    monthsWithRecords: withRecords.length,
    monthlyAverage: withRecords.length ? round2(total / withRecords.length) : 0,
    vsLastYear,
    monthsUnderBudget: { under: completed.filter((m) => m.total <= m.budget).length, completed: completed.length },
    categories: cats,
    topCategory: cats[0] ?? null,
    biggestMonth: biggest ? { key: biggest.key, total: biggest.total } : null,
    yoyByCategory,
    budgetChanges: sortedHistory(history).filter((h) => h.effective_month.startsWith(`${year}-`)),
  };
}

/** "Mar–Oct 24" for the year overview's same-months range. */
export function sameMonthsLabel(vs: NonNullable<YearOverview["vsLastYear"]>): string {
  const from = MONTHS_SHORT[parseMonthKey(vs.from).month - 1];
  const to = MONTHS_SHORT[parseMonthKey(vs.to).month - 1];
  const range = from === to ? from : `${from}–${to}`;
  return vs.cutDay !== null ? `${range} ${vs.cutDay}` : range;
}
