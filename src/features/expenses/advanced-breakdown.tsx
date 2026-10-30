"use client";

import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Dot } from "@/components/ui/dot";
import { ProgressBar, StackedBar } from "@/components/ui/progress-bar";
import {
  budgetRowForMonth,
  categoryBudgetUsage,
  expensesInMonth,
  fixedVariableSplit,
  paceSeries,
  paceSummary,
  paymentSplit,
  weekdayTotals,
  type MonthInput,
  type MonthStats,
} from "@/lib/expense-stats";
import { addMonths, parseMonthKey } from "@/lib/dates";
import { compactPeso, monthShort, monthShortMaybeYear, peso, pesoExact, WEEKDAYS_SHORT } from "@/lib/format";
import { useAmountsHidden } from "@/lib/use-amounts-hidden";
import { PAYMENT_LABELS } from "@/lib/types";
import { CategoryStackChart, PaceChart, WeekdayChart } from "./charts";

const PAYMENT_COLORS = { gcash: "var(--accent)", card: "var(--ink)", cash: "var(--warn)", bank: "var(--slate)" } as const;

export function AdvancedBreakdown({
  stats,
  input,
  onEditBudgets,
}: {
  stats: MonthStats;
  input: MonthInput;
  onEditBudgets: () => void;
}) {
  const hidden = useAmountsHidden();
  const { categories, expenses } = input;
  const pace = paceSeries(stats.rows, categories, stats.month, input.today);
  const summary = paceSummary(stats);
  const catBudgets = categoryBudgetUsage(stats.rows, categories, budgetRowForMonth(input.history, stats.month));

  const stackKeys = Array.from({ length: 6 }, (_, i) => addMonths(stats.month, i - 5));
  const spansYears = parseMonthKey(stackKeys[0]).year !== parseMonthKey(stackKeys[5]).year;
  const stack = stackKeys.map((key) => {
    const byCategory = new Map<string, number>();
    for (const e of expensesInMonth(expenses, key)) byCategory.set(e.category_id, (byCategory.get(e.category_id) ?? 0) + e.amount);
    return { key, byCategory, total: [...byCategory.values()].reduce((a, b) => a + b, 0) };
  });

  const weekdays = weekdayTotals(stats.rows);
  const heaviest = stats.total > 0 ? weekdays.indexOf(Math.max(...weekdays)) : -1;
  const pay = paymentSplit(stats.rows);
  const topPay = stats.total > 0 ? pay.reduce((best, p) => (p.total > best.total ? p : best)) : null;
  const fv = fixedVariableSplit(stats.rows, categories);
  const fvTotal = fv.fixed + fv.variable;
  const fixedNames = categories.filter((c) => c.is_fixed).map((c) => c.label.toLowerCase().replace(" expenses", ""));

  return (
    <div id="advanced-breakdown" aria-label="Advanced breakdown" className="flex flex-wrap gap-4">
      <Card aria-label="Spending pace vs budget" className="flex-[1_1_100%]" gap="gap-3">
        <CardHeader
          title="Spending pace vs budget"
          aside={
            <div className="flex flex-wrap gap-4 text-[13px] text-ink-soft">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="h-[3px] w-4 bg-accent" />
                Actual
              </span>
              {pace.projection.length ? (
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden="true" className="w-4 border-t-2 border-dashed border-[#7C8594]" />
                  Projected
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="w-4 border-t-2 border-dashed border-warn" />
                Budget {peso(stats.budget.total)}
              </span>
            </div>
          }
        />
        <PaceChart pace={pace} budget={stats.budget.total} ariaLabel={summary} />
        <div className="flex justify-between text-xs text-muted">
          <span>{monthShort(stats.month)} 1</span>
          <span>
            {monthShort(stats.month)} {stats.daysInMonth}
          </span>
        </div>
        <p className="m-0 text-sm">{summary}</p>
      </Card>

      <Card aria-label="Category budgets" className="flex-[1_1_340px]" gap="gap-3.5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="m-0 font-display text-xl font-bold">Category budgets</h2>
          {hidden ? null : (
            <Button size="sm" onClick={onEditBudgets}>
              Edit
            </Button>
          )}
        </div>
        {catBudgets.length === 0 ? (
          <p className="m-0 text-sm text-muted">No category budgets for this month. Add them in Settings.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
            {catBudgets.map((b) => (
              <li key={b.category.id} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <Dot color={b.category.color} />
                    <span className="truncate">{b.category.label}</span>
                  </span>
                  <span className="shrink-0 whitespace-nowrap">
                    <span className="font-mono text-xs sm:text-[13px]">
                      {peso(b.spent)} / {peso(b.budget)}
                    </span>{" "}
                    <span className={`font-semibold ${b.isOver ? "text-warn-ink" : "text-muted"}`}>{Math.round(b.ratio * 100)}%</span>
                  </span>
                </div>
                <ProgressBar ratio={b.ratio} height={8} color={b.isOver ? "var(--warn)" : "var(--accent)"} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card aria-label="Categories over 6 months" className="flex-[1_1_340px]" gap="gap-3.5">
        <h2 className="m-0 font-display text-xl font-bold">Categories over 6 months</h2>
        <div className="flex flex-1 flex-col gap-1">
          <CategoryStackChart
            months={stack}
            categories={categories}
            selectedIndex={5}
            ariaLabel={`Spending by category per month: ${stack.map((s) => `${monthShort(s.key)} ${compactPeso(s.total)}`).join(", ")}`}
          />
          <div aria-hidden="true" className="grid grid-cols-6 text-center text-xs text-ink-soft">
            {stack.map((s, i) => (
              <span key={s.key} className={i === 5 ? "font-bold text-ink" : "font-medium"}>
                {monthShortMaybeYear(s.key, spansYears)}
              </span>
            ))}
          </div>
        </div>
        <ul className="m-0 flex list-none flex-wrap gap-x-3.5 gap-y-1.5 p-0">
          {categories.map((c) => (
            <li key={c.id} className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
              <Dot color={c.color} square />
              {c.label}
            </li>
          ))}
        </ul>
      </Card>

      <Card aria-label="Spending by day of week" className="flex-[1_1_340px]" gap="gap-3.5">
        <CardHeader
          title="By day of week"
          aside={
            heaviest >= 0 ? <span className="text-[13px] text-muted">{WEEKDAYS_SHORT[heaviest]} is your heaviest day</span> : null
          }
        />
        <div className="flex flex-1 flex-col gap-1">
          <WeekdayChart
            totals={weekdays}
            heaviest={heaviest}
            ariaLabel={`Spending by weekday: ${weekdays.map((v, i) => `${WEEKDAYS_SHORT[i]} ${peso(v)}`).join(", ")}`}
          />
          <div aria-hidden="true" className="grid grid-cols-7 text-center text-xs text-ink-soft">
            {WEEKDAYS_SHORT.map((d, i) => (
              <span key={d} className={i === heaviest ? "font-bold text-ink" : "font-medium"}>
                {d}
              </span>
            ))}
          </div>
        </div>
      </Card>

      <Card aria-label="How you pay" className="flex-[1_1_340px]" gap="gap-3.5">
        <CardHeader
          title="How you pay"
          aside={
            topPay ? (
              <span className="text-[13px] text-muted">
                {PAYMENT_LABELS[topPay.method]} covers {Math.round(topPay.share * 100)}% of spend
              </span>
            ) : null
          }
        />
        <StackedBar height={16} parts={pay.map((p) => ({ value: p.total, color: PAYMENT_COLORS[p.method] }))} />
        <ul className="m-0 grid flex-1 list-none grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-2.5 p-0">
          {pay.map((p) => (
            <ShareTile
              key={p.method}
              color={PAYMENT_COLORS[p.method]}
              label={PAYMENT_LABELS[p.method]}
              share={p.share}
              amount={p.total}
              note={`${p.count} expense${p.count === 1 ? "" : "s"}`}
            />
          ))}
        </ul>
      </Card>

      <Card aria-label="Fixed vs variable" className="flex-[1_1_340px]" gap="gap-3.5">
        <CardHeader
          title="Fixed vs variable"
          aside={
            stats.count > 0 ? (
              <span className="text-[13px] text-muted">{pesoExact(fv.averagePerExpense)} average per expense</span>
            ) : null
          }
        />
        <StackedBar
          height={16}
          parts={[
            { value: fv.fixed, color: "var(--ink)" },
            { value: fv.variable, color: "var(--accent-light)" },
          ]}
        />
        <ul className="m-0 grid flex-1 list-none grid-cols-2 gap-2.5 p-0">
          <ShareTile
            color="var(--ink)"
            label="Fixed"
            share={fvTotal > 0 ? fv.fixed / fvTotal : 0}
            amount={fv.fixed}
            note={fixedNames.join(" + ")}
          />
          <ShareTile
            color="var(--accent-light)"
            label="Variable"
            share={fvTotal > 0 ? fv.variable / fvTotal : 0}
            amount={fv.variable}
            note="everything else"
          />
        </ul>
      </Card>
    </div>
  );
}

function ShareTile({ color, label, share, amount, note }: { color: string; label: string; share: number; amount: number; note: string }) {
  return (
    <li className="flex min-w-0 flex-col gap-1 rounded-[12px] bg-subtle px-3.5 py-3">
      <span className="flex items-center gap-1.5 text-[13px]">
        <Dot color={color} size={10} square />
        <span className="grow truncate">{label}</span>
        <span className="text-muted">{Math.round(share * 100)}%</span>
      </span>
      <span className="font-mono text-lg leading-tight">{peso(amount)}</span>
      <span className="text-xs text-muted">{note}</span>
    </li>
  );
}
