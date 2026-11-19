"use client";

/**
 * Goals with their milestones and sub-goals. With Supabase configured they're
 * the signed-in user's rows; in demo mode they come from the mock store.
 *
 * Forms wait for the database and only then update the page, so a failed
 * save keeps what the user typed. Ticking a sub-goal shows at once and is
 * undone if saving fails. Progress and status follow the sub-goals on both
 * sides: a trigger in the database, withSubgoals on the page.
 */
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { withSubgoals } from "../goal-progress";
import { supabaseBrowser } from "../supabase/client";
import { supabaseConfigured } from "../supabase/config";
import type { Goal, GoalMilestone, GoalSubgoal } from "../types";
import {
  addGoal as addMockGoal,
  addSubgoal as addMockSubgoal,
  newSubgoal,
  removeSubgoal as removeMockSubgoal,
  setSubgoalDone as setMockSubgoalDone,
  usePortalData,
} from "./store";

export interface GoalsState {
  /** null until the first load finishes (show a skeleton). */
  goals: Goal[] | null;
  error: string | null;
}

/** What the new-goal form sends: milestones in quarter order, sub-goal titles in order. */
export interface NewGoal {
  year: number;
  area: string;
  title: string;
  next_step: string;
  milestones: string[];
  subgoals: string[];
}

const SUBGOAL_COLUMNS = "id, title, done, done_at, sort_order, created_at";
const GOAL_COLUMNS = `id, year, area, title, progress_pct, status, next_step, goal_milestones(quarter, label, state), goal_subgoals(${SUBGOAL_COLUMNS})`;

interface SubgoalRow extends GoalSubgoal {
  sort_order: number;
  created_at: string;
}

interface GoalRow extends Omit<Goal, "milestones" | "subgoals"> {
  goal_milestones: GoalMilestone[];
  goal_subgoals: SubgoalRow[];
}

const toSubgoal = ({ id, title, done, done_at }: SubgoalRow): GoalSubgoal => ({ id, title, done, done_at });

function toGoal({ goal_milestones, goal_subgoals, ...goal }: GoalRow): Goal {
  return {
    ...goal,
    milestones: [...goal_milestones].sort((a, b) => a.quarter - b.quarter),
    subgoals: [...goal_subgoals]
      .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))
      .map(toSubgoal),
  };
}

// ---------- Supabase ----------

let state: GoalsState = { goals: null, error: null };
let loading = false;
const listeners = new Set<() => void>();
const SERVER_STATE: GoalsState = { goals: null, error: null };

function emit(next: GoalsState) {
  state = next;
  for (const listener of listeners) listener();
}

/** Changes one goal's sub-goals; its progress and status follow (lib/goal-progress.ts). */
function patchSubgoals(goalId: string, recipe: (subgoals: GoalSubgoal[]) => GoalSubgoal[]) {
  if (!state.goals) return;
  const goals = state.goals.map((g) => (g.id === goalId ? withSubgoals(g, recipe(g.subgoals)) : g));
  emit({ ...state, goals });
}

async function load() {
  if (loading) return;
  loading = true;
  try {
    // RLS scopes it to the signed-in user. A handful of goals a year, so one page is plenty.
    const { data, error } = await supabaseBrowser()
      .from("goals")
      .select(GOAL_COLUMNS)
      .order("year")
      .order("sort_order")
      .order("created_at");
    if (error) {
      emit({ goals: state.goals, error: "Couldn’t load your goals. Refresh to try again." });
      return;
    }
    // The columns' check constraints guarantee the narrower types.
    emit({ goals: (data as unknown as GoalRow[]).map(toGoal), error: null });
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

function useSupabaseGoals(): GoalsState {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
  // Show what's cached right away and refresh it on every visit.
  useEffect(() => {
    void load();
  }, []);
  return snapshot;
}

// ---------- demo mode ----------

function useMockGoals(): GoalsState {
  const data = usePortalData();
  return useMemo(() => ({ goals: data ? data.goals : null, error: null }), [data]);
}

// ---------- public API ----------

/** `supabaseConfigured` is fixed at build time, so each build always calls the same hook. */
export const useGoals: () => GoalsState = supabaseConfigured ? useSupabaseGoals : useMockGoals;

/** Creates a goal with its milestones and sub-goals in one go (create_goal); false if saving failed. */
export async function addGoal(goal: NewGoal): Promise<boolean> {
  if (!supabaseConfigured) {
    addMockGoal({
      year: goal.year,
      area: goal.area,
      title: goal.title,
      progress_pct: 0,
      status: "on_track",
      next_step: goal.next_step,
      milestones: goal.milestones.map((label, i) => ({ quarter: (i + 1) as GoalMilestone["quarter"], label, state: "todo" })),
      subgoals: goal.subgoals.map(newSubgoal),
    });
    return true;
  }
  const supabase = supabaseBrowser();
  const { data: id, error } = await supabase.rpc("create_goal", {
    p_year: goal.year,
    p_area: goal.area,
    p_title: goal.title,
    p_next_step: goal.next_step,
    p_milestones: goal.milestones,
    p_subgoals: goal.subgoals,
  });
  if (error) return false;
  // Saved: read it back as stored. If that read fails, the next visit loads it.
  const { data } = await supabase.from("goals").select(GOAL_COLUMNS).eq("id", id).single();
  if (data && state.goals) emit({ ...state, goals: [...state.goals, toGoal(data as unknown as GoalRow)] });
  return true;
}

/** Adds a sub-goal after the goal's others; false if saving failed. */
export async function addSubgoal(goal: Goal, title: string): Promise<boolean> {
  if (!supabaseConfigured) {
    addMockSubgoal(goal.id, title);
    return true;
  }
  const { data, error } = await supabaseBrowser()
    .from("goal_subgoals")
    .insert({ goal_id: goal.id, title, sort_order: goal.subgoals.length })
    .select(SUBGOAL_COLUMNS)
    .single();
  if (error) return false;
  patchSubgoals(goal.id, (list) => [...list, toSubgoal(data)]);
  return true;
}

/** Ticks or unticks a sub-goal. Shows at once; returns false (and undoes it) if saving failed. */
export async function setSubgoalDone(goalId: string, subgoalId: string, done: boolean): Promise<boolean> {
  if (!supabaseConfigured) {
    setMockSubgoalDone(goalId, subgoalId, done);
    return true;
  }
  const before = state.goals?.find((g) => g.id === goalId)?.subgoals.find((s) => s.id === subgoalId);
  const set = (value: boolean, done_at: string | null) =>
    patchSubgoals(goalId, (list) => list.map((s) => (s.id === subgoalId ? { ...s, done: value, done_at } : s)));
  set(done, done ? new Date().toISOString() : null);
  const { data, error } = await supabaseBrowser()
    .from("goal_subgoals")
    .update({ done })
    .eq("id", subgoalId)
    .select(SUBGOAL_COLUMNS)
    .single();
  if (error) {
    if (before) set(before.done, before.done_at);
    return false;
  }
  // The database stamps done_at; keep its time.
  set(data.done, data.done_at);
  return true;
}

/** Removes a sub-goal; false if removing failed. */
export async function removeSubgoal(goalId: string, subgoalId: string): Promise<boolean> {
  if (!supabaseConfigured) {
    removeMockSubgoal(goalId, subgoalId);
    return true;
  }
  const { error } = await supabaseBrowser().from("goal_subgoals").delete().eq("id", subgoalId);
  if (error) return false;
  patchSubgoals(goalId, (list) => list.filter((s) => s.id !== subgoalId));
  return true;
}
