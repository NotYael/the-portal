"use client";

import { useState } from "react";
import { buttonClasses, Button } from "@/components/ui/button";
import { Badge, FilterChip } from "@/components/ui/chip";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { AGENT_WORKFLOW_URL, agentHealth } from "@/lib/agent-health";
import { daysBetween, todayInManila } from "@/lib/dates";
import { setJobStatus, useJobBoard } from "@/lib/data/job-board";
import { useNow, useToday } from "@/lib/data/store";
import { jobCounts } from "@/lib/portal-summary";
import type { ISODate, JobMatch, JobStatus } from "@/lib/types";
import { AgentStatus } from "./agent-status";

const FILTERS = [
  { id: "all", label: "All", test: () => true },
  { id: "80", label: "80%+ match", test: (j: JobMatch) => j.match_pct >= 80 },
  { id: "salary", label: "Shows salary", test: (j: JobMatch) => Boolean(j.salary) },
] as const;

function foundLabel(foundAt: string, today: ISODate) {
  const days = daysBetween(todayInManila(new Date(foundAt)), today);
  return days <= 0 ? "found today" : days === 1 ? "found yesterday" : `found ${days}d ago`;
}

export function JobsView() {
  const { board, error } = useJobBoard();
  const today = useToday();
  const now = useNow();
  const toast = useToast();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");

  if (!today || !now) return <PageSkeleton cards={4} label="Loading job matches" />;
  if (!board) {
    if (!error) return <PageSkeleton cards={4} label="Loading job matches" />;
    return (
      <>
        <PageHeader kicker="Your resume, matched daily" title="Job agent" />
        <p role="alert" className="m-0 rounded-[12px] bg-warn-soft px-4 py-3 text-sm text-warn-ink">
          {error}
        </p>
      </>
    );
  }

  const counts = jobCounts(board.jobs);
  const test = FILTERS.find((f) => f.id === filter)!.test;
  const byMatch = (a: JobMatch, b: JobMatch) => b.match_pct - a.match_pct;
  const fresh = board.jobs.filter((j) => j.status === "new" && test(j)).sort(byMatch);
  const saved = board.jobs.filter((j) => j.status === "saved" && test(j)).sort(byMatch);
  const active = board.jobs.filter((j) => (j.status === "applied" || j.status === "interviewing") && test(j)).sort(byMatch);

  const move = async (job: JobMatch, status: JobStatus, message: string) => {
    toast((await setJobStatus(job, status)) ? message : `Couldn’t update ${job.title}. Try again.`);
  };

  const row = (j: JobMatch) => (
    <li key={j.id} className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-divider py-4">
      <span className="rounded-lg bg-accent-soft px-2.5 py-1.5 font-mono text-sm text-accent-ink">
        <span className="sr-only">Match </span>
        {j.match_pct}%
      </span>
      <div className="min-w-0 flex-[1_1_280px]">
        <p className="m-0 text-[15px] font-semibold">
          <a href={j.url} target="_blank" rel="noreferrer" className="text-ink no-underline hover:underline">
            {j.title}
          </a>
        </p>
        <p className="mt-0.5 mb-0 text-[13px] text-muted">
          {[j.company, j.hq ? `based in ${j.hq}` : null, j.location].filter(Boolean).join(" · ")}
        </p>
        <p className="mt-0.5 mb-0 text-[13px] text-muted">
          {[j.salary, j.job_type, `${foundLabel(j.found_at, today)} on ${j.source}`].filter(Boolean).join(" · ")}
        </p>
        <p className="mt-1.5 mb-0 text-[13px] text-ink-soft">Why: {j.reason}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {j.status === "new" ? (
          <>
            <Button onClick={() => move(j, "dismissed", `Dismissed ${j.title}`)}>Dismiss</Button>
            <Button onClick={() => move(j, "saved", `Saved ${j.title}`)}>Save</Button>
            <Button variant="dark" onClick={() => move(j, "applied", `Marked ${j.title} as applied`)}>
              Mark applied
            </Button>
          </>
        ) : j.status === "saved" ? (
          <>
            <Button onClick={() => move(j, "dismissed", `Dismissed ${j.title}`)}>Dismiss</Button>
            <Button variant="dark" onClick={() => move(j, "applied", `Marked ${j.title} as applied`)}>
              Mark applied
            </Button>
          </>
        ) : j.status === "applied" ? (
          <>
            <Badge tone="neutral">Applied</Badge>
            <Button onClick={() => move(j, "interviewing", `${j.title} moved to interviewing`)}>Interviewing</Button>
          </>
        ) : (
          <Badge tone="accent">Interviewing</Badge>
        )}
      </div>
    </li>
  );

  return (
    <>
      <PageHeader
        kicker="Your resume, matched daily"
        title="Job agent"
        actions={
          <a href={AGENT_WORKFLOW_URL} target="_blank" rel="noreferrer" className={buttonClasses({ variant: "primary", className: "hover:text-white" })}>
            Run on GitHub
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        }
      />

      <AgentStatus health={agentHealth(board.runs, now)} today={today} />

      {error ? (
        <p role="alert" className="m-0 rounded-[12px] bg-warn-soft px-4 py-3 text-sm text-warn-ink">
          {error}
        </p>
      ) : null}

      <section aria-label="Pipeline" className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
        {(["new", "saved", "applied", "interviewing"] as const).map((s) => (
          <div key={s} className="rounded-[12px] border border-line bg-surface p-4">
            <p className="m-0 text-[13px] text-muted capitalize">{s}</p>
            <p className="mt-1 mb-0 font-mono text-2xl">{counts[s]}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="matches-title" className="flex flex-col gap-1 rounded-[16px] border border-line bg-surface p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
          <h2 id="matches-title" className="m-0 font-display text-xl font-bold">
            New matches
          </h2>
          <div role="group" aria-label="Filter matches" className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <FilterChip key={f.id} pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.label}
              </FilterChip>
            ))}
          </div>
        </div>
        {fresh.length ? (
          <ul className="m-0 list-none p-0">{fresh.map(row)}</ul>
        ) : (
          <p className="m-0 border-t border-divider py-6 text-sm text-muted">
            No new matches{filter !== "all" ? " for this filter" : ""}. The agent looks again at its next run.
          </p>
        )}
      </section>

      {saved.length ? (
        <section aria-labelledby="saved-title" className="flex flex-col gap-1 rounded-[16px] border border-line bg-surface p-4 sm:p-6">
          <h2 id="saved-title" className="m-0 pb-2 font-display text-xl font-bold">
            Saved
          </h2>
          <ul className="m-0 list-none p-0">{saved.map(row)}</ul>
        </section>
      ) : null}

      {active.length ? (
        <section aria-labelledby="active-title" className="flex flex-col gap-1 rounded-[16px] border border-line bg-surface p-4 sm:p-6">
          <h2 id="active-title" className="m-0 pb-2 font-display text-xl font-bold">
            Applied and interviewing
          </h2>
          <ul className="m-0 list-none p-0">{active.map(row)}</ul>
        </section>
      ) : null}
    </>
  );
}
