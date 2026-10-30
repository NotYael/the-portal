import type { ReactNode } from "react";
import { Dot } from "./dot";

/** Pill toggle for filters (category chips, job filters, journal tags). */
export function FilterChip({
  pressed,
  onClick,
  color,
  size = "sm",
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  color?: string;
  size?: "sm" | "md";
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={[
        "inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border transition-colors",
        size === "sm" ? "h-9 px-3 text-[13px]" : "h-11 px-4 text-sm font-semibold",
        pressed ? "border-ink bg-ink text-on-ink" : "border-line-strong bg-surface text-ink hover:bg-subtle",
      ].join(" ")}
    >
      {color ? <Dot color={color} /> : null}
      {children}
    </button>
  );
}

/** Static pill (statuses, match %, tags). */
export function Badge({ children, tone = "accent", mono = false }: { children: ReactNode; tone?: "accent" | "warn" | "neutral" | "dark"; mono?: boolean }) {
  const tones = {
    accent: "bg-accent-soft text-accent-ink",
    warn: "bg-warn-soft text-warn-ink",
    neutral: "bg-bg text-muted",
    dark: "bg-ink text-on-ink",
  };
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ${mono ? "font-mono text-[13px] font-medium" : ""} ${tones[tone]}`}>
      {children}
    </span>
  );
}
