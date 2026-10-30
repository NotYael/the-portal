export type Theme = "light" | "dark";

/**
 * Hex values for places that can't read CSS variables (Chart.js canvases).
 * Mirrors src/styles/tokens.css — change both together.
 */
const light = {
  bg: "#F3F4F6",
  surface: "#FFFFFF",
  border: "#E3E6EB",
  borderStrong: "#C9CED6",
  ink: "#111418",
  inkSoft: "#3A404B",
  muted: "#5B6270",
  accent: "#2F5BFF",
  accentInk: "#1E3FCC",
  accentSoft: "#E8EDFF",
  accentLight: "#9DB0FF",
  accentPale: "#C7D2FF",
  warn: "#E0661F",
  warnInk: "#B23D0A",
  warnSoft: "#FFF1E8",
  track: "#E9ECF1",
  divider: "#EEF0F3",
  slate: "#7C8594",
  /** Chart tooltips: --ink in light mode, --dark-raised in dark (white text on both). */
  tooltip: "#111418",
};

export type Palette = Record<keyof typeof light, string>;

export const palettes: Record<Theme, Palette> = {
  light,
  dark: {
    bg: "#0E1013",
    surface: "#171A1F",
    border: "#262A31",
    borderStrong: "#3A404B",
    ink: "#EEF0F3",
    inkSoft: "#C3C8D1",
    muted: "#959CAB",
    accent: "#3D63FF",
    accentInk: "#A9B9FF",
    accentSoft: "#1B2347",
    accentLight: "#7F97FF",
    accentPale: "#2D3A72",
    warn: "#F07A33",
    warnInk: "#FF9D63",
    warnSoft: "#311D10",
    track: "#262A31",
    divider: "#20242A",
    slate: "#7C8594",
    tooltip: "#2A2F38",
  },
};

/**
 * Category colors are stored as hex. The default "Living expenses" one is the
 * light theme's ink, which would vanish on a dark background, so it follows
 * the ink token instead. `themedColor` is for CSS, `themedCanvasColor` for charts.
 */
export function themedColor(color: string): string {
  return color.toUpperCase() === light.ink ? "var(--ink)" : color;
}

export function themedCanvasColor(color: string, palette: Palette): string {
  return color.toUpperCase() === light.ink ? palette.ink : color;
}

export const fontFamilies = {
  sans: "Inter, system-ui, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
} as const;
