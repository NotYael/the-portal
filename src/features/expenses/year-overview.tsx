"use client";

import { BarLabelButtons } from "@/components/charts/bar-labels";
import { Card, CardHeader } from "@/components/ui/card";
import { Dot } from "@/components/ui/dot";
import { StatCard } from "@/components/ui/stat-card";
import { categoryTotals, expensesInMonth, sameMonthsLabel, type YearOverview } from "@/lib/expense-stats";
import { MONTHS_SHORT, monthLong, peso, signedPercent } from "@/lib/format";
import type { Category, MonthKey } from "@/lib/types";
import { CategoryDoughnut, YearBudgetChart } from "./charts";

const th = "bg-subtle px-4 py-3 text-xs font-semibold text-muted border-b border-line";

export function YearOverviewView({
  overview,
  categories,
  onSelectMonth,
}: {
  overview: YearOverview;
  categories: Category[];
  onSelectMonth: (key: MonthKey) => void;
}) {
  const { year, vsLastYear, topCategory, biggestMonth } = overview;
  const withRecords = overview.months.filter((m) => m.hasRecords);
  const inProgress = overview.months.find((m) => m.inProgress && m.hasRecords);
  const yoyMax = Math.max(1, ...(overview.yoyByCategory ?? []).flatMap((r) => [r.current, r.previous]));
  const budgetChanges = overview.budgetChanges.map((h) => `${MONTHS_SHORT[Number(h.effective_month.slice(5, 7)) - 1]} (${peso(h.monthly_budget)})`);
  const monthRows = [...withRecords].reverse().map((m) => ({
    m,
    top: categoryTotals(expensesInMonth(overview.rows, m.key), categories)[0],
    over: m.total > m.budget,
  }));
  const vsBudget = (m: (typeof withRecords)[number], over: boolean) =>
    m.budget > 0 ? (over ? `${peso(m.total - m.budget)} over` : `${peso(m.budget - m.total)} under`) : "—";

  return (
    <>
      <section aria-label="Year stats" className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3 sm:gap-4">
        <StatCard
          label={overview.isCurrentYear ? "Spent year to date" : `Spent in ${year}`}
          value={peso(overview.total)}
          sub={`${overview.count} expenses · ${overview.monthsWithRecords} months`}
        />
        <StatCard
          label="Monthly average"
          value={peso(overview.monthlyAverage)}
          sub={`per month with records${inProgress ? ` (${MONTHS_SHORT[Number(inProgress.key.slice(5)) - 1]} in progress)` : ""}`}
        />
        <StatCard
          label="vs last year"
          value={vsLastYear?.ratio == null ? "—" : signedPercent(vsLastYear.ratio)}
          valueClassName={vsLastYear?.ratio == null ? "" : vsLastYear.ratio > 0 ? "text-warn-ink" : "text-accent-ink"}
          sub={
            vsLastYear
              ? `Same months (${sameMonthsLabel(vsLastYear)}) in ${year - 1}: ${peso(vsLastYear.previous)}`
              : `No ${year - 1} records to compare`
          }
        />
        <StatCard
          label="Months under budget"
          value={`${overview.monthsUnderBudget.under} / ${overview.monthsUnderBudget.completed}`}
          sub="completed months only"
        />
        <StatCard
          label="Top category"
          display
          value={topCategory?.category.label ?? "—"}
          sub={topCategory ? `${peso(topCategory.total)} · ${Math.round(topCategory.share * 100)}% of spend` : undefined}
        />
        <StatCard
          label="Biggest month"
          value={biggestMonth ? peso(biggestMonth.total) : "—"}
          sub={biggestMonth ? monthLong(biggestMonth.key) : undefined}
        />
      </section>

      <Card aria-label="Monthly spending vs budget">
        <CardHeader
          title="Monthly spending vs budget"
          aside={
            <div className="flex flex-wrap gap-3.5 text-[13px] text-ink-soft">
              <span className="inline-flex items-center gap-1.5"><Dot color="var(--accent)" size={10} square />Under budget</span>
              <span className="inline-flex items-center gap-1.5"><Dot color="var(--warn)" size={10} square />Over budget</span>
              <span className="inline-flex items-center gap-1.5"><Dot color="var(--accent-light)" size={10} square />In progress</span>
              <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-0.5 w-4 bg-ink" />Budget that month</span>
            </div>
          }
        />
        <div className="flex flex-col gap-1">
          <YearBudgetChart
            months={overview.months}
            onSelect={onSelectMonth}
            ariaLabel={`Spending vs budget per month in ${year}: ${withRecords.map((m) => `${MONTHS_SHORT[Number(m.key.slice(5)) - 1]} ${peso(m.total)} of ${peso(m.budget)}`).join(", ")}`}
          />
          <BarLabelButtons
            items={overview.months.map((m, i) => ({
              key: m.key,
              label: MONTHS_SHORT[i],
              short: MONTHS_SHORT[i][0],
              ariaLabel: m.future
                ? `${monthLong(m.key)}: not yet`
                : `Open ${monthLong(m.key)}: ${m.hasRecords ? `${peso(m.total)} of ${peso(m.budget)} budget` : "no records"}`,
              disabled: m.future,
              onClick: () => onSelectMonth(m.key),
            }))}
          />
        </div>
        <p className="m-0 text-[13px] text-muted">
          Tap a month to open it. The budget line follows the budget each month had
          {budgetChanges.length ? ` — changed ${budgetChanges.join(", ")}.` : "."}
        </p>
      </Card>

      <div className="flex flex-wrap gap-4">
        <Card aria-label="Year by category" className="flex-[1_1_340px]">
          <CardHeader title={`${year} by nature of purchase`} />
          <div className="flex flex-1 flex-wrap content-center items-center justify-center gap-5">
            <CategoryDoughnut
              totals={overview.categories}
              total={overview.total}
              ariaLabel={`Share of ${year} spending: ${overview.categories.map((c) => `${c.category.label} ${Math.round(c.share * 100)}%`).join(", ")}`}
            />
            <ul className="m-0 flex min-w-0 flex-[1_1_240px] list-none flex-col gap-2 p-0">
              {overview.categories.map((c) => (
                <li key={c.category.id} className="flex items-center gap-2 text-[13px]">
                  <Dot color={c.category.color} size={10} square />
                  <span className="min-w-0 grow truncate">{c.category.label}</span>
                  <span className="text-muted">{Math.round(c.share * 100)}%</span>
                  <span className="min-w-20 text-right font-mono">{peso(c.total)}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card aria-label="Year over year by category" className="flex-[1_1_380px]" gap="gap-3.5">
          <CardHeader
            title={`${year} vs ${year - 1} by category`}
            aside={vsLastYear ? <span className="text-[13px] text-muted">same months: {sameMonthsLabel(vsLastYear)}</span> : null}
          />
          {overview.yoyByCategory ? (
            <>
              <div className="flex gap-3.5 text-xs text-ink-soft">
                <span className="inline-flex items-center gap-1.5"><Dot color="var(--accent)" size={10} square />{year}</span>
                <span className="inline-flex items-center gap-1.5"><Dot color="var(--border-strong)" size={10} square />{year - 1}</span>
              </div>
              <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-x-6 gap-y-3 p-0">
                {overview.yoyByCategory.map((r) => (
                  <li key={r.category.id} className="flex flex-col gap-1">
                    <div className="flex justify-between gap-2 text-[13px]">
                      <span className="inline-flex items-center gap-1.5"><Dot color={r.category.color} />{r.category.label}</span>
                      <span
                        className={`font-semibold ${r.ratio === null ? "text-muted" : r.ratio > 0.05 ? "text-warn-ink" : r.ratio < -0.05 ? "text-accent-ink" : "text-muted"}`}
                      >
                        {r.ratio === null ? (r.current > 0 ? "new" : "—") : signedPercent(r.ratio)}
                      </span>
                    </div>
                    {[
                      { v: r.current, color: "var(--accent)", label: String(year), muted: false },
                      { v: r.previous, color: "var(--border-strong)", label: String(year - 1), muted: true },
                    ].map((bar) => (
                      <div key={bar.label} className="flex items-center gap-2">
                        <div aria-hidden="true" className="h-[7px] grow rounded bg-bg">
                          <div className="h-[7px] rounded" style={{ width: `${(bar.v / yoyMax) * 100}%`, background: bar.color }} />
                        </div>
                        <span className={`min-w-[76px] text-right font-mono text-xs ${bar.muted ? "text-muted" : ""}`}>
                          <span className="sr-only">{bar.label}: </span>
                          {peso(bar.v)}
                        </span>
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="m-0 rounded-[12px] bg-subtle p-6 text-sm text-muted">
              No {year - 1} records to compare yet. This fills in once a month has data in both years.
            </p>
          )}
        </Card>
      </div>

      <Card aria-label={`${year} by month`}>
        <h2 className="m-0 font-display text-xl font-bold">{year} by month</h2>
        <ul className="m-0 list-none p-0 sm:hidden">
          {monthRows.map(({ m, top, over }) => (
            <li key={m.key} className="border-t border-divider">
              <button
                type="button"
                onClick={() => onSelectMonth(m.key)}
                className="group flex w-full cursor-pointer items-start justify-between gap-3 py-3 text-left"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-accent-ink group-hover:underline">
                    {monthLong(m.key)}
                    {m.inProgress ? " (in progress)" : ""}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted">
                    {top ? <Dot color={top.category.color} /> : null}
                    {top?.category.label ?? "—"}
                  </span>
                </span>
                <span className="shrink-0 text-right font-mono">
                  <span className="block text-sm">{peso(m.total)}</span>
                  <span className={`block text-xs ${over ? "text-warn-ink" : "text-accent-ink"}`}>{vsBudget(m, over)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto rounded-[12px] border border-divider sm:block">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr>
                <th scope="col" className={`${th} text-left`}>Month</th>
                <th scope="col" className={`${th} text-right`}>Spent</th>
                <th scope="col" className={`${th} text-right`}>Budget</th>
                <th scope="col" className={`${th} text-right`}>vs budget</th>
                <th scope="col" className={`${th} text-left`}>Top category</th>
              </tr>
            </thead>
            <tbody>
              {monthRows.map(({ m, top, over }) => {
                return (
                  <tr key={m.key}>
                    <td className="border-b border-divider px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => onSelectMonth(m.key)}
                        className="min-h-10 cursor-pointer px-2 text-left text-sm font-semibold text-accent-ink hover:underline"
                      >
                        {monthLong(m.key)}
                        {m.inProgress ? " (in progress)" : ""}
                      </button>
                    </td>
                    <td className="border-b border-divider px-4 py-3 text-right font-mono">{peso(m.total)}</td>
                    <td className="border-b border-divider px-4 py-3 text-right font-mono text-muted">{peso(m.budget)}</td>
                    <td className={`border-b border-divider px-4 py-3 text-right font-mono ${over ? "text-warn-ink" : "text-accent-ink"}`}>
                      {vsBudget(m, over)}
                    </td>
                    <td className="border-b border-divider px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-[13px]">
                        {top ? <Dot color={top.category.color} /> : null}
                        {top?.category.label ?? "—"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {withRecords.length === 0 ? <p className="m-0 text-sm text-muted">No records in {year} yet.</p> : null}
      </Card>
    </>
  );
}
