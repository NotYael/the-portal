"use client";

/**
 * Journal entries. With Supabase configured they're the signed-in user's
 * rows; in demo mode they come from the mock store.
 *
 * Saving waits for the database and only then updates the page, so a failed
 * save keeps what the user wrote.
 */
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { supabaseBrowser } from "../supabase/client";
import { supabaseConfigured } from "../supabase/config";
import type { JournalEntry } from "../types";
import { JOURNAL_COLUMNS } from "./columns";
import { fetchAllPages } from "./fetch-all";
import { addJournalEntry as addMockEntry, usePortalData } from "./store";

export interface JournalState {
  /** null until the first load finishes (show a skeleton). */
  entries: JournalEntry[] | null;
  error: string | null;
}

export type NewJournalEntry = Omit<JournalEntry, "id" | "created_at">;

const COLUMNS = JOURNAL_COLUMNS;

// ---------- Supabase ----------

let state: JournalState = { entries: null, error: null };
let loading = false;
const listeners = new Set<() => void>();
const SERVER_STATE: JournalState = { entries: null, error: null };

function emit(next: JournalState) {
  state = next;
  for (const listener of listeners) listener();
}

async function load() {
  if (loading) return;
  loading = true;
  try {
    const supabase = supabaseBrowser();
    // RLS scopes it to the signed-in user. The streak can reach back years, so load every page.
    const rows = await fetchAllPages((from, to) =>
      supabase.from("journal_entries").select(COLUMNS).order("entry_date").order("id").range(from, to),
    );
    if (!rows) {
      emit({ entries: state.entries, error: "Couldn’t load your journal. Refresh to try again." });
      return;
    }
    // The columns' check constraints guarantee the narrower types.
    emit({ entries: rows as JournalEntry[], error: null });
  } finally {
    loading = false;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function useSupabaseJournal(): JournalState {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
  // Show what's cached right away and refresh it on every visit.
  useEffect(() => {
    void load();
  }, []);
  return snapshot;
}

// ---------- demo mode ----------

function useMockJournal(): JournalState {
  const data = usePortalData();
  return useMemo(() => ({ entries: data ? data.journal : null, error: null }), [data]);
}

// ---------- public API ----------

/** `supabaseConfigured` is fixed at build time, so each build always calls the same hook. */
export const useJournal: () => JournalState = supabaseConfigured ? useSupabaseJournal : useMockJournal;

/** Saves an entry; false if saving failed. */
export async function addJournalEntry(entry: NewJournalEntry): Promise<boolean> {
  if (!supabaseConfigured) {
    addMockEntry(entry);
    return true;
  }
  const { data, error } = await supabaseBrowser().from("journal_entries").insert(entry).select(COLUMNS).single();
  if (error) return false;
  if (state.entries) emit({ ...state, entries: [...state.entries, data as JournalEntry] });
  return true;
}
