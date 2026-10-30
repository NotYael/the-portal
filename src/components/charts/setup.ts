"use client";

import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type Plugin,
} from "chart.js";
import { currentTheme, subscribeTheme } from "@/lib/color-scheme";
import { amountsHidden } from "@/lib/privacy";
import { fontFamilies, palettes, type Palette } from "@/lib/theme";
import { useTheme } from "@/lib/use-theme";

Chart.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Tooltip);

Chart.defaults.font.family = fontFamilies.sans;
Chart.defaults.font.size = 12;
Chart.defaults.maintainAspectRatio = false;
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.cornerRadius = 8;
Chart.defaults.plugins.tooltip.displayColors = false;
Chart.defaults.plugins.tooltip.titleFont = { family: fontFamilies.sans, weight: 600 };
Chart.defaults.plugins.tooltip.bodyFont = { family: fontFamilies.mono };

function applyChartTheme() {
  const palette = palettes[currentTheme()];
  Chart.defaults.color = palette.muted;
  Chart.defaults.plugins.tooltip.backgroundColor = palette.tooltip;
}
applyChartTheme();
// Subscribed before any chart is, so the defaults change before charts re-render.
if (typeof window !== "undefined") subscribeTheme(applyChartTheme);

/**
 * The palette for the theme on screen. Give each chart `key={theme}`: a chart
 * only reads the defaults, and registers its plugins, when it's created.
 */
export function useChartTheme() {
  const theme = useTheme();
  return { theme, colors: palettes[theme] };
}

/**
 * Axes with no grid and no labels — the cards supply their own labels.
 * `bounds: "data"` ends the y axis at the data instead of rounding up to a
 * "nice" tick, which left a band of empty space above the tallest bar.
 */
export const bareScales = {
  x: { display: false, grid: { display: false } },
  y: { display: false, grid: { display: false }, beginAtZero: true, bounds: "data" },
} as const;

/**
 * True when every label fits the width of its bar's column. On a narrow chart
 * they'd run into each other, so callers skip them all rather than some.
 * Call it after setting `ctx.font`.
 */
export function labelsFit(chart: { chartArea: { width: number }; ctx: CanvasRenderingContext2D }, texts: (string | null)[]) {
  const column = chart.chartArea.width / Math.max(1, texts.length);
  return texts.every((text) => !text || chart.ctx.measureText(text).width <= column - 4);
}

/** Writes a small mono label above each bar (e.g. "18.4k"), like the mockup. */
export function valueLabels(format: (value: number, index: number) => string | null, colors: Palette): Plugin<"bar"> {
  return {
    id: "valueLabels",
    afterDatasetsDraw(chart) {
      if (amountsHidden()) return; // a row of ******* over every bar says nothing
      const { ctx } = chart;
      const lastVisible = chart.data.datasets.length - 1;
      const meta = chart.getDatasetMeta(lastVisible);
      const texts = meta.data.map((_, index) =>
        format(chart.data.datasets.reduce((sum, ds) => sum + (Number(ds.data[index]) || 0), 0), index),
      );
      ctx.save();
      ctx.font = `500 11px ${fontFamilies.mono}`;
      ctx.fillStyle = colors.inkSoft;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      if (labelsFit(chart, texts)) {
        meta.data.forEach((bar, index) => {
          const text = texts[index];
          if (!text) return;
          const top = Math.min(
            ...chart.data.datasets.map((_, di) => chart.getDatasetMeta(di).data[index]?.y ?? Infinity),
          );
          ctx.fillText(text, bar.x, top - 4);
        });
      }
      ctx.restore();
    },
  };
}
