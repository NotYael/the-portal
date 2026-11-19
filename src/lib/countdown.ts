/**
 * The 1/3/6 month countdown on Home and in the sidebar. Pure functions; the
 * database sets the real start and end (…_countdowns.sql), `countdownEnd`
 * only mirrors it for demo mode and the "ends on" preview.
 */
import { todayInManila } from "./dates";
import { addInterval } from "./reminders";
import type { ISODate } from "./types";

export const COUNTDOWN_TITLE_MAX = 80;

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** Manila is UTC+8 all year (no daylight saving). */
const MANILA_OFFSET = 8 * HOUR;

/** `start` plus `months` on the Manila calendar, same time of day; 31 Jan + 1 month = 28/29 Feb, like Postgres. */
export function countdownEnd(start: Date, months: number): Date {
  const date = addInterval(todayInManila(start), months, "month");
  const [year, month, day] = date.split("-").map(Number);
  const timeOfDay = (((start.getTime() + MANILA_OFFSET) % DAY) + DAY) % DAY;
  return new Date(Date.UTC(year, month - 1, day) - MANILA_OFFSET + timeOfDay);
}

export interface TimeLeft {
  done: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function timeLeft(endsAt: string, now: number): TimeLeft {
  const ms = Math.max(0, new Date(endsAt).getTime() - now);
  return {
    done: ms === 0,
    days: Math.floor(ms / DAY),
    hours: Math.floor((ms % DAY) / HOUR),
    minutes: Math.floor((ms % HOUR) / MINUTE),
    seconds: Math.floor((ms % MINUTE) / SECOND),
  };
}

/** Share of the countdown already behind you, 0–1. */
export function elapsedRatio(startedAt: string, endsAt: string, now: number): number {
  const start = new Date(startedAt).getTime();
  const span = new Date(endsAt).getTime() - start;
  if (!(span > 0)) return 1;
  return Math.min(1, Math.max(0, (now - start) / span));
}

/**
 * "84d 3h left", "3h 12m left", "12m left", or "Done". Days and hours round
 * down like the big countdown; only the last hour rounds up, so it never says 0m early.
 */
export function shortTimeLeft(endsAt: string, now: number): string {
  const ms = new Date(endsAt).getTime() - now;
  if (ms <= 0) return "Done";
  if (ms < HOUR) return `${Math.ceil(ms / MINUTE)}m left`;
  const t = timeLeft(endsAt, now);
  return t.days > 0 ? `${t.days}d ${t.hours}h left` : `${t.hours}h ${t.minutes}m left`;
}

/** Manila calendar date of a timestamp. */
export function manilaDate(timestamp: string): ISODate {
  return todayInManila(new Date(timestamp));
}

export function countdownTitleError(title: string): string | null {
  const trimmed = title.trim();
  if (!trimmed) return "Name it, e.g. “No-spend run”.";
  if (trimmed.length > COUNTDOWN_TITLE_MAX) return `Keep it under ${COUNTDOWN_TITLE_MAX} characters.`;
  return null;
}
