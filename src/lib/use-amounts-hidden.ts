"use client";

import { useSyncExternalStore } from "react";
import { amountsHidden, subscribeAmountsHidden } from "./privacy";

/** Whether "Hide amounts" is on; re-renders when it changes. */
export function useAmountsHidden(): boolean {
  return useSyncExternalStore(subscribeAmountsHidden, amountsHidden, () => false);
}
