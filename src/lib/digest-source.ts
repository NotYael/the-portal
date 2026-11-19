/**
 * Reads what the weekly digest needs straight from the database, for the
 * cron (no signed-in user). The client bypasses row-level security, so every
 * query filters by user_id. Row shapes match the browser hooks (data/columns.ts).
 */
import {
  CATEGORY_COLUMNS,
  EXPENSE_COLUMNS,
  GOAL_COLUMNS,
  HISTORY_COLUMNS,
  JOB_COLUMNS,
  JOURNAL_COLUMNS,
  REMINDER_COLUMNS,
  SETTINGS_COLUMNS,
  toGoal,
  type GoalRow,
} from "./data/columns";
import { fetchAllPages } from "./data/fetch-all";
import { addDays, startOfWeek } from "./dates";
import type { DigestSource } from "./digest-cron";
import type { SupabaseAdmin } from "./supabase/admin";
import type { BudgetHistoryRow, Category, Expense, ExpenseSettings, ISODate, JobMatch, JournalEntry, Reminder } from "./types";

export async function loadDigestSource(supabase: SupabaseAdmin, userId: string, today: ISODate): Promise<DigestSource | null> {
  // Every expense, not just this month's: rollover budgets look back at earlier months.
  const [expenses, categories, settings, history, goals, journal, jobs, reminders, profile] = await Promise.all([
    fetchAllPages((from, to) =>
      supabase.from("expenses").select(EXPENSE_COLUMNS).eq("user_id", userId).order("spent_on").order("id").range(from, to),
    ),
    supabase.from("categories").select(CATEGORY_COLUMNS).eq("user_id", userId).order("sort_order"),
    supabase.from("expense_settings").select(SETTINGS_COLUMNS).eq("user_id", userId).maybeSingle(),
    supabase.from("budget_history").select(HISTORY_COLUMNS).eq("user_id", userId).order("effective_month"),
    supabase.from("goals").select(GOAL_COLUMNS).eq("user_id", userId).order("year").order("sort_order").order("created_at"),
    // Only this week's wins and targets go in the digest; a week of margin is plenty.
    supabase
      .from("journal_entries")
      .select(JOURNAL_COLUMNS)
      .eq("user_id", userId)
      .gte("entry_date", addDays(startOfWeek(today), -7))
      .order("entry_date")
      .order("id"),
    supabase.from("job_matches").select(JOB_COLUMNS).eq("user_id", userId).neq("status", "dismissed").order("match_pct", { ascending: false }),
    supabase.from("reminders").select(REMINDER_COLUMNS).eq("user_id", userId).order("due_on"),
    supabase.from("profiles").select("display_name").eq("user_id", userId).maybeSingle(),
  ]);
  const failed = [categories, settings, history, goals, journal, jobs, reminders, profile].some((r) => r.error);
  if (!expenses || failed || !settings.data) return null;

  // The columns' check constraints guarantee the narrower types.
  return {
    state: {
      version: 3,
      seededOn: today,
      profile: { name: profile.data?.display_name ?? "", email: "" },
      expenses: expenses as Expense[],
      categories: categories.data as Category[],
      settings: settings.data as ExpenseSettings,
      budgetHistory: history.data as BudgetHistoryRow[],
      goals: (goals.data as unknown as GoalRow[]).map(toGoal),
      jobs: jobs.data as JobMatch[],
      agentRuns: [],
      journal: journal.data as JournalEntry[],
    },
    reminders: reminders.data as Reminder[],
  };
}
