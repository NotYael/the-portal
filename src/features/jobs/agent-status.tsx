import { AGENT_SCHEDULE_LABEL, AGENT_WORKFLOW_URL, type AgentHealth, type AgentHealthState } from "@/lib/agent-health";
import { dayAndTime } from "@/lib/format";
import type { ISODate } from "@/lib/types";

const STATES: Record<AgentHealthState, { title: string; dot: string }> = {
  waiting: { title: "Waiting for first run", dot: "bg-dark-muted" },
  active: { title: "Active", dot: "bg-[#7C9BFF]" },
  warning: { title: "Ran with problems", dot: "bg-warn-line" },
  late: { title: "Missed a run", dot: "bg-warn-line" },
  failing: { title: "Last run failed", dot: "bg-warn" },
  stopped: { title: "Stopped", dot: "bg-warn" },
};

export function agentStatusTitle(state: AgentHealthState) {
  return STATES[state].title;
}

/** What went wrong and what to do about it; null when all is well. */
function advice(health: AgentHealth, today: ISODate): string | null {
  const since = health.lastScheduledAt ? dayAndTime(health.lastScheduledAt, today) : "";
  switch (health.state) {
    case "waiting":
      return "The bot logs every run here once its Portal secrets are set in GitHub.";
    case "warning":
      return `${health.lastRun?.error} The bot keeps those jobs and retries them next run.`;
    case "late":
      return `No scheduled run since ${since}. GitHub sometimes skips one; if the next is missed too, check the Actions tab.`;
    case "failing":
      return `${health.lastRun?.error ?? "No error was logged."} Open the run on GitHub for the full log.`;
    case "stopped":
      return `No scheduled run since ${since}. GitHub may have paused the schedule; open the Actions tab and re-enable the workflow.`;
    default:
      return null;
  }
}

export function AgentStatus({ health, today }: { health: AgentHealth; today: ISODate }) {
  const { title, dot } = STATES[health.state];
  const last = health.lastRun;
  const note = advice(health, today);

  return (
    <section aria-label="Agent status" className="flex flex-col gap-4 rounded-[16px] bg-panel px-4 py-5 text-white sm:px-6">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-5">
        <div>
          <p className="m-0 text-xs text-dark-muted">Status</p>
          <p className="mt-1 mb-0 flex items-center gap-2 text-[15px] font-semibold">
            <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${dot}`} />
            {title}
          </p>
        </div>
        <div>
          <p className="m-0 text-xs text-dark-muted">Schedule</p>
          <p className="mt-1 mb-0 text-[15px] font-semibold">{AGENT_SCHEDULE_LABEL}</p>
          <p className="mt-0.5 mb-0 text-xs text-dark-muted">GitHub often starts it a few hours late</p>
        </div>
        <div>
          <p className="m-0 text-xs text-dark-muted">Last run</p>
          <p className="mt-1 mb-0 text-[15px] font-semibold">
            {last ? `${dayAndTime(last.ran_at, today)}${last.triggered_by === "manual" ? " · manual" : ""}` : "Never"}
          </p>
          {last ? (
            <p className="mt-0.5 mb-0 text-xs text-dark-muted">
              {last.fetched} fetched · {last.candidates} screened · {last.matched} matched
            </p>
          ) : null}
        </div>
        <div>
          <p className="m-0 text-xs text-dark-muted">Sends to</p>
          <p className="mt-1 mb-0 text-[15px] font-semibold">Telegram</p>
          <p className="mt-0.5 mb-0 text-xs text-dark-muted">a short ping when there are matches</p>
        </div>
      </div>
      {note ? (
        <p role={health.state === "failing" || health.state === "stopped" ? "alert" : undefined} className="m-0 rounded-[10px] bg-dark-raised px-4 py-3 text-[13px] leading-normal text-[#D5D9E0]">
          {note}{" "}
          {health.state === "waiting" ? null : (
            <a href={AGENT_WORKFLOW_URL} target="_blank" rel="noreferrer" className="font-semibold text-white underline hover:text-accent-pale">
              Open GitHub Actions
            </a>
          )}
        </p>
      ) : null}
    </section>
  );
}
