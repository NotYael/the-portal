import type { ISODate, MonthKey } from "./types";

/** Every date in The Portal is a calendar date in Manila. */
export const TIMEZONE = "Asia/Manila";

const isoFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const hourFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIMEZONE,
  hour: "numeric",
  hourCycle: "h23",
});

/** Today's date in Manila as "YYYY-MM-DD". */
export function todayInManila(now: Date = new Date()): ISODate {
  return isoFormatter.format(now);
}

/** Current hour (0–23) in Manila. */
export function hourInManila(now: Date = new Date()): number {
  return Number(hourFormatter.format(now));
}

export function parseISODate(date: ISODate): { year: number; month: number; day: number } {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

export function toISODate(year: number, month: number, day: number): ISODate {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function isISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const { year, month, day } = parseISODate(value);
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(monthKey(year, month));
}

export function dayOfMonth(date: ISODate): number {
  return parseISODate(date).day;
}

export function addDays(date: ISODate, days: number): ISODate {
  const { year, month, day } = parseISODate(date);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return toISODate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Whole days from `a` to `b` (positive when b is later). */
export function daysBetween(a: ISODate, b: ISODate): number {
  const pa = parseISODate(a);
  const pb = parseISODate(b);
  return Math.round(
    (Date.UTC(pb.year, pb.month - 1, pb.day) - Date.UTC(pa.year, pa.month - 1, pa.day)) / 86_400_000,
  );
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayMon0(date: ISODate): number {
  const { year, month, day } = parseISODate(date);
  return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
}

/** Monday of the week containing `date`. */
export function startOfWeek(date: ISODate): ISODate {
  return addDays(date, -weekdayMon0(date));
}

/** ISO-8601 week number. */
export function isoWeekNumber(date: ISODate): number {
  const { year, month, day } = parseISODate(date);
  const d = new Date(Date.UTC(year, month - 1, day));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

// ---------- months ----------

export function monthKey(year: number, month: number): MonthKey {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function monthKeyOf(date: ISODate): MonthKey {
  return date.slice(0, 7);
}

export function parseMonthKey(key: MonthKey): { year: number; month: number } {
  const [year, month] = key.split("-").map(Number);
  return { year, month };
}

export function isMonthKey(value: string | null | undefined): value is MonthKey {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return false;
  const { month } = parseMonthKey(value);
  return month >= 1 && month <= 12;
}

export function addMonths(key: MonthKey, n: number): MonthKey {
  const { year, month } = parseMonthKey(key);
  const index = year * 12 + (month - 1) + n;
  return monthKey(Math.floor(index / 12), (index % 12) + 1);
}

export function daysInMonth(key: MonthKey): number {
  const { year, month } = parseMonthKey(key);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function firstDayOfMonth(key: MonthKey): ISODate {
  return `${key}-01`;
}

export function lastDayOfMonth(key: MonthKey): ISODate {
  return `${key}-${String(daysInMonth(key)).padStart(2, "0")}`;
}

/** Inclusive list of month keys from `from` to `to`. */
export function monthRange(from: MonthKey, to: MonthKey): MonthKey[] {
  const out: MonthKey[] = [];
  for (let k = from; k <= to; k = addMonths(k, 1)) out.push(k);
  return out;
}

export function monthsOfYear(year: number): MonthKey[] {
  return monthRange(monthKey(year, 1), monthKey(year, 12));
}
