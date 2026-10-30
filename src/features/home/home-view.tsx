"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClasses } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/card";
import { Badge } from "@/components/ui/chip";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress-bar";
import { PageSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { hourInManila, monthKeyOf, parseISODate } from "@/lib/dates";
import { agentHealth } from "@/lib/agent-health";
import { useJobBoard } from "@/lib/data/job-board";
import { setSubgoalDone, useNow, usePortalData, useToday } from "@/lib/data/store";
import { computeMonthStats, sumAmounts } from "@/lib/expense-stats";
import { MONTHS_LONG, dayAndTime, longDate, monthShort, peso, pesoExact, shortDate } from "@/lib/format";
import { nextSubgoal } from "@/lib/goal-progress";
import { entriesThisWeek, goalSummary, goalsForYear, jobCounts, journalStreak, topMatches } from "@/lib/portal-summary";
import type { Goal, GoalSubgoal } from "@/lib/types";
import { BudgetAlert } from "../expenses/budget-alert";
import { QuickAdd } from "../expenses/quick-add";
import { agentStatusTitle } from "../jobs/agent-status";

function greeting(hour: number) {
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

export function HomeView() {
  const data = usePortalData();
  const today = useToday();
  const now = useNow();
  const { board } = useJobBoard();
  if (!data || !today || !now) return <PageSkeleton cards={4} label="Loading your dashboard" />;

  const { year, month } = parseISODate(today);
  const stats = computeMonthStats({
    expenses: data.expenses,
    categories: data.categories,
    history: data.budgetHistory,
    rolloverEnabled: data.settings.rollover_enabled,
    month: monthKeyOf(today),
    today,
  });
  const goals = goalSummary(data.goals, year);
  const jobs = board?.jobs ?? [];
  const counts = jobCounts(jobs);
  const health = board ? agentHealth(board.runs, now) : null;
  const streak = journalStreak(data.journal, today);
  const wroteToday = data.journal.some((e) => e.entry_date === today);
  const wins = entriesThisWeek(data.journal, today, "win").slice(0, 3);
  const targets = entriesThisWeek(data.journal, today, "target").slice(0, 3);
  const recent = [...data.expenses]
    .sort((a, b) => b.spent_on.localeCompare(a.spent_on) || b.created_at.localeCompare(a.created_at))
    .slice(0, 5);
  const spentToday = sumAmounts(data.expenses.filter((e) => e.spent_on === today));
  const byId = new Map(data.categories.map((c) => [c.id, c]));
  const usage = stats.usage;
  const pipeline = (["saved", "applied", "interviewing"] as const).filter((s) => counts[s] > 0).map((s) => `${counts[s]} ${s}`);

  return (
    <>
      <PageHeader
        kicker={longDate(today)}
        title={`${greeting(hourInManila())}, ${data.profile.name}`}
        actions={
          <Link href="/digest" className={buttonClasses()}>
            Preview weekly digest
          </Link>
        }
      />

      <QuickAdd categories={data.categories} settings={data.settings} today={today} />

      <BudgetAlert stats={stats} thresholdPct={data.settings.alert_threshold_pct} />

      <section aria-label="At a glance" className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3 sm:gap-4">
        <SummaryCard href="/expenses" label={`Spent in ${MONTHS_LONG[month - 1]}`} value={peso(stats.total)}>
          {usage.ratio !== null ? (
            <>
              <ProgressBar ratio={usage.ratio} color={usage.isOver ? "var(--warn)" : "var(--accent)"} />
              <span className="text-[13px] text-muted">
                {Math.round(usage.ratio * 100)}% of {peso(usage.budget)} budget
              </span>
            </>
          ) : (
            <span className="text-[13px] text-muted">No budget set</span>
          )}
          {stats.count > 0 ? (
            <span className={`text-[13px] ${usage.budget > 0 && stats.projected > usage.budget ? "text-warn-ink" : "text-muted"}`}>
              On pace for {peso(stats.projected)} by {monthShort(stats.month)} {stats.daysInMonth}
            </span>
          ) : null}
        </SummaryCard>
        <SummaryCard href="/goals" label={`${year} goals`} value={goals.total ? `${Math.round(goals.averageProgress)}%` : "—"}>
          {goals.total ? (
            <>
              <ProgressBar ratio={goals.averageProgress / 100} />
              <span className={`text-[13px] ${goals.behind.length ? "text-warn-ink" : "text-muted"}`}>
                {goals.onTrack} of {goals.total} on track{goals.behind.length ? ` · ${goals.behind.length} behind` : ""}
              </span>
            </>
          ) : (
            <span className="text-[13px] text-muted">No goals set yet</span>
          )}
        </SummaryCard>
        <SummaryCard href="/jobs" label="Job agent" value={board ? `${counts.new} new` : "…"}>
          {health ? (
            <span className={`text-[13px] ${health.state === "active" || health.state === "waiting" ? "text-muted" : "text-warn-ink"}`}>
              {health.state === "active" && health.lastRun
                ? `last run ${dayAndTime(health.lastRun.ran_at, today)}`
                : `bot: ${agentStatusTitle(health.state).toLowerCase()}`}
            </span>
          ) : (
            <span className="text-[13px] text-muted">Loading matches…</span>
          )}
        </SummaryCard>
        <SummaryCard href={wroteToday ? "/journal" : "/journal#entry"} label="Journal" value={`${streak} day${streak === 1 ? "" : "s"}`}>
          <span className={`text-[13px] ${wroteToday ? "text-muted" : "font-semibold text-warn-ink"}`}>
            {wroteToday ? "Today’s entry is written" : "Write today’s entry →"}
          </span>
        </SummaryCard>
      </section>

      {/* Two columns that stack on their own, so no panel stretches to match the one beside it:
          goals and jobs on the left, this week and spending on the right. */}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <UpNext goals={goalsForYear(data.goals, year)} />

          <Panel title="Top job matches" aside={<Link href="/jobs" className="text-sm font-semibold">All {counts.new} →</Link>} gap="gap-1">
            {counts.new > 0 ? (
              <ul className="m-0 list-none p-0">
                {topMatches(jobs, 3).map((j, i, list) => (
                  <li key={j.id} className={`flex items-center justify-between gap-3 py-3 ${i < list.length - 1 ? "border-b border-divider" : ""}`}>
                    <div className="min-w-0">
                      <a href={j.url} target="_blank" rel="noreferrer" className="m-0 block truncate text-sm font-medium text-ink no-underline hover:underline">
                        {j.title}
                      </a>
                      <p className="mt-0.5 mb-0 truncate text-[13px] text-muted">{[j.company, j.hq, j.location].filter(Boolean).join(" · ")}</p>
                    </div>
                    <Badge mono>{j.match_pct}%</Badge>
                  </li>
                ))}
              </ul>
            ) : board ? (
              <p className="m-0 py-2 text-sm text-muted">
                No new matches.
                {health?.lastRun
                  ? ` The last run (${dayAndTime(health.lastRun.ran_at, today)}) screened ${health.lastRun.candidates} job${health.lastRun.candidates === 1 ? "" : "s"} and none made the cut.`
                  : ""}
              </p>
            ) : (
              <p className="m-0 py-2 text-sm text-muted">Loading matches…</p>
            )}
            {pipeline.length ? <p className="m-0 pt-2 text-[13px] text-muted">In your pipeline: {pipeline.join(" · ")}</p> : null}
          </Panel>

        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="This week so far" aside={<span className="text-[13px] text-muted">Digest sends Sunday, 8:00 PM</span>}>
            <div className="flex flex-col gap-2">
              <Eyebrow>Wins</Eyebrow>
              {wins.length ? (
                wins.map((e) => (
                  <p key={e.id} className="m-0 text-sm leading-normal">
                    {e.body}
                  </p>
                ))
              ) : (
                <p className="m-0 text-sm text-muted">No wins tagged yet.</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Eyebrow tone="warn">Targets for next week</Eyebrow>
              {targets.length ? (
                targets.map((e) => (
                  <p key={e.id} className="m-0 text-sm leading-normal">
                    {e.body}
                  </p>
                ))
              ) : (
                <p className="m-0 text-sm text-muted">No targets tagged yet.</p>
              )}
            </div>
            <Link href={wroteToday ? "/digest" : "/journal#entry"} className="text-sm font-semibold">
              {wroteToday ? "Edit before it sends →" : "Add a win or target in today’s entry →"}
            </Link>
          </Panel>

          <Panel
            title="Recent spending"
            aside={
              <span className="flex items-baseline gap-3 text-[13px] text-muted">
                {spentToday > 0 ? <span>Today {peso(spentToday)}</span> : null}
                <Link href="/expenses" className="text-sm font-semibold">
                  All →
                </Link>
              </span>
            }
            gap="gap-1"
          >
            {recent.length ? (
              <ul className="m-0 list-none p-0">
                {recent.map((e, i) => (
                  <li key={e.id} className={`flex justify-between gap-3 py-3 ${i < recent.length - 1 ? "border-b border-divider" : ""}`}>
                    <div className="min-w-0">
                      <p className="m-0 truncate text-sm font-medium">{e.description}</p>
                      <p className="mt-0.5 mb-0 text-[13px] text-muted">
                        {byId.get(e.category_id)?.label} · {e.spent_on === today ? "Today" : shortDate(e.spent_on)}
                      </p>
                    </div>
                    <span className="font-mono text-sm">−{pesoExact(e.amount)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 py-3 text-sm text-muted">Nothing logged yet. Use Quick add above.</p>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

/** Each open goal with its progress and next sub-goal, which can be ticked off right here. */
function UpNext({ goals }: { goals: Goal[] }) {
  const toast = useToast();
  const open = goals.filter((g) => g.status !== "done");
  const finished = goals.length - open.length;

  const tick = (goal: Goal, sub: GoalSubgoal) => {
    setSubgoalDone(goal.id, sub.id, true);
    const last = goal.subgoals.every((s) => s.done || s.id === sub.id);
    toast(last ? `“${goal.title}” is done` : `Ticked “${sub.title}”`, {
      label: "Undo",
      onClick: () => setSubgoalDone(goal.id, sub.id, false),
    });
  };

  return (
    <Panel title="Up next" aside={<Link href="/goals" className="text-sm font-semibold">Goals →</Link>}>
      {open.length ? (
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {open.map((g) => {
            const next = nextSubgoal(g.subgoals);
            return (
              <li key={g.id} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 font-medium">{g.title}</span>
                  <span className="shrink-0 font-mono">{g.progress_pct}%</span>
                </div>
                <ProgressBar ratio={g.progress_pct / 100} color={g.status === "behind" ? "var(--warn)" : "var(--accent)"} />
                {next ? (
                  <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm text-ink-soft">
                    <input
                      type="checkbox"
                      className="size-[18px] shrink-0 accent-accent"
                      checked={false}
                      onChange={() => tick(g, next)}
                      aria-label={`Tick off “${next.title}” for ${g.title}`}
                    />
                    <span>{next.title}</span>
                  </label>
                ) : (
                  <Link href="/goals" className="min-h-10 py-2 text-[13px] font-semibold">
                    Add sub-goals to track it →
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="m-0 text-sm text-muted">{goals.length ? "Every goal is done. Time to set new ones." : "No goals for this year yet."}</p>
      )}
      {open.length && finished ? (
        <p className="m-0 text-[13px] text-muted">
          {finished} goal{finished === 1 ? "" : "s"} done this year.
        </p>
      ) : null}
    </Panel>
  );
}

function SummaryCard({ href, label, value, children }: { href: string; label: string; value: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="flex min-w-0 flex-col gap-2 rounded-[16px] border border-line bg-surface p-4 text-ink no-underline hover:border-line-strong hover:text-ink sm:p-5"
    >
      <span className="text-[13px] text-muted">{label}</span>
      <span className="font-mono text-[22px] sm:text-[26px]">{value}</span>
      {children}
    </Link>
  );
}

function Panel({ title, aside, gap = "gap-4", children }: { title: string; aside?: ReactNode; gap?: string; children: ReactNode }) {
  return (
    <section className={`flex min-w-0 flex-col ${gap} rounded-[16px] border border-line bg-surface p-4 sm:p-6`}>
      <div className="flex flex-wrap items-baseline justify-between gap-3 pb-1">
        <h2 className="m-0 font-display text-xl font-bold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
