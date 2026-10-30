/**
 * Builds the weekly digest from each module's rows (docs/PORTAL_SPEC.md →
 * Weekly digest). The /digest page previews it today; the Sunday cron will
 * render the same data into the email. The `note` is the template fallback
 * for the Gemini-written summary.
 */
import type { PortalState } from "./data/portal-state";
import { addDays, monthKeyOf, parseISODate, weekdayMon0 } from "./dates";
import { computeMonthStats } from "./expense-stats";
import { MONTHS_LONG, MONTHS_SHORT, WEEKDAYS_SHORT, peso, shortDate } from "./format";
import { entriesThisWeek, goalSummary, jobCounts, topMatches, weekSpending } from "./portal-summary";
import { digestReminders } from "./reminders";
import type { ISODate, Reminder } from "./types";

export interface DigestData {
  week: number;
  rangeLabel: string;
  sendLabel: string;
  name: string;
  wins: string[];
  targets: string[];
  expenses: {
    thisWeek: number;
    lastWeek: number;
    diff: number;
    monthUsedPct: number | null;
    topCategory: string | null;
  } | null;
  goals: { onTrack: number; total: number; behind: string[] };
  jobs: { fresh: number; topMatch: number | null };
  /** Open reminders that are overdue or due by the Sunday after this digest. */
  reminders: { id: string; title: string; when: string; overdue: boolean }[];
  note: string;
  subject: string;
}

function rangeLabel(from: ISODate, to: ISODate) {
  const a = parseISODate(from);
  const b = parseISODate(to);
  if (a.month === b.month) return `${a.day}–${b.day} ${MONTHS_LONG[b.month - 1]} ${b.year}`;
  return `${a.day} ${MONTHS_SHORT[a.month - 1]} – ${b.day} ${MONTHS_SHORT[b.month - 1]} ${b.year}`;
}

export function buildDigest(state: PortalState, today: ISODate, reminders: Reminder[] = []): DigestData {
  const spend = weekSpending(state.expenses, today);
  const sunday = addDays(spend.monday, 6);
  const sun = parseISODate(sunday);
  const year = parseISODate(today).year;

  const wins = entriesThisWeek(state.journal, today, "win").slice(0, 5).map((e) => e.body);
  const targets = entriesThisWeek(state.journal, today, "target").slice(0, 4).map((e) => e.body);
  const goals = goalSummary(state.goals, year);
  const counts = jobCounts(state.jobs);
  const top = topMatches(state.jobs, 1)[0];
  // The digest sends on Sunday, so "the week ahead" runs to the following Sunday.
  const due = digestReminders(reminders, today, addDays(sunday, 7)).map((r) => ({
    id: r.id,
    title: r.title,
    overdue: r.overdue,
    when: r.overdue ? `was due ${shortDate(r.due_on)}` : `${WEEKDAYS_SHORT[weekdayMon0(r.due_on)]}, ${shortDate(r.due_on)}`,
  }));

  let expenses: DigestData["expenses"] = null;
  if (state.settings.include_in_digest) {
    const month = computeMonthStats({
      expenses: state.expenses,
      categories: state.categories,
      history: state.budgetHistory,
      rolloverEnabled: state.settings.rollover_enabled,
      month: monthKeyOf(today),
      today,
    });
    expenses = {
      thisWeek: spend.thisWeek,
      lastWeek: spend.lastWeek,
      diff: spend.diff,
      monthUsedPct: month.usage.ratio === null ? null : Math.round(month.usage.ratio * 100),
      topCategory: month.topCategory?.category.label ?? null,
    };
  }

  const behind = goals.behind.map((g) => g.area);
  const noteParts = [
    goals.total
      ? `${goals.onTrack} of ${goals.total} goals are on track${behind.length ? `; ${behind.join(" and ")} ${behind.length === 1 ? "needs" : "need"} attention` : ""}.`
      : "",
    expenses
      ? `Spending is ${peso(Math.abs(expenses.diff))} ${expenses.diff <= 0 ? "lower" : "higher"} than the same days last week.`
      : "",
    wins.length ? `You logged ${wins.length} win${wins.length === 1 ? "" : "s"} — keep the streak going.` : "",
    due.length ? `${due.length} reminder${due.length === 1 ? " needs" : "s need"} you in the week ahead.` : "",
  ];

  const subjectParts = [`${wins.length} win${wins.length === 1 ? "" : "s"}`, `${targets.length} target${targets.length === 1 ? "" : "s"}`];
  if (expenses) subjectParts.push(`${peso(Math.abs(expenses.diff))} ${expenses.diff <= 0 ? "under" : "over"} last week`);

  return {
    week: spend.week,
    rangeLabel: rangeLabel(spend.monday, sunday),
    sendLabel: `Sunday ${sun.day} ${MONTHS_SHORT[sun.month - 1]}, 8:00 PM`,
    name: state.profile.name,
    wins,
    targets,
    expenses,
    goals: { onTrack: goals.onTrack, total: goals.total, behind },
    jobs: { fresh: counts.new, topMatch: top?.match_pct ?? null },
    reminders: due,
    note: noteParts.filter(Boolean).join(" "),
    subject: `Week ${spend.week}: ${subjectParts.join(", ")}`,
  };
}
