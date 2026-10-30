"use client";

import { useState } from "react";
import { BarLabelButtons } from "@/components/charts/bar-labels";
import { Card, CardHeader } from "@/components/ui/card";
import { Dot } from "@/components/ui/dot";
import { ProgressBar } from "@/components/ui/progress-bar";
import { StatCard } from "@/components/ui/stat-card";
import {
  dailyTotals,
  monthTotalsSeries,
  previousLabel,
  templateInsights,
  topExpenses,
  type MonthInput,
  type MonthStats,
} from "@/lib/expense-stats";
import {
  monthLong,
  monthShortMaybeYear,
  monthShortYear,
  peso,
  pesoExact,
  shortDate,
  signedPercent,
} from "@/lib/format";
import { parseMonthKey } from "@/lib/dates";
import type { Category, ExpenseSettings, MonthKey } from "@/lib/types";
import { AdvancedBreakdown } from "./advanced-breakdown";
import { BudgetAlert } from "./budget-alert";
import { CategoryDoughnut, DailySpendingChart, TrendChart } from "./charts";
import { InsightsPanel } from "./insights-panel";

const ADV_KEY = "the-portal.expenses.advanced-open";

function readAdvancedOpen() {
  try {
    return window.localStorage.getItem(ADV_KEY) === "1";
  } catch {
    return false;
  }
}

export function MonthDashboard({
  stats,
  input,
  settings,
  categories,
  onSelectMonth,
  onEditBudgets,
}: {
  stats: MonthStats;
  input: MonthInput;
  settings: ExpenseSettings;
  categories: Category[];
  onSelectMonth: (key: MonthKey) => void;
  onEditBudgets: () => void;
}) {
  const [advancedOpen, setAdvancedOpen] = useState(readAdvancedOpen);
  const toggleAdvanced = () => {
    setAdvancedOpen((open) => {
      try {
        window.localStorage.setItem(ADV_KEY, open ? "0" : "1");
      } catch {}
      return !open;
    });
  };

  const { usage, budget, previous, topCategory, biggestDay } = stats;
  const byId = new Map(categories.map((c) => [c.id, c]));
  const days = dailyTotals(stats.rows, stats.month, input.today);
  const peak = days.reduce((best, d) => (!d.future && d.total > best.total ? d : best), days[0]);
  const trend = monthTotalsSeries(input.expenses, stats.month, 6);
  const spansYears = parseMonthKey(trend[0].key).year !== parseMonthKey(trend[5].key).year;
  const insights = templateInsights(stats, input);

  const changeColor = stats.change === null ? "" : stats.change > 0 ? "text-warn-ink" : "text-accent-ink";
  const budgetSub =
    usage.ratio === null
      ? "No budget set"
      : usage.isOver
        ? `${peso(usage.over)} over ${peso(budget.total)}`
        : `${peso(usage.left)} left of ${peso(budget.total)}`;

  return (
    <>
      {stats.isCurrent ? (
        <BudgetAlert stats={stats} thresholdPct={settings.alert_threshold_pct} />
      ) : null}

      <section aria-label="Month stats" className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3 sm:gap-4">
        <StatCard label="Total spent" value={peso(stats.total)} sub={`${stats.count} expense${stats.count === 1 ? "" : "s"}`} />
        <StatCard label="Daily average" value={peso(stats.dailyAverage)} sub={`over ${stats.daysCounted} days`} />
        <StatCard
          label="vs last month"
          value={stats.change === null ? "—" : signedPercent(stats.change)}
          valueClassName={changeColor}
          sub={
            previous.hasRecords
              ? `${stats.total >= previous.total ? "more" : "less"} than ${previousLabel(previous, stats.month)} (${peso(previous.total)})`
              : `No records for ${monthShortYear(previous.key)}`
          }
        />
        <StatCard
          label="Top category"
          display
          value={topCategory?.category.label ?? "—"}
          sub={topCategory ? `${peso(topCategory.total)} · ${Math.round(topCategory.share * 100)}% of spend` : undefined}
        />
        <StatCard
          label="Biggest day"
          value={biggestDay ? peso(biggestDay.total) : "—"}
          sub={biggestDay ? shortDate(biggestDay.date) : undefined}
        />
        <StatCard
          label="Budget used"
          value={usage.ratio === null ? "—" : `${Math.round(usage.ratio * 100)}%`}
          valueClassName={usage.isOver ? "text-warn-ink" : ""}
          sub={budgetSub}
          note={
            budget.setFrom
              ? `Budget set ${monthShortYear(budget.setFrom)}${budget.rollover > 0 ? ` · +${peso(budget.rollover)} rollover` : ""}`
              : undefined
          }
        >
          {usage.ratio !== null ? (
            <ProgressBar ratio={usage.ratio} color={usage.isOver ? "var(--warn)" : "var(--accent)"} />
          ) : null}
        </StatCard>
      </section>

      {settings.ai_insights_enabled ? <InsightsPanel stats={stats} input={input} templates={insights} /> : null}

      <div className="flex flex-wrap gap-4">
        <Card aria-label="Daily spending" className="flex-[2_1_480px]">
          <CardHeader title="Daily spending" aside={<span className="text-[13px] text-muted">peak {peso(peak.total)}</span>} />
          <DailySpendingChart
            days={days}
            ariaLabel={`Daily spending for ${monthLong(stats.month)}, peak ${peso(peak.total)} on ${shortDate(peak.date)}`}
          />
        </Card>

        <Card aria-label="By nature of purchase" className="flex-[1_1_320px]">
          <CardHeader title="By nature of purchase" />
          <div className="flex flex-1 flex-wrap content-center items-center justify-center gap-5">
            <CategoryDoughnut
              totals={stats.categories}
              total={stats.total}
              ariaLabel={`Share of spending: ${stats.categories.map((c) => `${c.category.label} ${Math.round(c.share * 100)}%`).join(", ")}`}
            />
            <ul className="m-0 flex min-w-0 flex-[1_1_240px] list-none flex-col gap-2 p-0">
              {stats.categories.map((c) => (
                <li key={c.category.id} className="flex items-center gap-2 text-[13px]">
                  <Dot color={c.category.color} size={10} square />
                  <span className="min-w-0 grow truncate">{c.category.label}</span>
                  <span className="text-muted">{Math.round(c.share * 100)}%</span>
                  <span className="min-w-[72px] text-right font-mono">{peso(c.total)}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap gap-4">
        <Card aria-label="Monthly trend" className="flex-[1_1_380px]">
          <CardHeader title="Last 6 months" aside={<span className="text-[13px] text-muted">tap a month to open it</span>} />
          <div className="flex flex-1 flex-col gap-1">
            <TrendChart
              series={trend}
              selected={stats.month}
              onSelect={onSelectMonth}
              ariaLabel={`Monthly totals: ${trend.map((t) => `${monthShortYear(t.key)} ${peso(t.total)}`).join(", ")}`}
            />
            <BarLabelButtons
              items={trend.map((t) => ({
                key: t.key,
                label: monthShortMaybeYear(t.key, spansYears),
                ariaLabel: `Open ${monthLong(t.key)}: ${peso(t.total)}`,
                selected: t.key === stats.month,
                onClick: () => onSelectMonth(t.key),
              }))}
            />
          </div>
        </Card>

        <Card aria-label="Biggest expenses" className="flex-[1_1_380px]" gap="gap-1">
          <h2 className="m-0 mb-2 font-display text-xl font-bold">Biggest expenses</h2>
          <ul className="m-0 list-none p-0">
            {topExpenses(stats.rows, 5).map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 border-t border-divider py-2.5">
                <div className="min-w-0">
                  <p className="m-0 truncate text-sm font-medium">{e.description}</p>
                  <p className="mt-0.5 mb-0 text-[13px] text-muted">
                    {byId.get(e.category_id)?.label ?? "—"} · {shortDate(e.spent_on)}
                  </p>
                </div>
                <span className="font-mono text-sm">{pesoExact(e.amount)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <button
        type="button"
        onClick={toggleAdvanced}
        aria-expanded={advancedOpen}
        aria-controls="advanced-breakdown"
        className="flex h-[52px] w-full cursor-pointer items-center justify-center rounded-[12px] border border-dashed border-accent-light bg-surface text-[15px] font-semibold text-accent-ink hover:bg-accent-soft"
      >
        {advancedOpen ? "Hide advanced breakdown ▴" : "Advanced breakdown ▾"}
      </button>

      {advancedOpen ? <AdvancedBreakdown stats={stats} input={input} onEditBudgets={onEditBudgets} /> : null}
    </>
  );
}
