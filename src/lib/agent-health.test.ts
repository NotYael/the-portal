import { describe, expect, it } from "vitest";
import { agentHealth } from "./agent-health";
import type { AgentRun } from "./types";

const at = (iso: string) => Date.parse(iso);

function run(ran_at: string, patch: Partial<AgentRun> = {}): AgentRun {
  return {
    id: ran_at,
    ran_at,
    triggered_by: "schedule",
    status: "success",
    fetched: 500,
    candidates: 4,
    matched: 1,
    error: null,
    ...patch,
  };
}

// Real scheduled runs land 3.5–6 hours after the 12:37 UTC cron.
const runs = [run("2026-10-26T18:50:25Z"), run("2026-10-25T16:45:22Z"), run("2026-10-24T16:12:11Z")];

describe("agentHealth", () => {
  it("waits until the bot logs its first run", () => {
    expect(agentHealth([], at("2026-10-27T12:00:00Z")).state).toBe("waiting");
  });

  it("is active while scheduled runs keep arriving, even late ones", () => {
    // 30.5 hours since the last run: the next one is late but within GitHub's usual delay.
    const health = agentHealth(runs, at("2026-10-28T01:20:00Z"));
    expect(health).toMatchObject({ state: "active", missed: 0, lastScheduledAt: "2026-10-26T18:50:25Z" });
  });

  it("finds the latest run whatever order the rows come in", () => {
    expect(agentHealth([...runs].reverse(), at("2026-10-27T00:00:00Z")).lastRun?.ran_at).toBe("2026-10-26T18:50:25Z");
  });

  it("flags one missed run, then a stopped schedule", () => {
    expect(agentHealth(runs, at("2026-10-28T05:00:00Z"))).toMatchObject({ state: "late", missed: 1 });
    expect(agentHealth(runs, at("2026-10-29T05:00:00Z"))).toMatchObject({ state: "stopped", missed: 2 });
  });

  it("doesn't let manual runs hide a stopped schedule", () => {
    const withManual = [run("2026-10-29T03:00:00Z", { triggered_by: "manual" }), ...runs];
    const health = agentHealth(withManual, at("2026-10-29T05:00:00Z"));
    expect(health.state).toBe("stopped");
    expect(health.lastRun?.triggered_by).toBe("manual");
  });

  it("measures from the first run until a scheduled one happens", () => {
    const manualOnly = [run("2026-10-27T12:16:37Z", { triggered_by: "manual", matched: 0 })];
    expect(agentHealth(manualOnly, at("2026-10-27T20:00:00Z")).state).toBe("active");
    expect(agentHealth(manualOnly, at("2026-10-29T00:00:00Z")).state).toBe("late");
  });

  it("reports a failed last run", () => {
    const failed = [run("2026-10-27T17:00:00Z", { status: "failed", error: "ValueError: boards down" }), ...runs];
    expect(agentHealth(failed, at("2026-10-27T18:00:00Z")).state).toBe("failing");
  });

  it("warns when a successful run logged a problem", () => {
    const warned = [run("2026-10-27T17:00:00Z", { error: "4 of 4 jobs weren't scored" }), ...runs];
    expect(agentHealth(warned, at("2026-10-27T18:00:00Z")).state).toBe("warning");
  });
});
