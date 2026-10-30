"use client";

import { useEffect, useRef } from "react";
import { monthKey, parseMonthKey } from "@/lib/dates";
import { MONTHS_SHORT, monthLong } from "@/lib/format";
import type { MonthKey } from "@/lib/types";

export function PeriodNav({
  year,
  view,
  month,
  firstYear,
  currentKey,
  recordMonths,
  onYear,
  onMonth,
  onYearView,
}: {
  year: number;
  view: "month" | "year";
  month: MonthKey;
  firstYear: number;
  currentKey: MonthKey;
  recordMonths: Set<MonthKey>;
  onYear: (year: number) => void;
  onMonth: (key: MonthKey) => void;
  onYearView: () => void;
}) {
  const current = parseMonthKey(currentKey);
  const lastMonth = year === current.year ? current.month : 12;
  const canPrev = year > firstYear;
  const canNext = year < current.year;
  const strip = useRef<HTMLDivElement>(null);

  // The months scroll sideways beside the fixed year picker: keep the open month (or Year) in view.
  useEffect(() => {
    const el = strip.current;
    const tab = el?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!el || !tab) return;
    const r = el.getBoundingClientRect();
    const t = tab.getBoundingClientRect();
    el.scrollLeft += t.left - r.left - (r.width - t.width) / 2;
  }, [year, view, month]);

  return (
    <div className="flex items-center gap-1 sm:gap-3">
      <div role="group" aria-label="Year" className="inline-flex shrink-0 items-center gap-0.5 rounded-[12px] border border-line-strong bg-surface p-0.5">
        <button
          type="button"
          onClick={() => onYear(year - 1)}
          disabled={!canPrev}
          aria-label="Previous year"
          className="size-11 cursor-pointer rounded-[10px] text-xl text-ink hover:bg-subtle disabled:cursor-not-allowed disabled:text-line-strong disabled:hover:bg-transparent"
        >
          ‹
        </button>
        <span aria-live="polite" className="min-w-12 text-center font-mono text-[15px]">
          {year}
        </span>
        <button
          type="button"
          onClick={() => onYear(year + 1)}
          disabled={!canNext}
          aria-label="Next year"
          className="size-11 cursor-pointer rounded-[10px] text-xl text-ink hover:bg-subtle disabled:cursor-not-allowed disabled:text-line-strong disabled:hover:bg-transparent"
        >
          ›
        </button>
      </div>

      <div
        ref={strip}
        className="-mr-4 min-w-0 flex-1 overflow-x-auto pr-4 pl-2 [mask-image:linear-gradient(to_right,transparent,black_10px)] [scrollbar-width:none] sm:mr-0 sm:pr-0 sm:pl-0 sm:[mask-image:none]"
      >
        <div role="tablist" aria-label={`Months of ${year}`} className="flex w-max gap-1.5 pt-0.5 pb-1">
          {Array.from({ length: lastMonth }, (_, i) => {
            const key = monthKey(year, i + 1);
            const selected = view === "month" && key === month;
            const has = recordMonths.has(key);
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-label={`${monthLong(key)}${has ? "" : " — no expenses"}`}
                onClick={() => onMonth(key)}
                className={[
                  "h-11 min-w-14 cursor-pointer rounded-[10px] border px-3.5 text-sm font-semibold",
                  selected
                    ? "border-ink bg-ink text-on-ink"
                    : has
                      ? "border-line-strong bg-surface text-ink hover:bg-subtle"
                      : "border-dashed border-[#D5D9E0] bg-surface text-muted hover:bg-subtle dark:border-line-strong",
                ].join(" ")}
              >
                {MONTHS_SHORT[i]}
              </button>
            );
          })}
          <button
            type="button"
            role="tab"
            aria-selected={view === "year"}
            aria-label={`${year} overview`}
            onClick={onYearView}
            className={[
              "ml-2.5 h-11 min-w-14 cursor-pointer rounded-[10px] border px-3.5 text-sm font-semibold",
              view === "year" ? "border-accent bg-accent text-white" : "border-accent-pale bg-accent-soft text-accent-ink hover:bg-accent-pale",
            ].join(" ")}
          >
            Year
          </button>
        </div>
      </div>
    </div>
  );
}
