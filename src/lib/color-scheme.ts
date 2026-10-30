/**
 * Light or dark mode. The choice is remembered per browser; until one is made
 * the Portal follows the system setting. THEME_SCRIPT runs in <head> (root
 * layout) and sets data-theme on <html> before the first paint, so the tokens
 * in styles/tokens.css switch without a flash. Chart.js can't read CSS, so
 * charts take their colors from palettes[theme] (components/charts/setup.ts).
 * Components read it with useTheme() (use-theme.ts).
 */
import type { Theme } from "./theme";

const STORAGE_KEY = "the-portal.theme";
const SYSTEM_DARK = "(prefers-color-scheme: dark)";

/** Inline script for <head>. Keep it in step with currentTheme(). */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}");if(t!=="dark"&&t!=="light")t=matchMedia("${SYSTEM_DARK}").matches?"dark":"light";document.documentElement.dataset.theme=t}catch(e){}})()`;

let theme: Theme | null = null;
const listeners = new Set<() => void>();

function readStored(): Theme | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "dark" || stored === "light" ? stored : null;
  } catch {
    return null;
  }
}

/** The theme on screen. Always "light" on the server. */
export function currentTheme(): Theme {
  if (typeof window === "undefined") return "light";
  theme ??= readStored() ?? (window.matchMedia(SYSTEM_DARK).matches ? "dark" : "light");
  return theme;
}

/** Puts the theme on <html>, where tokens.css picks it up. */
export function applyTheme() {
  document.documentElement.dataset.theme = currentTheme();
}

export function setTheme(next: Theme) {
  theme = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Blocked storage: keep the setting for this page load only.
  }
  applyTheme();
  for (const listener of listeners) listener();
}

export function subscribeTheme(listener: () => void) {
  listeners.add(listener);
  const reread = () => {
    theme = null;
    applyTheme();
    listener();
  };
  // Another tab switched it.
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) reread();
  };
  // No choice made yet: follow the system setting as it changes.
  const system = window.matchMedia(SYSTEM_DARK);
  const onSystem = () => {
    if (!readStored()) reread();
  };
  window.addEventListener("storage", onStorage);
  system.addEventListener("change", onSystem);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
    system.removeEventListener("change", onSystem);
  };
}
