"use client";

/**
 * Reminders. With Supabase configured they're the signed-in user's rows; in
 * demo mode they live in their own localStorage key, seeded with examples.
 *
 * Saves wait for the database and only then update the page, so a failed
 * save leaves the form open with what the user typed.
 */
import { useEffect, useSyncExternalStore } from "react";
import { addDays, todayInManila } from "../dates";
import { completionPatch } from "../reminders";
import { supabaseBrowser } from "../supabase/client";
import { supabaseConfigured } from "../supabase/config";
import type { ISODate, NewReminder, Reminder } from "../types";

export interface RemindersState {
  /** null until the first load finishes (show a skeleton). */
  reminders: Reminder[] | null;
  error: string | null;
}

export type ReminderPatch = Partial<NewReminder & Pick<Reminder, "done_at">>;

const COLUMNS = "id, title, notes, due_on, repeat_every, repeat_unit, done_at, created_at, updated_at";
const SERVER_STATE: RemindersState = { reminders: null, error: null };

let state: RemindersState = SERVER_STATE;
const listeners = new Set<() => void>();

function emit(next: RemindersState) {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function patchList(recipe: (list: Reminder[]) => Reminder[]) {
  if (state.reminders) emit({ ...state, reminders: recipe(state.reminders) });
}

// ---------- Supabase ----------

let loading = false;

async function load() {
  if (loading) return;
  loading = true;
  try {
    // RLS scopes it to the signed-in user.
    const { data, error } = await supabaseBrowser().from("reminders").select(COLUMNS).order("due_on");
    if (error) {
      emit({ reminders: state.reminders, error: "Couldn’t load your reminders. Refresh to try again." });
      return;
    }
    // The columns' check constraints guarantee the narrower types.
    emit({ reminders: data as Reminder[], error: null });
  } finally {
    loading = false;
  }
}

function useSupabaseReminders(): RemindersState {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
  // Show what's cached right away and refresh it on every visit.
  useEffect(() => {
    void load();
  }, []);
  return snapshot;
}

// ---------- demo mode ----------

const STORAGE_KEY = "the-portal.mock-reminders.v1";

function seedReminders(today: ISODate): Reminder[] {
  const stamp = new Date().toISOString();
  const row = (title: string, notes: string, days: number, repeat: Pick<Reminder, "repeat_every" | "repeat_unit">): Reminder => ({
    id: crypto.randomUUID(),
    title,
    notes,
    due_on: addDays(today, days),
    ...repeat,
    done_at: null,
    created_at: stamp,
    updated_at: stamp,
  });
  return [
    row("Push a commit to the-portal", "GitHub turns off the keep-alive workflow after 60 days without a commit.", 50, {
      repeat_every: 50,
      repeat_unit: "day",
    }),
    row("Renew the domain", "", 38, { repeat_every: null, repeat_unit: null }),
    row("Book a dental cleaning", "", -2, { repeat_every: 6, repeat_unit: "month" }),
  ];
}

function loadMock(): Reminder[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Reminder[];
  } catch {
    // Corrupt or blocked storage: fall through to fresh demo data.
  }
  const seeded = seedReminders(todayInManila());
  saveMock(seeded);
  return seeded;
}

function saveMock(list: Reminder[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Private mode or quota: keep working in memory.
  }
}

function useMockReminders(): RemindersState {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
  useEffect(() => {
    if (!state.reminders) emit({ reminders: loadMock(), error: null });
  }, []);
  return snapshot;
}

function updateMock(recipe: (list: Reminder[]) => Reminder[]) {
  patchList(recipe);
  if (state.reminders) saveMock(state.reminders);
}

// ---------- public API ----------

/** `supabaseConfigured` is fixed at build time, so each build always calls the same hook. */
export const useReminders: () => RemindersState = supabaseConfigured ? useSupabaseReminders : useMockReminders;

/** Returns false if saving failed (the page is left unchanged). */
export async function addReminder(value: NewReminder): Promise<boolean> {
  if (!supabaseConfigured) {
    const stamp = new Date().toISOString();
    updateMock((list) => [...list, { ...value, id: crypto.randomUUID(), done_at: null, created_at: stamp, updated_at: stamp }]);
    return true;
  }
  const { data, error } = await supabaseBrowser().from("reminders").insert(value).select(COLUMNS).single();
  if (error) return false;
  patchList((list) => [...list, data as Reminder]);
  return true;
}

export async function updateReminder(id: string, patch: ReminderPatch): Promise<boolean> {
  if (!supabaseConfigured) {
    const stamp = new Date().toISOString();
    updateMock((list) => list.map((r) => (r.id === id ? { ...r, ...patch, updated_at: stamp } : r)));
    return true;
  }
  const { data, error } = await supabaseBrowser().from("reminders").update(patch).eq("id", id).select(COLUMNS).single();
  if (error) return false;
  patchList((list) => list.map((r) => (r.id === id ? (data as Reminder) : r)));
  return true;
}

/** Marks it done: a repeating reminder moves to its next due date, a one-off is finished (lib/reminders.ts). */
export function completeReminder(reminder: Reminder): Promise<boolean> {
  return updateReminder(reminder.id, completionPatch(reminder, todayInManila(), new Date().toISOString()));
}

/** Puts a reminder back the way it was before completeReminder (the toast's Undo). */
export function undoComplete(reminder: Reminder): Promise<boolean> {
  return updateReminder(reminder.id, { due_on: reminder.due_on, done_at: reminder.done_at });
}

export async function deleteReminder(id: string): Promise<boolean> {
  if (!supabaseConfigured) {
    updateMock((list) => list.filter((r) => r.id !== id));
    return true;
  }
  const { error } = await supabaseBrowser().from("reminders").delete().eq("id", id);
  if (error) return false;
  patchList((list) => list.filter((r) => r.id !== id));
  return true;
}
