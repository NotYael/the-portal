"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, useState } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import { useExpenseBook } from "@/lib/data/expense-book";
import { useToday } from "@/lib/data/store";
import { dayOfMonth, isMonthKey, monthKey, monthKeyOf, parseMonthKey } from "@/lib/dates";
import {
  computeMonthStats,
  computeYearOverview,
  firstRecordMonth,
  monthsWithRecords,
  type MonthInput,
} from "@/lib/expense-stats";
import { MONTHS_SHORT, monthLong } from "@/lib/format";
import { useAmountsHidden } from "@/lib/use-amounts-hidden";
import type { MonthKey } from "@/lib/types";
import { EmptyMonth } from "./empty-month";
import { ExpenseTable } from "./expense-table";
import { ManualForm } from "./manual-form";
import { MonthDashboard } from "./month-dashboard";
import { PeriodNav } from "./period-nav";
import { QuickAdd } from "./quick-add";
import { SettingsPanel } from "./settings-panel";
import { YearOverviewView } from "./year-overview";
import { PrivacyToggle } from "../privacy/privacy-toggle";

const SettingsIcon = () => (
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M4 6h9M19 6h1M4 12h3M13 12h7M4 18h11M21 18h-1" />
    <circle cx="16" cy="6" r="2.5" />
    <circle cx="10" cy="12" r="2.5" />
    <circle cx="18" cy="18" r="2.5" />
  </svg>
);

export function ExpensesView() {
  const { book: data, error } = useExpenseBook();
  const today = useToday();
  const params = useSearchParams();
  const router = useRouter();
  const hidden = useAmountsHidden();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [manual, setManual] = useState<{ open: boolean; prefill?: string; key: number }>({ open: false, key: 0 });

  if (!data || !today) {
    if (!error) return <PageSkeleton cards={6} label="Loading expenses" />;
    return (
      <>
        <PageHeader kicker="Your spending" title="Expenses" />
        <p role="alert" className="m-0 rounded-[12px] bg-warn-soft px-4 py-3 text-sm text-warn-ink">
          {error}
        </p>
      </>
    );
  }

  // ---- resolve ?m=YYYY-MM / ?y=YYYY against the data ----
  const currentKey = monthKeyOf(today);
  const current = parseMonthKey(currentKey);
  const firstMonth = firstRecordMonth(data.expenses);
  const firstYear = Math.min(firstMonth ? parseMonthKey(firstMonth).year : current.year, current.year);
  const clampYear = (y: number) => Math.max(firstYear, Math.min(current.year, y));

  const yParam = params.get("y");
  const mParam = params.get("m");
  let view: "month" | "year" = "month";
  let month: MonthKey = currentKey;
  let year = current.year;
  if (yParam && /^\d{4}$/.test(yParam)) {
    view = "year";
    year = clampYear(Number(yParam));
  } else if (isMonthKey(mParam)) {
    month = mParam > currentKey ? currentKey : mParam < `${firstYear}-01` ? `${firstYear}-01` : mParam;
    year = parseMonthKey(month).year;
  }

  const go = (query: { m: MonthKey } | { y: number }) => {
    const qs = "m" in query ? `m=${query.m}` : `y=${query.y}`;
    router.push(`/expenses?${qs}`, { scroll: false });
  };
  const openMonth = (key: MonthKey) => go({ m: key });
  const switchYear = (y: number) => {
    const target = clampYear(y);
    if (view === "year") return go({ y: target });
    const cap = target === current.year ? current.month : 12;
    go({ m: monthKey(target, Math.min(parseMonthKey(month).month, cap)) });
  };

  const openManual = (prefill?: string) => {
    setManual((m) => ({ open: true, prefill, key: m.key + 1 }));
    requestAnimationFrame(() => document.getElementById("manual-amount")?.focus());
  };
  const openSettings = () => {
    setSettingsOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const today_d = dayOfMonth(today);
  const isCurrentMonth = month === currentKey;
  const title = view === "year" ? `Expenses · ${year} overview` : `Expenses · ${monthLong(month)}`;
  const kicker =
    view === "year"
      ? year === current.year
        ? `Year to date · 1 Jan – ${today_d} ${MONTHS_SHORT[current.month - 1]}`
        : year === firstYear && firstMonth
          ? `Records start ${monthLong(firstMonth)}`
          : "Full year"
      : isCurrentMonth
        ? `Month in progress · 1–${today_d} ${MONTHS_SHORT[current.month - 1]}`
        : "Full month";

  const input: MonthInput = {
    expenses: data.expenses,
    categories: data.categories,
    history: data.budgetHistory,
    rolloverEnabled: data.settings.rollover_enabled,
    month,
    today,
  };
  const stats = view === "month" ? computeMonthStats(input) : null;

  return (
    <>
      <PageHeader
        kicker={kicker}
        title={title}
        actions={
          <>
            <PrivacyToggle />
            {/* Settings shows budgets in its inputs, so it's locked while amounts are hidden. */}
            {hidden ? null : (
              <Button aria-expanded={settingsOpen} aria-controls="settings-title" onClick={() => (settingsOpen ? setSettingsOpen(false) : openSettings())}>
                <SettingsIcon />
                Settings
              </Button>
            )}
            <Button onClick={() => (manual.open ? setManual((m) => ({ ...m, open: false })) : openManual())}>
              {manual.open ? "Close form" : "+ Add manually"}
            </Button>
          </>
        }
      />

      {settingsOpen && !hidden ? (
        <SettingsPanel
          settings={data.settings}
          categories={data.categories}
          history={data.budgetHistory}
          today={today}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}

      <QuickAdd categories={data.categories} settings={data.settings} today={today} onParseFailed={openManual} />

      {manual.open ? (
        <ManualForm
          key={manual.key}
          categories={data.categories}
          settings={data.settings}
          today={today}
          prefill={manual.prefill}
          onDone={() => setManual((m) => ({ ...m, open: false }))}
        />
      ) : null}

      {/* Remount on the switch so every chart redraws its labels. */}
      <Fragment key={hidden ? "hidden" : "shown"}>
      <PeriodNav
        year={year}
        view={view}
        month={month}
        firstYear={firstYear}
        currentKey={currentKey}
        recordMonths={monthsWithRecords(data.expenses)}
        onYear={switchYear}
        onMonth={openMonth}
        onYearView={() => go({ y: year })}
      />

      {view === "year" ? (
        <YearOverviewView
          overview={computeYearOverview({ expenses: data.expenses, categories: data.categories, history: data.budgetHistory, today, year })}
          categories={data.categories}
          onSelectMonth={openMonth}
        />
      ) : stats && stats.count === 0 ? (
        <EmptyMonth month={month} firstMonth={firstMonth} onGoFirst={() => firstMonth && openMonth(firstMonth)} onAdd={() => openManual()} />
      ) : stats ? (
        <>
          <MonthDashboard
            stats={stats}
            input={input}
            settings={data.settings}
            categories={data.categories}
            onSelectMonth={openMonth}
            onEditBudgets={openSettings}
          />
          <ExpenseTable key={month} month={month} rows={stats.rows} categories={data.categories} today={today} />
        </>
      ) : null}
      </Fragment>
    </>
  );
}
