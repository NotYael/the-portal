import { describe, expect, it } from "vitest";
import { daysLeftInYear, entriesThisWeek, journalStreak, weekSpending } from "./portal-summary";
import type { Expense, JournalEntry } from "./types";

const entry = (entry_date: string, tag: JournalEntry["tag"] = "note"): JournalEntry => ({
  id: entry_date + tag,
  entry_date,
  prompt: "",
  body: "",
  tag,
  goal_id: null,
  created_at: `${entry_date}T21:00:00+08:00`,
});

const spend = (spent_on: string, amount: number): Expense => ({
  id: spent_on + amount,
  category_id: "cat-food",
  amount,
  spent_on,
  description: "x",
  payment_method: "cash",
  source: "manual",
  created_at: "",
  updated_at: "",
});

describe("journalStreak", () => {
  it("counts back from yesterday when today isn't written yet", () => {
    const entries = [entry("2026-10-23"), entry("2026-10-22"), entry("2026-10-20")];
    expect(journalStreak(entries, "2026-10-24")).toBe(2);
  });

  it("includes today once it's written, across month boundaries", () => {
    const entries = [entry("2026-11-01"), entry("2026-10-31"), entry("2026-10-30")];
    expect(journalStreak(entries, "2026-11-01")).toBe(3);
  });

  it("is 0 with no recent entries", () => {
    expect(journalStreak([entry("2026-10-01")], "2026-10-24")).toBe(0);
  });
});

describe("entriesThisWeek", () => {
  it("keeps Monday through today, filtered by tag", () => {
    // 2026-10-24 is a Saturday; the week starts Monday 2026-10-19.
    const entries = [entry("2026-10-18", "win"), entry("2026-10-19", "win"), entry("2026-10-23", "target"), entry("2026-10-24", "win")];
    expect(entriesThisWeek(entries, "2026-10-24", "win").map((e) => e.entry_date)).toEqual(["2026-10-24", "2026-10-19"]);
  });
});

describe("weekSpending", () => {
  it("compares the same weekdays of last week", () => {
    // Wednesday 2026-10-21: this week = Mon–Wed, last week = Mon 12 – Wed 14.
    const rows = [spend("2026-10-19", 100), spend("2026-10-21", 50), spend("2026-10-12", 70), spend("2026-10-15", 999)];
    const w = weekSpending(rows, "2026-10-21");
    expect(w.monday).toBe("2026-10-19");
    expect(w.thisWeek).toBe(150);
    expect(w.lastWeek).toBe(70);
  });
});

describe("daysLeftInYear", () => {
  it("counts today", () => {
    expect(daysLeftInYear("2026-12-31")).toBe(1);
    expect(daysLeftInYear("2026-10-25")).toBe(68);
  });
});
