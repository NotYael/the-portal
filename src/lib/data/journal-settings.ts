"use client";

/**
 * The journal's one setting: may Gemini tidy this week's Win and Target
 * entries for the weekly digest? Off by default (docs/PORTAL_SPEC.md → Other
 * modules → Privacy). It's profiles.journal_ai_summary_enabled with Supabase;
 * in demo mode it lives in its own localStorage key.
 */
import { useEffect, useSyncExternalStore } from "react";
import { supabaseBrowser } from "../supabase/client";
import { supabaseConfigured } from "../supabase/config";

export interface JournalSettingsState {
  /** null until the first load finishes. */
  aiSummary: boolean | null;
  error: string | null;
}

const SERVER_STATE: JournalSettingsState = { aiSummary: null, error: null };

let state: JournalSettingsState = SERVER_STATE;
/** The profile row to update (Supabase only). */
let userId: string | null = null;
const listeners = new Set<() => void>();

function emit(next: JournalSettingsState) {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// ---------- Supabase ----------

let loading = false;

async function load() {
  if (loading) return;
  loading = true;
  try {
    // RLS scopes it to the signed-in user's profile.
    const { data, error } = await supabaseBrowser().from("profiles").select("user_id, journal_ai_summary_enabled").maybeSingle();
    if (error || !data) {
      emit({ ...state, error: "Couldn’t load your journal settings." });
      return;
    }
    userId = data.user_id;
    emit({ aiSummary: data.journal_ai_summary_enabled, error: null });
  } finally {
    loading = false;
  }
}

function useSupabaseJournalSettings(): JournalSettingsState {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
  useEffect(() => {
    void load();
  }, []);
  return snapshot;
}

// ---------- demo mode ----------

const STORAGE_KEY = "the-portal.mock-journal-ai.v1";

function useMockJournalSettings(): JournalSettingsState {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
  useEffect(() => {
    if (state.aiSummary !== null) return;
    let on = false;
    try {
      on = window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      // Blocked storage: stay off.
    }
    emit({ aiSummary: on, error: null });
  }, []);
  return snapshot;
}

// ---------- public API ----------

/** `supabaseConfigured` is fixed at build time, so each build always calls the same hook. */
export const useJournalSettings: () => JournalSettingsState = supabaseConfigured ? useSupabaseJournalSettings : useMockJournalSettings;

/** Returns false if saving failed (the setting is left as it was). */
export async function setJournalAiSummary(enabled: boolean): Promise<boolean> {
  if (!supabaseConfigured) {
    try {
      if (enabled) window.localStorage.setItem(STORAGE_KEY, "1");
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Private mode: keep it for this visit only.
    }
    emit({ aiSummary: enabled, error: null });
    return true;
  }
  if (!userId) return false;
  const { error } = await supabaseBrowser().from("profiles").update({ journal_ai_summary_enabled: enabled }).eq("user_id", userId);
  if (error) return false;
  emit({ aiSummary: enabled, error: null });
  return true;
}
