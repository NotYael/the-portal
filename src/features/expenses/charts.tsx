"use client";

import type { ChartOptions, Plugin } from "chart.js";
import type { ReactNode } from "react";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { bareScales, labelsFit, useChartTheme, valueLabels } from "@/components/charts/setup";
import type { CategoryTotal, DayTotal, PaceSeries, YearMonth } from "@/lib/expense-stats";
import { compactPeso, monthShort, peso, shortDate } from "@/lib/format";
import { amountsHidden } from "@/lib/privacy";
import { fontFamilies, themedCanvasColor, type Palette } from "@/lib/theme";
import type { Category, MonthKey } from "@/lib/types";

const LABEL_DAYS = new Set([1, 8, 15, 22, 29]);

/**
 * A chart area at least `minHeight` tall that grows to fill its card when a
 * card beside it is taller. The canvas sits on an absolute layer so its own
 * size never holds the card open (Chart.js would grow but never shrink back).
 */
function ChartFill({ minHeight, children }: { minHeight: number; children: ReactNode }) {
  return (
    <div className="relative flex-1" style={{ minHeight }}>
      <div className="absolute inset-0">{children}</div>
    </div>
  );
}

// ---------- daily spending ----------

export function DailySpendingChart({ days, ariaLabel }: { days: DayTotal[]; ariaLabel: string }) {
  const { theme, colors } = useChartTheme();
  const max = Math.max(1, ...days.map((d) => d.total));
  const peak = days.reduce((best, d, i) => (!d.future && d.total > days[best].total ? i : best), 0);
  const stub = max * 0.015;
  const options: ChartOptions<"bar"> = {
    animation: false,
    layout: { padding: { top: 4 } },
    scales: {
      x: {
        grid: { display: false },
        border: { color: colors.border },
        ticks: {
          autoSkip: false,
          maxRotation: 0,
          font: { size: 11 },
          callback: (_, index) => (LABEL_DAYS.has(index + 1) ? String(index + 1) : ""),
        },
      },
      y: { display: false, beginAtZero: true, bounds: "data", suggestedMax: max * 1.05 },
    },
    plugins: {
      tooltip: {
        filter: (item) => !days[item.dataIndex].future,
        callbacks: {
          title: (items) => shortDate(days[items[0].dataIndex].date),
          label: (item) => peso(days[item.dataIndex].total),
        },
      },
    },
  };
  return (
    <ChartFill minHeight={200}>
      <Bar
        key={theme}
        role="img"
        aria-label={ariaLabel}
        options={options}
        data={{
          labels: days.map((d) => String(d.day)),
          datasets: [
            {
              data: days.map((d) => (d.future ? stub : d.total)),
              backgroundColor: days.map((d, i) => (d.future ? colors.track : i === peak ? colors.warn : colors.accent)),
              borderRadius: { topLeft: 3, topRight: 3 },
              borderSkipped: "bottom",
              categoryPercentage: 0.9,
              barPercentage: 0.85,
            },
          ],
        }}
      />
    </ChartFill>
  );
}

// ---------- doughnut ----------

export function CategoryDoughnut({ totals, total, ariaLabel }: { totals: CategoryTotal[]; total: number; ariaLabel: string }) {
  const { theme, colors } = useChartTheme();
  const options: ChartOptions<"doughnut"> = {
    animation: false,
    cutout: "65%",
    plugins: {
      tooltip: {
        callbacks: {
          title: (items) => totals[items[0].dataIndex].category.label,
          label: (item) => `${peso(totals[item.dataIndex].total)} · ${Math.round(totals[item.dataIndex].share * 100)}%`,
        },
      },
    },
  };
  return (
    <div className="relative size-40 shrink-0">
      <Doughnut
        key={theme}
        role="img"
        aria-label={ariaLabel}
        options={options}
        data={{
          labels: totals.map((t) => t.category.label),
          datasets: [
            {
              data: totals.length ? totals.map((t) => t.total) : [1],
              backgroundColor: totals.length ? totals.map((t) => themedCanvasColor(t.category.color, colors)) : [colors.divider],
              borderWidth: 0,
            },
          ],
        }}
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[11px] text-muted">Total</span>
        <span className="font-mono text-[15px]">{peso(total)}</span>
      </div>
    </div>
  );
}

// ---------- last 6 months ----------

export function TrendChart({
  series,
  selected,
  onSelect,
  ariaLabel,
}: {
  series: { key: MonthKey; total: number }[];
  selected: MonthKey;
  onSelect: (key: MonthKey) => void;
  ariaLabel: string;
}) {
  const { theme, colors } = useChartTheme();
  const max = Math.max(1, ...series.map((s) => s.total));
  const options: ChartOptions<"bar"> = {
    animation: false,
    layout: { padding: { top: 18 } },
    scales: { ...bareScales, y: { ...bareScales.y, suggestedMax: max } },
    onClick: (_, elements) => {
      if (elements[0]) onSelect(series[elements[0].index].key);
    },
    onHover: (event, elements) => {
      const target = event.native?.target as HTMLElement | undefined;
      if (target) target.style.cursor = elements.length ? "pointer" : "default";
    },
    plugins: {
      tooltip: {
        callbacks: {
          title: (items) => monthShort(series[items[0].dataIndex].key),
          label: (item) => peso(series[item.dataIndex].total),
        },
      },
    },
  };
  return (
    <ChartFill minHeight={170}>
      <Bar
        key={theme}
        role="img"
        aria-label={ariaLabel}
        options={options}
        plugins={[valueLabels((v) => compactPeso(v), colors)]}
        data={{
          labels: series.map((s) => s.key),
          datasets: [
            {
              data: series.map((s) => s.total),
              backgroundColor: series.map((s) => (s.key === selected ? colors.ink : colors.accentPale)),
              borderRadius: { topLeft: 6, topRight: 6 },
              borderSkipped: "bottom",
              categoryPercentage: 0.85,
              barPercentage: 0.9,
              minBarLength: 2,
            },
          ],
        }}
      />
    </ChartFill>
  );
}

// ---------- year: monthly spending vs budget ----------

/**
 * Draws a dark tick on each bar at that month's budget, and the bar's value
 * above whichever is higher so the two never collide.
 */
function budgetTicks(months: YearMonth[], colors: Palette): Plugin<"bar"> {
  return {
    id: "budgetTicks",
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      const y = chart.scales.y;
      const meta = chart.getDatasetMeta(0);
      ctx.save();
      ctx.font = `500 11px ${fontFamilies.mono}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      const showValues = !amountsHidden() && labelsFit(chart, months.map((m) => (m.hasRecords ? compactPeso(m.total) : null)));
      meta.data.forEach((bar, i) => {
        const m = months[i];
        if (!m || !m.hasRecords) return;
        const { width } = bar.getProps(["width"], true) as { width: number };
        let labelY = bar.y;
        if (m.budget > 0) {
          const tick = y.getPixelForValue(m.budget);
          ctx.fillStyle = colors.ink;
          ctx.fillRect(bar.x - width / 2 - 3, tick - 1, width + 6, 2);
          labelY = Math.min(labelY, tick);
        }
        if (!showValues) return;
        ctx.fillStyle = colors.inkSoft;
        ctx.fillText(compactPeso(m.total), bar.x, labelY - 4);
      });
      ctx.restore();
    },
  };
}

export function YearBudgetChart({ months, onSelect, ariaLabel }: { months: YearMonth[]; onSelect: (key: MonthKey) => void; ariaLabel: string }) {
  const { theme, colors } = useChartTheme();
  const max = Math.max(1, ...months.map((m) => (m.hasRecords ? Math.max(m.total, m.budget) : 0)));
  const color = (m: YearMonth) =>
    m.future ? "transparent" : !m.hasRecords ? colors.track : m.inProgress ? colors.accentLight : m.isOver ? colors.warn : colors.accent;
  const options: ChartOptions<"bar"> = {
    animation: false,
    layout: { padding: { top: 18 } },
    scales: { ...bareScales, y: { ...bareScales.y, suggestedMax: max * 1.04 } },
    onClick: (_, elements) => {
      const m = elements[0] ? months[elements[0].index] : null;
      if (m && !m.future) onSelect(m.key);
    },
    onHover: (event, elements) => {
      const target = event.native?.target as HTMLElement | undefined;
      const m = elements[0] ? months[elements[0].index] : null;
      if (target) target.style.cursor = m && !m.future ? "pointer" : "default";
    },
    plugins: {
      tooltip: {
        filter: (item) => !months[item.dataIndex].future,
        callbacks: {
          title: (items) => monthShort(months[items[0].dataIndex].key),
          label: (item) => {
            const m = months[item.dataIndex];
            return m.hasRecords ? [`Spent ${peso(m.total)}`, `Budget ${peso(m.budget)}`] : "No records";
          },
        },
      },
    },
  };
  return (
    <div className="h-[200px]">
      {/* react-chartjs-2 registers plugins once per chart, so remount when the year or theme changes. */}
      <Bar
        key={`${theme}-${months[0]?.key}`}
        role="img"
        aria-label={ariaLabel}
        options={options}
        plugins={[budgetTicks(months, colors)]}
        data={{
          labels: months.map((m) => m.key),
          datasets: [
            {
              data: months.map((m) => (m.hasRecords ? m.total : m.future ? 0 : max * 0.015)),
              backgroundColor: months.map(color),
              borderRadius: { topLeft: 6, topRight: 6 },
              borderSkipped: "bottom",
              categoryPercentage: 0.8,
              barPercentage: 0.9,
            },
          ],
        }}
      />
    </div>
  );
}

// ---------- advanced: spending pace ----------

export function PaceChart({ pace, budget, ariaLabel }: { pace: PaceSeries; budget: number; ariaLabel: string }) {
  const { theme, colors } = useChartTheme();
  const labels = Array.from({ length: pace.days }, (_, i) => i + 1);
  const projection = new Map(pace.projection.map((p) => [p.day, p.value]));
  const top = Math.max(budget, pace.projected, pace.actual.at(-1) ?? 0, 1);
  const options: ChartOptions<"line"> = {
    animation: false,
    layout: { padding: { top: 8, bottom: 4 } },
    elements: { point: { radius: 0, hoverRadius: 3 } },
    interaction: { mode: "index", intersect: false },
    scales: {
      x: { display: false },
      y: { display: false, beginAtZero: true, bounds: "data", suggestedMax: top * 1.08 },
    },
    plugins: {
      tooltip: {
        callbacks: {
          title: (items) => `Day ${items[0].dataIndex + 1}`,
          label: (item) => (item.raw == null ? "" : `${item.dataset.label}: ${peso(Number(item.raw))}`),
        },
      },
    },
  };
  return (
    <div className="h-[220px] rounded-lg bg-[#FAFBFC] dark:bg-subtle">
      <Line
        key={theme}
        role="img"
        aria-label={ariaLabel}
        options={options}
        data={{
          labels,
          datasets: [
            {
              label: "Actual",
              data: labels.map((d) => pace.actual[d - 1] ?? null),
              borderColor: colors.accent,
              borderWidth: 3,
              tension: 0.15,
            },
            {
              label: "Projected",
              data: labels.map((d) => projection.get(d) ?? null),
              borderColor: colors.slate,
              borderWidth: 2,
              borderDash: [4, 4],
            },
            {
              label: "Budget",
              data: labels.map(() => (budget > 0 ? budget : null)),
              borderColor: colors.warn,
              borderWidth: 2,
              borderDash: [6, 4],
            },
          ],
        }}
      />
    </div>
  );
}

// ---------- advanced: categories over 6 months ----------

/** Outlines the selected month's whole stack. */
function outlineStack(index: number, colors: Palette): Plugin<"bar"> {
  return {
    id: "outlineStack",
    afterDatasetsDraw(chart) {
      const bars = chart.data.datasets
        .map((_, di) => chart.getDatasetMeta(di).data[index])
        .filter((b): b is NonNullable<typeof b> => !!b);
      if (!bars.length) return;
      const { width } = bars[0].getProps(["width"], true) as { width: number };
      const top = Math.min(...bars.map((b) => b.y));
      const bottom = chart.scales.y.getPixelForValue(0);
      if (bottom - top < 1) return;
      const { ctx } = chart;
      ctx.save();
      ctx.strokeStyle = colors.ink;
      ctx.lineWidth = 2;
      ctx.strokeRect(bars[0].x - width / 2 - 3, top - 3, width + 6, bottom - top + 3);
      ctx.restore();
    },
  };
}

export function CategoryStackChart({
  months,
  categories,
  selectedIndex,
  ariaLabel,
}: {
  months: { key: MonthKey; byCategory: Map<string, number> }[];
  categories: readonly Category[];
  selectedIndex: number;
  ariaLabel: string;
}) {
  const { theme, colors } = useChartTheme();
  const options: ChartOptions<"bar"> = {
    animation: false,
    layout: { padding: { top: 18 } },
    scales: {
      x: { stacked: true, display: false },
      y: { stacked: true, display: false, beginAtZero: true, bounds: "data" },
    },
    plugins: {
      tooltip: {
        mode: "index",
        callbacks: {
          title: (items) => monthShort(months[items[0].dataIndex].key),
          label: (item) => (Number(item.raw) > 0 ? `${item.dataset.label}: ${peso(Number(item.raw))}` : ""),
        },
        filter: (item) => Number(item.raw) > 0,
      },
    },
  };
  return (
    <ChartFill minHeight={180}>
      <Bar
        key={theme}
        role="img"
        aria-label={ariaLabel}
        options={options}
        plugins={[outlineStack(selectedIndex, colors), valueLabels((v) => (v > 0 ? compactPeso(v) : null), colors)]}
        data={{
          labels: months.map((m) => m.key),
          datasets: categories.map((c) => ({
            label: c.label,
            data: months.map((m) => m.byCategory.get(c.id) ?? 0),
            backgroundColor: themedCanvasColor(c.color, colors),
            categoryPercentage: 0.75,
            barPercentage: 0.9,
          })),
        }}
      />
    </ChartFill>
  );
}

// ---------- advanced: by day of week ----------

export function WeekdayChart({ totals, heaviest, ariaLabel }: { totals: number[]; heaviest: number; ariaLabel: string }) {
  const { theme, colors } = useChartTheme();
  const options: ChartOptions<"bar"> = {
    animation: false,
    layout: { padding: { top: 18 } },
    scales: bareScales,
    plugins: {
      tooltip: { callbacks: { label: (item) => peso(Number(item.raw)) } },
    },
  };
  return (
    <ChartFill minHeight={180}>
      <Bar
        key={theme}
        role="img"
        aria-label={ariaLabel}
        options={options}
        plugins={[valueLabels((v) => compactPeso(v), colors)]}
        data={{
          labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
          datasets: [
            {
              data: totals,
              backgroundColor: totals.map((_, i) => (i === heaviest ? colors.warn : colors.accent)),
              borderRadius: { topLeft: 6, topRight: 6 },
              borderSkipped: "bottom",
              minBarLength: 2,
            },
          ],
        }}
      />
    </ChartFill>
  );
}
