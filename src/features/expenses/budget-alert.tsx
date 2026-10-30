"use client";

import { useState } from "react";
import type { MonthStats } from "@/lib/expense-stats";
import { MONTHS_LONG, monthLong } from "@/lib/format";
import { parseMonthKey } from "@/lib/dates";

const key = (month: string, pct: number) => `the-portal.budget-alert-dismissed.${month}.${pct}`;

function isDismissed(month: string, pct: number) {
  try {
    return window.localStorage.getItem(key(month, pct)) === "1";
  } catch {
    return false;
  }
}

/** Dismissible warning once budget used reaches the threshold from Settings. */
export function BudgetAlert({ stats, thresholdPct }: { stats: MonthStats; thresholdPct: number }) {
  const [dismissed, setDismissed] = useState(() => isDismissed(stats.month, thresholdPct));
  const ratio = stats.usage.ratio;
  if (dismissed || ratio === null || ratio * 100 < thresholdPct) return null;

  const daysLeft = stats.daysInMonth - stats.daysCounted;
  const monthName = MONTHS_LONG[parseMonthKey(stats.month).month - 1];
  const dismiss = () => {
    try {
      window.localStorage.setItem(key(stats.month, thresholdPct), "1");
    } catch {}
    setDismissed(true);
  };

  return (
    <div role="status" className="flex items-center justify-between gap-3 rounded-[16px] border border-warn-line bg-warn-soft py-3 pr-2 pl-4 sm:pl-5">
      <p className="m-0 min-w-0 flex-1 text-sm font-medium text-warn-ink">
        You’ve used {Math.round(ratio * 100)}% of your {monthName} budget
        {daysLeft > 0 ? ` with ${daysLeft} day${daysLeft === 1 ? "" : "s"} left.` : "."}
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label={`Dismiss budget alert for ${monthLong(stats.month)}`}
        className="min-h-11 shrink-0 cursor-pointer rounded-[10px] px-3 text-sm font-semibold text-warn-ink hover:bg-surface"
      >
        Dismiss
      </button>
    </div>
  );
}
