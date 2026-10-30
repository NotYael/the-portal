"use client";

import { useLayoutEffect } from "react";
import { applyTheme, setTheme } from "@/lib/color-scheme";
import { useTheme } from "@/lib/use-theme";

/**
 * Dark mode switch. The track and knob are styled from <html data-theme>
 * (the `dark:` variant), not from state, so they're right from the first
 * paint instead of flipping after hydration.
 */
export function ThemeToggle({ showLabel = true }: { showLabel?: boolean }) {
  const dark = useTheme() === "dark";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={showLabel ? undefined : "Dark mode"}
      onClick={() => setTheme(dark ? "light" : "dark")}
      className="group flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-[10px] px-2 text-sm font-medium text-ink-soft hover:text-ink"
    >
      {showLabel ? <span>Dark mode</span> : null}
      <span
        aria-hidden="true"
        className="relative h-6 w-11 shrink-0 rounded-full bg-line-strong transition-colors group-hover:bg-muted dark:bg-accent dark:group-hover:bg-accent-strong"
      >
        <span className="absolute top-0.5 left-0.5 flex size-5 items-center justify-center rounded-full bg-white text-[#5B6270] shadow-sm transition-transform dark:translate-x-5 dark:text-[#2F5BFF]">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="dark:hidden">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="hidden dark:block">
            <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />
          </svg>
        </span>
      </span>
    </button>
  );
}

/**
 * Re-applies the theme after React's dev Strict Mode remount resets <html> to
 * the attributes it manages, dropping the one THEME_SCRIPT set. No-op in production.
 */
export function ThemeSync() {
  useLayoutEffect(() => applyTheme(), []);
  return null;
}
