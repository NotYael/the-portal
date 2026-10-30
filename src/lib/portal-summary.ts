/**
 * Read-only summaries other modules feed to Home and the weekly digest.
 * Pure functions, like expense-stats: the digest cron will reuse them.
 */
import { addDays, daysBetween, isoWeekNumber, startOfWeek, weekdayMon0 } from "./dates";
import { sumAmounts } from "./expense-stats";
import type { Expense, Goal, ISODate, JobMatch, JobStatus, JournalEntry, JournalTag } from "./types";

/** Consecutive days with an entry, ending today (or yesterday if today isn't written yet). */
export function journalStreak(entries: readonly JournalEntry[], today: ISODate): number {
  const days = new Set(entries.map((e) => e.entry_date));
  let day = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(day)) {
    streak += 1;
    day = addDays(day, -1);
  }
  return streak;
}

/** Entries from Monday of this week through today, newest first. */
export function entriesThisWeek(entries: readonly JournalEntry[], today: ISODate, tag?: JournalTag): JournalEntry[] {
  const monday = startOfWeek(today);
  return entries
    .filter((e) => e.entry_date >= monday && e.entry_date <= today && (!tag || e.tag === tag))
    .sort((a, b) => b.entry_date.localeCompare(a.entry_date) || b.created_at.localeCompare(a.created_at));
}

export function goalsForYear(goals: readonly Goal[], year: number): Goal[] {
  return goals.filter((g) => g.year === year);
}

export function goalSummary(goals: readonly Goal[], year: number) {
  const list = goalsForYear(goals, year);
  const behind = list.filter((g) => g.status === "behind");
  return {
    total: list.length,
    onTrack: list.filter((g) => g.status !== "behind").length,
    behind,
    averageProgress: list.length ? list.reduce((t, g) => t + g.progress_pct, 0) / list.length : 0,
  };
}

export function jobCounts(jobs: readonly JobMatch[]): Record<JobStatus, number> {
  const counts: Record<JobStatus, number> = { new: 0, saved: 0, applied: 0, interviewing: 0, dismissed: 0 };
  for (const j of jobs) counts[j.status] += 1;
  return counts;
}

export function topMatches(jobs: readonly JobMatch[], n = 3): JobMatch[] {
  return jobs
    .filter((j) => j.status === "new")
    .sort((a, b) => b.match_pct - a.match_pct)
    .slice(0, n);
}

/**
 * This week's spending (Monday → today) against the same weekdays last week,
 * so a Wednesday preview never compares 3 days with 7.
 */
export function weekSpending(expenses: readonly Expense[], today: ISODate) {
  const monday = startOfWeek(today);
  const span = weekdayMon0(today);
  const prevMonday = addDays(monday, -7);
  const prevEnd = addDays(prevMonday, span);
  const inRange = (e: Expense, from: ISODate, to: ISODate) => e.spent_on >= from && e.spent_on <= to;
  const thisWeek = sumAmounts(expenses.filter((e) => inRange(e, monday, today)));
  const lastWeek = sumAmounts(expenses.filter((e) => inRange(e, prevMonday, prevEnd)));
  return { monday, sunday: addDays(monday, 6), thisWeek, lastWeek, diff: thisWeek - lastWeek, week: isoWeekNumber(today) };
}

/** Days left in the year, counting today. */
export function daysLeftInYear(today: ISODate): number {
  return daysBetween(today, `${today.slice(0, 4)}-12-31`) + 1;
}
