"use client";

/**
 * The countdown on Home and in the sidebar: the latest row of `countdowns`.
 * With Supabase it's the signed-in user's table, which only allows reading
 * and starting one (…_countdowns.sql); in demo mode it lives in its own
 * localStorage key. There is no stop, edit or delete on purpose.
 */
import { useEffect, useSyncExternalStore } from "react";
import { countdownEnd } from "../countdown";
import type { TablesInsert } from "../database.types";
import { supabaseBrowser } from "../supabase/client";
import { supabaseConfigured } from "../supabase/config";
import type { Countdown, CountdownMonths } from "../types";

export interface CountdownState {
  /** False until the first load finishes (show a placeholder). */
  loaded: boolean;
  /** The latest countdown, running or finished; null when none was ever started. */
  countdown: Countdown | null;
  error: string | null;
}

export type StartResult = "started" | "already-running" | "failed";

const COLUMNS = "id, title, months, started_at, ends_at";
const SERVER_STATE: CountdownState = { loaded: false, countdown: null, error: null };

let state: CountdownState = SERVER_STATE;
const listeners = new Set<() => void>();

function emit(next: CountdownState) {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const isRunning = (c: Countdown | null) => !!c && new Date(c.ends_at).getTime() > Date.now();

// ---------- Supabase ----------

let loading = false;

async function load() {
  if (loading) return;
  loading = true;
  try {
    // RLS scopes it to the signed-in user.
    const { data, error } = await supabaseBrowser()
      .from("countdowns")
      .select(COLUMNS)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      emit({ ...state, loaded: true, error: "Couldn’t load your countdown. Refresh to try again." });
      return;
    }
    // The months check constraint guarantees the narrower type.
    emit({ loaded: true, countdown: data as Countdown | null, error: null });
  } finally {
    loading = false;
  }
}

function useSupabaseCountdown(): CountdownState {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
  // Show what's cached right away and refresh it on every visit.
  useEffect(() => {
    void load();
  }, []);
  return snapshot;
}

// ---------- demo mode ----------

const STORAGE_KEY = "the-portal.mock-countdown.v1";

function loadMock(): Countdown | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Countdown) : null;
  } catch {
    // Corrupt or blocked storage: start without one.
    return null;
  }
}

function saveMock(countdown: Countdown) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(countdown));
  } catch {
    // Private mode or quota: keep working in memory.
  }
}

function useMockCountdown(): CountdownState {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
  useEffect(() => {
    if (!state.loaded) emit({ loaded: true, countdown: loadMock(), error: null });
  }, []);
  return snapshot;
}

// ---------- public API ----------

/** `supabaseConfigured` is fixed at build time, so each build always calls the same hook. */
export const useCountdown: () => CountdownState = supabaseConfigured ? useSupabaseCountdown : useMockCountdown;

/** Starts a countdown. It can't be stopped afterwards, and only one runs at a time. */
export async function startCountdown(title: string, months: CountdownMonths): Promise<StartResult> {
  if (isRunning(state.countdown)) return "already-running";
  if (!supabaseConfigured) {
    const start = new Date();
    const countdown: Countdown = {
      id: crypto.randomUUID(),
      title,
      months,
      started_at: start.toISOString(),
      ends_at: countdownEnd(start, months).toISOString(),
    };
    saveMock(countdown);
    emit({ loaded: true, countdown, error: null });
    return "started";
  }
  // Only title and months may be inserted: the trigger sets started_at and
  // ends_at, which the generated Insert type still lists as required.
  const row = { title, months } as TablesInsert<"countdowns">;
  const { data, error } = await supabaseBrowser().from("countdowns").insert(row).select(COLUMNS).single();
  if (error) {
    // 55000: another one is still running (started in another tab or device).
    if (error.code === "55000") {
      await load();
      return "already-running";
    }
    return "failed";
  }
  emit({ loaded: true, countdown: data as Countdown, error: null });
  return "started";
}
