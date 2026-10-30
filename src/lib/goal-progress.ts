import type { Goal, GoalSubgoal } from "./types";

/**
 * Sub-goals drive a goal's progress: done ÷ total, rounded. The database
 * keeps goals.progress_pct and status in step with a trigger
 * (supabase/migrations/…_goal_subgoals.sql); this is the same rule for the
 * page, so both agree.
 */
export function subgoalProgress(subgoals: readonly GoalSubgoal[]): { done: number; total: number; pct: number | null } {
  const total = subgoals.length;
  const done = subgoals.filter((s) => s.done).length;
  return { done, total, pct: total > 0 ? Math.round((100 * done) / total) : null };
}

/** Checklist order: open sub-goals first, then ticked ones, each in their own order (like Google Keep). */
export function checklistOrder(subgoals: readonly GoalSubgoal[]): GoalSubgoal[] {
  return [...subgoals.filter((s) => !s.done), ...subgoals.filter((s) => s.done)];
}

/** The first open sub-goal in checklist order, or null when there's none left. */
export function nextSubgoal(subgoals: readonly GoalSubgoal[]): GoalSubgoal | null {
  return subgoals.find((s) => !s.done) ?? null;
}

/**
 * The goal with these sub-goals. With at least one, progress follows them and
 * the goal is "done" once every one is ticked (unticking one moves a done
 * goal back to "on_track"). With none, progress and status stay as they were.
 */
export function withSubgoals(goal: Goal, subgoals: GoalSubgoal[]): Goal {
  const { done, total, pct } = subgoalProgress(subgoals);
  if (pct === null) return { ...goal, subgoals };
  const status = done === total ? "done" : goal.status === "done" ? "on_track" : goal.status;
  return { ...goal, subgoals, progress_pct: pct, status };
}
