"use client";

/**
 * Frontend-only data store. Holds the same rows the Supabase tables will,
 * persists them in localStorage, and seeds demo data on first visit.
 *
 * When the backend lands, replace the mutations below with Supabase calls and
 * keep the hooks' return shapes, so pages don't change.
 */
import { useSyncExternalStore } from "react";
import { firstDayOfMonth, monthKeyOf, todayInManila } from "../dates";
import { withSubgoals } from "../goal-progress";
import type {
  CategorySlug,
  Expense,
  ExpenseSettings,
  Goal,
  GoalSubgoal,
  JobStatus,
  JournalEntry,
  NewExpense,
} from "../types";
import type { PortalState } from "./portal-state";
import { seedAgentRuns, seedJobs, seedPortal, seedSubgoals } from "./seed";

const STORAGE_KEY = "the-portal.mock-db.v1";

let state: PortalState | null = null;
const listeners = new Set<() => void>();

/** What older versions of the app may have saved. */
type StoredState = Omit<PortalState, "version" | "goals"> & {
  version: 1 | 2 | 3;
  goals: (Omit<Goal, "subgoals"> & { subgoals?: GoalSubgoal[] })[];
};

/** Brings saved data up to the current version and keeps the user's changes. */
function upgrade(stored: StoredState, today: string): PortalState {
  let state = stored;
  // v1 jobs had the mockup's fields: swap in demo jobs with the database's.
  if (state.version === 1) state = { ...state, version: 2, jobs: seedJobs(today), agentRuns: seedAgentRuns(today) };
  // v3 adds sub-goals: demo goals get demo sub-goals, your own goals start with none.
  if (state.version === 2) {
    state = { ...state, version: 3, goals: state.goals.map((g) => withSubgoals({ ...g, subgoals: [] }, seedSubgoals(g.id, today))) };
  }
  return state as PortalState;
}

function load(): PortalState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredState;
      if (parsed?.version === 3) return parsed as PortalState;
      if (parsed?.version === 1 || parsed?.version === 2) {
        const upgraded = upgrade(parsed, todayInManila());
        save(upgraded);
        return upgraded;
      }
    }
  } catch {
    // Corrupt or blocked storage: fall through to fresh demo data.
  }
  const seeded = seedPortal(todayInManila());
  save(seeded);
  return seeded;
}

function save(next: PortalState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode or quota: keep working in memory.
  }
}

function getSnapshot(): PortalState {
  state ??= load();
  return state;
}

function getServerSnapshot(): null {
  return null;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      state = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function update(recipe: (current: PortalState) => PortalState) {
  state = recipe(getSnapshot());
  save(state);
  for (const listener of listeners) listener();
}

/** The whole store, or null while rendering on the server / hydrating (show a skeleton). */
export function usePortalData(): PortalState | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

const noSubscribe = () => () => {};

/** Today's date in Manila, or null on the server. */
export function useToday(): string | null {
  return useSyncExternalStore(noSubscribe, () => todayInManila(), () => null);
}

const MINUTE = 60_000;

function subscribeMinute(listener: () => void) {
  const timer = window.setInterval(listener, MINUTE);
  return () => window.clearInterval(timer);
}

/** The current time in ms, rounded down to the minute and ticking every minute; null on the server. */
export function useNow(): number | null {
  return useSyncExternalStore(subscribeMinute, () => Math.floor(Date.now() / MINUTE) * MINUTE, () => null);
}

const now = () => new Date().toISOString();

// ---------- expenses ----------

export function addExpenses(rows: NewExpense[]): Expense[] {
  const stamp = now();
  const created = rows.map((row) => ({ ...row, id: crypto.randomUUID(), created_at: stamp, updated_at: stamp }));
  update((s) => ({ ...s, expenses: [...s.expenses, ...created] }));
  return created;
}

export function updateExpense(id: string, patch: Partial<NewExpense>) {
  update((s) => ({
    ...s,
    expenses: s.expenses.map((e) => (e.id === id ? { ...e, ...patch, updated_at: now() } : e)),
  }));
}

export function deleteExpense(id: string) {
  update((s) => ({ ...s, expenses: s.expenses.filter((e) => e.id !== id) }));
}

type SettingsSlice = Pick<PortalState, "settings" | "categories" | "budgetHistory">;

/**
 * What saving the settings form does: new settings, each category's current
 * budget, and the budget_history row for the current month — so past months
 * keep the budget they had. Shared with the Supabase book (expense-book.ts).
 */
export function withSavedSettings<T extends SettingsSlice>(
  current: T,
  settings: ExpenseSettings,
  categoryBudgets: Partial<Record<CategorySlug, number>>,
  today: string,
): T {
  const effective_month = firstDayOfMonth(monthKeyOf(today));
  const row = { effective_month, monthly_budget: settings.monthly_budget, category_budgets: categoryBudgets };
  const others = current.budgetHistory.filter((h) => h.effective_month !== effective_month);
  return {
    ...current,
    settings,
    categories: current.categories.map((c) => ({ ...c, monthly_budget: categoryBudgets[c.slug] ?? null })),
    budgetHistory: [...others, row].sort((a, b) => a.effective_month.localeCompare(b.effective_month)),
  };
}

/** Saves the settings form in one go (see withSavedSettings). */
export function saveExpenseSettings(
  settings: ExpenseSettings,
  categoryBudgets: Partial<Record<CategorySlug, number>>,
) {
  update((s) => withSavedSettings(s, settings, categoryBudgets, todayInManila()));
}

// ---------- goals, jobs, journal ----------

export function addGoal(goal: Omit<Goal, "id">) {
  const created = withSubgoals({ ...goal, id: crypto.randomUUID(), subgoals: [] }, goal.subgoals);
  update((s) => ({ ...s, goals: [...s.goals, created] }));
}

/** Changes a goal's sub-goals; its progress and status follow (lib/goal-progress.ts). */
function updateSubgoals(goalId: string, recipe: (subgoals: GoalSubgoal[]) => GoalSubgoal[]) {
  update((s) => ({ ...s, goals: s.goals.map((g) => (g.id === goalId ? withSubgoals(g, recipe(g.subgoals)) : g)) }));
}

export function newSubgoal(title: string): GoalSubgoal {
  return { id: crypto.randomUUID(), title, done: false, done_at: null };
}

export function addSubgoal(goalId: string, title: string) {
  updateSubgoals(goalId, (list) => [...list, newSubgoal(title)]);
}

export function setSubgoalDone(goalId: string, subgoalId: string, done: boolean) {
  updateSubgoals(goalId, (list) => list.map((x) => (x.id === subgoalId ? { ...x, done, done_at: done ? now() : null } : x)));
}

export function removeSubgoal(goalId: string, subgoalId: string) {
  updateSubgoals(goalId, (list) => list.filter((x) => x.id !== subgoalId));
}

export function setJobStatus(id: string, status: JobStatus) {
  update((s) => ({ ...s, jobs: s.jobs.map((j) => (j.id === id ? { ...j, status } : j)) }));
}

export function addJournalEntry(entry: Omit<JournalEntry, "id" | "created_at">) {
  update((s) => ({
    ...s,
    journal: [...s.journal, { ...entry, id: crypto.randomUUID(), created_at: now() }],
  }));
}

export function setProfile(profile: PortalState["profile"]) {
  update((s) => ({ ...s, profile }));
}

/** Wipes local changes and reseeds the demo data. */
export function resetDemoData() {
  update(() => seedPortal(todayInManila()));
}
