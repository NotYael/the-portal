"use client";

/**
 * Expenses, categories, settings and budget history. With Supabase configured
 * they're the signed-in user's rows; in demo mode they come from the mock store.
 *
 * Saves wait for the database and only then update the page, so a failed
 * save leaves the form open with what the user typed.
 */
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { todayInManila } from "../dates";
import { supabaseBrowser } from "../supabase/client";
import { supabaseConfigured } from "../supabase/config";
import type { BudgetHistoryRow, Category, CategorySlug, Expense, ExpenseSettings, NewExpense } from "../types";
import {
  addExpenses as addMockExpenses,
  deleteExpense as deleteMockExpense,
  saveExpenseSettings as saveMockSettings,
  updateExpense as updateMockExpense,
  usePortalData,
  withSavedSettings,
} from "./store";

export interface ExpenseBook {
  expenses: Expense[];
  categories: Category[];
  settings: ExpenseSettings;
  budgetHistory: BudgetHistoryRow[];
}

export interface ExpenseBookState {
  /** null until the first load finishes (show a skeleton). */
  book: ExpenseBook | null;
  error: string | null;
}

const EXPENSE_COLUMNS = "id, category_id, amount, spent_on, description, payment_method, source, created_at, updated_at";
const CATEGORY_COLUMNS = "id, slug, label, color, is_fixed, monthly_budget, sort_order, archived";
const SETTINGS_COLUMNS =
  "monthly_budget, default_payment_method, alert_threshold_pct, cycle_start_day, ai_insights_enabled, include_in_digest, rollover_enabled";
const HISTORY_COLUMNS = "effective_month, monthly_budget, category_budgets";

/** The Data API returns at most 1,000 rows per request, so expenses load in pages. */
const PAGE_SIZE = 1000;

// ---------- Supabase ----------

let state: ExpenseBookState = { book: null, error: null };
let loading = false;
const listeners = new Set<() => void>();
const SERVER_STATE: ExpenseBookState = { book: null, error: null };

function emit(next: ExpenseBookState) {
  state = next;
  for (const listener of listeners) listener();
}

function patchBook(recipe: (book: ExpenseBook) => ExpenseBook) {
  if (state.book) emit({ ...state, book: recipe(state.book) });
}

async function loadExpenses(): Promise<Expense[] | null> {
  const supabase = supabaseBrowser();
  const rows: Expense[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    // Ordered on a unique key too, so pages never skip or repeat a row.
    const { data, error } = await supabase
      .from("expenses")
      .select(EXPENSE_COLUMNS)
      .order("spent_on")
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) return null;
    // The columns' check constraints guarantee the narrower types.
    rows.push(...(data as Expense[]));
    if (data.length < PAGE_SIZE) return rows;
  }
}

async function load() {
  if (loading) return;
  loading = true;
  try {
    const supabase = supabaseBrowser();
    // RLS scopes every query to the signed-in user.
    const [expenses, categories, settings, history] = await Promise.all([
      loadExpenses(),
      supabase.from("categories").select(CATEGORY_COLUMNS).order("sort_order"),
      supabase.from("expense_settings").select(SETTINGS_COLUMNS).maybeSingle(),
      supabase.from("budget_history").select(HISTORY_COLUMNS).order("effective_month"),
    ]);
    if (!expenses || categories.error || settings.error || !settings.data || history.error) {
      emit({ book: state.book, error: "Couldn’t load your expenses. Refresh to try again." });
      return;
    }
    emit({
      book: {
        expenses,
        categories: categories.data as Category[],
        settings: settings.data as ExpenseSettings,
        budgetHistory: history.data as BudgetHistoryRow[],
      },
      error: null,
    });
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

function useSupabaseExpenseBook(): ExpenseBookState {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
  // Show what's cached right away and refresh it on every visit.
  useEffect(() => {
    void load();
  }, []);
  return snapshot;
}

// ---------- demo mode ----------

function useMockExpenseBook(): ExpenseBookState {
  const data = usePortalData();
  return useMemo(
    () => ({
      book: data
        ? { expenses: data.expenses, categories: data.categories, settings: data.settings, budgetHistory: data.budgetHistory }
        : null,
      error: null,
    }),
    [data],
  );
}

// ---------- public API ----------

/** `supabaseConfigured` is fixed at build time, so each build always calls the same hook. */
export const useExpenseBook: () => ExpenseBookState = supabaseConfigured ? useSupabaseExpenseBook : useMockExpenseBook;

/** Saves new expenses; false if saving failed. */
export async function addExpenses(rows: NewExpense[]): Promise<boolean> {
  if (!supabaseConfigured) {
    addMockExpenses(rows);
    return true;
  }
  const { data, error } = await supabaseBrowser().from("expenses").insert(rows).select(EXPENSE_COLUMNS);
  if (error) return false;
  patchBook((b) => ({ ...b, expenses: [...b.expenses, ...(data as Expense[])] }));
  return true;
}

/** Saves changes to one expense; false if saving failed. */
export async function updateExpense(id: string, patch: Partial<NewExpense>): Promise<boolean> {
  if (!supabaseConfigured) {
    updateMockExpense(id, patch);
    return true;
  }
  const { data, error } = await supabaseBrowser().from("expenses").update(patch).eq("id", id).select(EXPENSE_COLUMNS).single();
  if (error) return false;
  patchBook((b) => ({ ...b, expenses: b.expenses.map((e) => (e.id === id ? (data as Expense) : e)) }));
  return true;
}

/** Deletes one expense; false if deleting failed. */
export async function deleteExpense(id: string): Promise<boolean> {
  if (!supabaseConfigured) {
    deleteMockExpense(id);
    return true;
  }
  const { error } = await supabaseBrowser().from("expenses").delete().eq("id", id);
  if (error) return false;
  patchBook((b) => ({ ...b, expenses: b.expenses.filter((e) => e.id !== id) }));
  return true;
}

/**
 * Saves the settings form: settings, each category's current budget and this
 * month's budget_history row, in one transaction (save_expense_settings).
 * False if saving failed.
 */
export async function saveExpenseSettings(
  settings: ExpenseSettings,
  categoryBudgets: Partial<Record<CategorySlug, number>>,
): Promise<boolean> {
  if (!supabaseConfigured) {
    saveMockSettings(settings, categoryBudgets);
    return true;
  }
  const { error } = await supabaseBrowser().rpc("save_expense_settings", {
    p_monthly_budget: settings.monthly_budget,
    p_default_payment_method: settings.default_payment_method,
    p_alert_threshold_pct: settings.alert_threshold_pct,
    p_cycle_start_day: settings.cycle_start_day,
    p_ai_insights_enabled: settings.ai_insights_enabled,
    p_include_in_digest: settings.include_in_digest,
    p_rollover_enabled: settings.rollover_enabled,
    p_category_budgets: categoryBudgets,
  });
  if (error) return false;
  patchBook((b) => withSavedSettings(b, settings, categoryBudgets, todayInManila()));
  return true;
}
