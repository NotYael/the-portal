/**
 * What each module selects from Supabase, shared by the browser hooks
 * (src/lib/data/*) and the server (the weekly digest cron), so both read the
 * same row shapes. No "use client": the server imports it too.
 */
import type { Goal, GoalMilestone, GoalSubgoal } from "../types";

export const EXPENSE_COLUMNS = "id, category_id, amount, spent_on, description, payment_method, source, created_at, updated_at";
export const CATEGORY_COLUMNS = "id, slug, label, color, is_fixed, monthly_budget, sort_order, archived";
export const SETTINGS_COLUMNS =
  "monthly_budget, default_payment_method, alert_threshold_pct, cycle_start_day, ai_insights_enabled, include_in_digest, rollover_enabled";
export const HISTORY_COLUMNS = "effective_month, monthly_budget, category_budgets";

export const JOB_COLUMNS =
  "id, source, title, company, location, hq, url, salary, job_type, work_mode, match_pct, reason, posted_at, found_at, status";
export const RUN_COLUMNS = "id, ran_at, triggered_by, status, fetched, candidates, matched, error";

export const JOURNAL_COLUMNS = "id, entry_date, prompt, body, tag, goal_id, created_at";
export const REMINDER_COLUMNS = "id, title, notes, due_on, repeat_every, repeat_unit, done_at, created_at, updated_at";

export const SUBGOAL_COLUMNS = "id, title, done, done_at, sort_order, created_at";
export const GOAL_COLUMNS = `id, year, area, title, progress_pct, status, next_step, goal_milestones(quarter, label, state), goal_subgoals(${SUBGOAL_COLUMNS})`;

export interface SubgoalRow extends GoalSubgoal {
  sort_order: number;
  created_at: string;
}

/** A goals row as GOAL_COLUMNS returns it, with its milestones and sub-goals embedded. */
export interface GoalRow extends Omit<Goal, "milestones" | "subgoals"> {
  goal_milestones: GoalMilestone[];
  goal_subgoals: SubgoalRow[];
}

export const toSubgoal = ({ id, title, done, done_at }: SubgoalRow): GoalSubgoal => ({ id, title, done, done_at });

export function toGoal({ goal_milestones, goal_subgoals, ...goal }: GoalRow): Goal {
  return {
    ...goal,
    milestones: [...goal_milestones].sort((a, b) => a.quarter - b.quarter),
    subgoals: [...goal_subgoals]
      .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))
      .map(toSubgoal),
  };
}
