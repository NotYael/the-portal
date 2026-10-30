"use client";

import { useSyncExternalStore } from "react";
import { currentTheme, subscribeTheme } from "./color-scheme";
import type { Theme } from "./theme";

/** Light or dark mode; re-renders when it changes. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribeTheme, currentTheme, () => "light");
}
