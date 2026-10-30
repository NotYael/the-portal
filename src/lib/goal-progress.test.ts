import { describe, expect, it } from "vitest";
import { checklistOrder, nextSubgoal, subgoalProgress, withSubgoals } from "./goal-progress";
import type { Goal, GoalSubgoal } from "./types";

const sub = (done: boolean, n = 0): GoalSubgoal => ({ id: `s${n}`, title: `Step ${n}`, done, done_at: done ? "2026-10-27T00:00:00Z" : null });

const goal: Goal = {
  id: "g",
  year: 2026,
  area: "Career",
  title: "Land a role",
  progress_pct: 10,
  status: "behind",
  next_step: "",
  milestones: [],
  subgoals: [],
};

describe("subgoalProgress", () => {
  it("is done ÷ total, rounded like the database", () => {
    expect(subgoalProgress([sub(true, 1), sub(false, 2), sub(false, 3)])).toEqual({ done: 1, total: 3, pct: 33 });
    expect(subgoalProgress([sub(true, 1), sub(true, 2), sub(false, 3)]).pct).toBe(67);
    expect(subgoalProgress([]).pct).toBeNull();
  });
});

describe("checklistOrder", () => {
  it("puts open sub-goals first and ticked ones last, keeping each group's order", () => {
    const list = [sub(true, 1), sub(false, 2), sub(true, 3), sub(false, 4)];
    expect(checklistOrder(list).map((s) => s.id)).toEqual(["s2", "s4", "s1", "s3"]);
  });
});

describe("nextSubgoal", () => {
  it("is the first open sub-goal, or null when all are ticked", () => {
    expect(nextSubgoal([sub(true, 1), sub(false, 2), sub(false, 3)])?.id).toBe("s2");
    expect(nextSubgoal([sub(true, 1)])).toBeNull();
    expect(nextSubgoal([])).toBeNull();
  });
});

describe("withSubgoals", () => {
  it("takes progress from the sub-goals and keeps the status", () => {
    expect(withSubgoals(goal, [sub(true, 1), sub(false, 2)])).toMatchObject({ progress_pct: 50, status: "behind" });
  });

  it("marks the goal done when every sub-goal is ticked, and back on track when one is unticked", () => {
    const done = withSubgoals(goal, [sub(true, 1), sub(true, 2)]);
    expect(done).toMatchObject({ progress_pct: 100, status: "done" });
    expect(withSubgoals(done, [sub(true, 1), sub(false, 2)])).toMatchObject({ progress_pct: 50, status: "on_track" });
  });

  it("leaves a goal without sub-goals as it was", () => {
    expect(withSubgoals(goal, [])).toMatchObject({ progress_pct: 10, status: "behind", subgoals: [] });
  });
});
