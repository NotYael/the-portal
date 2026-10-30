import { daysBetween, parseISODate, parseMonthKey, TIMEZONE, todayInManila } from "./dates";
import { amountsHidden, MASK } from "./privacy";
import type { ISODate, MonthKey } from "./types";

export const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

export const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

export const WEEKDAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const WEEKDAYS_LONG = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
] as const;

const MINUS = "−";

// The three money formatters below return MASK while amounts are hidden (lib/privacy.ts).

/** "₱18,420" — whole pesos, the way every summary in the mockup shows money. */
export function peso(amount: number): string {
  if (amountsHidden()) return MASK;
  const rounded = Math.round(amount);
  return (rounded < 0 ? MINUS : "") + "₱" + Math.abs(rounded).toLocaleString("en-US");
}

/** "₱186" or "₱186.50" — keeps centavos when a row has them. */
export function pesoExact(amount: number): string {
  if (amountsHidden()) return MASK;
  const hasCents = Math.round(amount * 100) % 100 !== 0;
  return (
    (amount < 0 ? MINUS : "") +
    "₱" +
    Math.abs(amount).toLocaleString("en-US", {
      minimumFractionDigits: hasCents ? 2 : 0,
      maximumFractionDigits: 2,
    })
  );
}

/** "18.4k" for bar labels. */
export function compactPeso(amount: number): string {
  if (amountsHidden()) return MASK;
  if (Math.abs(amount) < 1000) return String(Math.round(amount));
  return (amount / 1000).toFixed(1) + "k";
}

/** "34%" */
export function percent(ratio: number): string {
  return Math.round(ratio * 100) + "%";
}

/** "+12%" / "−8%" */
export function signedPercent(ratio: number): string {
  const value = Math.round(Math.abs(ratio) * 100);
  return (ratio < 0 ? MINUS : "+") + value + "%";
}

/** "October 2026" */
export function monthLong(key: MonthKey): string {
  const { year, month } = parseMonthKey(key);
  return `${MONTHS_LONG[month - 1]} ${year}`;
}

/** "Oct 2026" */
export function monthShortYear(key: MonthKey): string {
  const { year, month } = parseMonthKey(key);
  return `${MONTHS_SHORT[month - 1]} ${year}`;
}

/** "Oct" */
export function monthShort(key: MonthKey): string {
  return MONTHS_SHORT[parseMonthKey(key).month - 1];
}

/** "Oct" or "Dec ’25" when the label needs its year. */
export function monthShortMaybeYear(key: MonthKey, withYear: boolean): string {
  const { year } = parseMonthKey(key);
  return monthShort(key) + (withYear ? ` ’${String(year).slice(2)}` : "");
}

/** "Oct 24" */
export function shortDate(date: ISODate): string {
  const { month, day } = parseISODate(date);
  return `${MONTHS_SHORT[month - 1]} ${day}`;
}

/** "24 Oct 2026" */
export function mediumDate(date: ISODate): string {
  const { year, month, day } = parseISODate(date);
  return `${day} ${MONTHS_SHORT[month - 1]} ${year}`;
}

/** "Saturday, 24 October 2026" */
export function longDate(date: ISODate): string {
  const { year, month, day } = parseISODate(date);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const name = WEEKDAYS_LONG[(weekday + 6) % 7];
  return `${name}, ${day} ${MONTHS_LONG[month - 1]} ${year}`;
}

const timeFormatter = new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, hour: "numeric", minute: "2-digit" });

/** "Today, 8:16 PM", "Yesterday, 1:05 AM" or "Oct 24, 9:05 PM" for a timestamp, in Manila time. */
export function dayAndTime(timestamp: string, today: ISODate): string {
  const instant = new Date(timestamp);
  const date = todayInManila(instant);
  const days = daysBetween(date, today);
  return `${days === 0 ? "Today" : days === 1 ? "Yesterday" : shortDate(date)}, ${timeFormatter.format(instant)}`;
}

/** Parses "1,500", "₱ 1500.50" or "1.5k" into a number; NaN when it isn't one. */
export function parseAmount(input: string): number {
  const cleaned = input.replace(/[₱,\s]/g, "").toLowerCase();
  if (!cleaned) return NaN;
  const k = cleaned.endsWith("k");
  const value = Number(k ? cleaned.slice(0, -1) : cleaned);
  if (!Number.isFinite(value)) return NaN;
  return k ? value * 1000 : value;
}

/** "25,000" for number inputs that show thousands separators. */
export function groupThousands(amount: number): string {
  return amount.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
