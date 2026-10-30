import type { AgentRun } from "./types";

/**
 * Is the job-agent bot alive? It runs on GitHub Actions (cron "37 12 * * *",
 * 8:37 PM Manila) and logs every run, success or failure, to agent_runs.
 * So a missing run means GitHub didn't start it (schedule paused or skipped,
 * or the run was killed before it could log), and a logged run says how it went.
 */
export const AGENT_SCHEDULE_LABEL = "Daily, 8:37 PM";
/** The bot's workflow on GitHub: run it by hand ("Run workflow") or re-enable a paused schedule. */
export const AGENT_WORKFLOW_URL = "https://github.com/NotYael/job-agent/actions/workflows/job-agent.yml";

const HOUR = 3_600_000;
const RUN_EVERY_HOURS = 24;
/** GitHub starts scheduled runs late, often by 3–6 hours, so a run only counts as missed after this. */
const GRACE_HOURS = 10;

export type AgentHealthState =
  | "waiting" // no runs logged yet
  | "active" // on schedule, last run fine
  | "warning" // on schedule, but the last run logged a problem (e.g. Gemini couldn't score jobs)
  | "late" // one scheduled run missed
  | "failing" // the last run failed
  | "stopped"; // two or more scheduled runs missed

export interface AgentHealth {
  state: AgentHealthState;
  lastRun: AgentRun | null;
  /** When the last scheduled run happened (or the first run, before any scheduled one). */
  lastScheduledAt: string | null;
  /** Scheduled runs missed since then. */
  missed: number;
}

export function agentHealth(runs: readonly AgentRun[], now: number): AgentHealth {
  const sorted = [...runs].sort((a, b) => Date.parse(b.ran_at) - Date.parse(a.ran_at));
  const lastRun = sorted[0] ?? null;
  if (!lastRun) return { state: "waiting", lastRun: null, lastScheduledAt: null, missed: 0 };

  // Manual runs prove the code works, not the schedule: measure from the
  // last scheduled run, or from the first run while none has happened yet.
  const baseline = sorted.find((r) => r.triggered_by === "schedule") ?? sorted[sorted.length - 1];
  const quietHours = (now - Date.parse(baseline.ran_at)) / HOUR;
  const missed = Math.max(0, Math.floor((quietHours - GRACE_HOURS) / RUN_EVERY_HOURS));

  const state: AgentHealthState =
    missed >= 2
      ? "stopped"
      : lastRun.status === "failed"
        ? "failing"
        : missed === 1
          ? "late"
          : lastRun.error
            ? "warning"
            : "active";

  return { state, lastRun, lastScheduledAt: baseline.ran_at, missed };
}
