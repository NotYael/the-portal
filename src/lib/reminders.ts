/**
 * Reminders: due dates, repeats and the groups the page, Home and the digest
 * show. Pure functions; dates are calendar dates in Manila (lib/dates.ts).
 */
import { addDays, addMonths, daysBetween, daysInMonth, isISODate, monthKeyOf, parseISODate, toISODate } from "./dates";
import type { ISODate, NewReminder, Reminder, RepeatUnit } from "./types";

export const TITLE_MAX = 120;
export const NOTES_MAX = 1000;
export const REPEAT_MAX = 365;
/** "Due this week" and the sidebar badge look this many days ahead. */
export const SOON_DAYS = 7;

/** `date` plus `every` days, weeks or months. Months clamp to the last day (31 Jan + 1 month = 28/29 Feb). */
export function addInterval(date: ISODate, every: number, unit: RepeatUnit): ISODate {
  if (unit === "day") return addDays(date, every);
  if (unit === "week") return addDays(date, every * 7);
  const target = addMonths(monthKeyOf(date), every);
  const { year, month } = parseISODate(`${target}-01`);
  return toISODate(year, month, Math.min(parseISODate(date).day, daysInMonth(target)));
}

/**
 * The due date after marking a repeating reminder done: the first step after
 * today, counted from the current due date. Counting from the due date (not
 * the day it was ticked) means a late tick never pushes the next one further out.
 */
export function nextDueOn(reminder: Reminder, today: ISODate): ISODate | null {
  const { repeat_every: every, repeat_unit: unit, due_on } = reminder;
  if (!every || !unit) return null;
  // Each step starts from the original date, so month clamping can't compound.
  for (let k = 1; ; k++) {
    const next = addInterval(due_on, every * k, unit);
    if (next > today) return next;
  }
}

/** What marking a reminder done changes: a repeating one moves on, a one-off gets `done_at`. */
export function completionPatch(reminder: Reminder, today: ISODate, now: string): Pick<Reminder, "due_on"> | Pick<Reminder, "done_at"> {
  const next = nextDueOn(reminder, today);
  return next ? { due_on: next } : { done_at: now };
}

const byDue = (a: Reminder, b: Reminder) => a.due_on.localeCompare(b.due_on) || a.title.localeCompare(b.title);

export interface ReminderBuckets {
  overdue: Reminder[];
  /** Due today through the next SOON_DAYS days. */
  thisWeek: Reminder[];
  later: Reminder[];
  /** Finished one-offs, most recent first. */
  done: Reminder[];
}

export function reminderBuckets(reminders: Reminder[], today: ISODate): ReminderBuckets {
  const soon = addDays(today, SOON_DAYS);
  const open = reminders.filter((r) => !r.done_at).sort(byDue);
  return {
    overdue: open.filter((r) => r.due_on < today),
    thisWeek: open.filter((r) => r.due_on >= today && r.due_on <= soon),
    later: open.filter((r) => r.due_on > soon),
    done: reminders.filter((r) => r.done_at).sort((a, b) => b.done_at!.localeCompare(a.done_at!)),
  };
}

/** Open reminders that are overdue or due in the next SOON_DAYS days (the sidebar badge). */
export function dueSoonCount(reminders: Reminder[], today: ISODate): number {
  const soon = addDays(today, SOON_DAYS);
  return reminders.filter((r) => !r.done_at && r.due_on <= soon).length;
}

/** "Due today", "In 13 days", "In 3 weeks", "2 days overdue". */
export function dueLabel(due: ISODate, today: ISODate): string {
  const days = daysBetween(today, due);
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days < 0) return `${-days} day${days === -1 ? "" : "s"} overdue`;
  if (days < 14) return `In ${days} days`;
  return `In ${Math.floor(days / 7)} weeks`;
}

const UNIT_LABEL: Record<RepeatUnit, string> = { day: "day", week: "week", month: "month" };

/** "Every week", "Every 50 days"; null for a one-off. */
export function repeatLabel(reminder: Pick<Reminder, "repeat_every" | "repeat_unit">): string | null {
  const { repeat_every: every, repeat_unit: unit } = reminder;
  if (!every || !unit) return null;
  return every === 1 ? `Every ${UNIT_LABEL[unit]}` : `Every ${every} ${UNIT_LABEL[unit]}s`;
}

// ---------- the add / edit form ----------

export interface ReminderDraft {
  title: string;
  notes: string;
  due_on: string;
  repeats: boolean;
  /** As typed. */
  repeat_every: string;
  repeat_unit: RepeatUnit;
}

export type ReminderDraftErrors = Partial<Record<"title" | "notes" | "due_on" | "repeat_every", string>>;

/** A blank form, due three weeks out: these are reminders for weeks from now, not daily to-dos. */
export function emptyReminderDraft(today: ISODate): ReminderDraft {
  return { title: "", notes: "", due_on: addDays(today, 21), repeats: false, repeat_every: "4", repeat_unit: "week" };
}

export function draftFromReminder(reminder: Reminder): ReminderDraft {
  return {
    title: reminder.title,
    notes: reminder.notes,
    due_on: reminder.due_on,
    repeats: reminder.repeat_every !== null,
    repeat_every: String(reminder.repeat_every ?? 4),
    repeat_unit: reminder.repeat_unit ?? "week",
  };
}

export function validateReminderDraft(draft: ReminderDraft): { errors: ReminderDraftErrors; value: NewReminder | null } {
  const errors: ReminderDraftErrors = {};
  const title = draft.title.trim();
  const notes = draft.notes.trim();
  if (!title) errors.title = "Give the reminder a title.";
  else if (title.length > TITLE_MAX) errors.title = `Keep it under ${TITLE_MAX} characters.`;
  if (notes.length > NOTES_MAX) errors.notes = `Keep notes under ${NOTES_MAX} characters.`;
  if (!isISODate(draft.due_on)) errors.due_on = "Pick a due date.";

  let every: number | null = null;
  if (draft.repeats) {
    every = Number(draft.repeat_every);
    if (!Number.isInteger(every) || every < 1 || every > REPEAT_MAX) errors.repeat_every = `Use a whole number from 1 to ${REPEAT_MAX}.`;
  }

  if (Object.keys(errors).length) return { errors, value: null };
  return {
    errors,
    value: { title, notes, due_on: draft.due_on, repeat_every: every, repeat_unit: draft.repeats ? draft.repeat_unit : null },
  };
}

// ---------- weekly digest ----------

export interface DigestReminder {
  id: string;
  title: string;
  due_on: ISODate;
  overdue: boolean;
}

/** Open reminders due on or before `until`, oldest first; `overdue` is relative to `today`. */
export function digestReminders(reminders: Reminder[], today: ISODate, until: ISODate): DigestReminder[] {
  return reminders
    .filter((r) => !r.done_at && r.due_on <= until)
    .sort(byDue)
    .map((r) => ({ id: r.id, title: r.title, due_on: r.due_on, overdue: r.due_on < today }));
}
