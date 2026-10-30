import { describe, expect, it } from "vitest";
import {
  addInterval,
  completionPatch,
  digestReminders,
  draftFromReminder,
  dueLabel,
  dueSoonCount,
  emptyReminderDraft,
  nextDueOn,
  reminderBuckets,
  repeatLabel,
  validateReminderDraft,
} from "./reminders";
import type { Reminder } from "./types";

const TODAY = "2026-10-30";

const reminder = (patch: Partial<Reminder> = {}): Reminder => ({
  id: "r",
  title: "Push a commit",
  notes: "",
  due_on: TODAY,
  repeat_every: null,
  repeat_unit: null,
  done_at: null,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
  ...patch,
});

describe("addInterval", () => {
  it("adds days and weeks", () => {
    expect(addInterval("2026-10-30", 50, "day")).toBe("2026-12-19");
    expect(addInterval("2026-10-30", 3, "week")).toBe("2026-11-20");
  });

  it("adds months and clamps to the end of a shorter month", () => {
    expect(addInterval("2026-01-15", 1, "month")).toBe("2026-02-15");
    expect(addInterval("2026-01-31", 1, "month")).toBe("2026-02-28");
    expect(addInterval("2028-01-31", 1, "month")).toBe("2028-02-29");
    expect(addInterval("2026-11-30", 3, "month")).toBe("2027-02-28");
  });
});

describe("nextDueOn", () => {
  const every50 = reminder({ due_on: "2026-12-19", repeat_every: 50, repeat_unit: "day" });

  it("moves one interval on when done on or before the due date", () => {
    expect(nextDueOn(every50, "2026-12-19")).toBe("2027-02-07");
    expect(nextDueOn(every50, "2026-12-01")).toBe("2027-02-07");
  });

  it("counts from the due date, skipping past today, when done late", () => {
    // Due Dec 19, done Feb 10: Feb 7 has passed, so the next one is Mar 29.
    expect(nextDueOn(every50, "2027-02-10")).toBe("2027-03-29");
  });

  it("steps months from the original date, so a 31st doesn't drift within one completion", () => {
    const monthly = reminder({ due_on: "2026-01-31", repeat_every: 1, repeat_unit: "month" });
    expect(nextDueOn(monthly, "2026-03-05")).toBe("2026-03-31");
  });

  it("is null for a one-off", () => {
    expect(nextDueOn(reminder(), TODAY)).toBeNull();
  });
});

describe("completionPatch", () => {
  it("moves a repeating reminder's due date", () => {
    const r = reminder({ due_on: "2026-10-30", repeat_every: 2, repeat_unit: "week" });
    expect(completionPatch(r, TODAY, "2026-10-30T02:00:00Z")).toEqual({ due_on: "2026-11-13" });
  });

  it("marks a one-off done", () => {
    expect(completionPatch(reminder(), TODAY, "2026-10-30T02:00:00Z")).toEqual({ done_at: "2026-10-30T02:00:00Z" });
  });
});

describe("reminderBuckets", () => {
  it("splits open reminders by due date and lists done ones newest first", () => {
    const list = [
      reminder({ id: "later", due_on: "2026-12-01" }),
      reminder({ id: "week-edge", due_on: "2026-11-06" }),
      reminder({ id: "today", due_on: TODAY }),
      reminder({ id: "overdue", due_on: "2026-10-20" }),
      reminder({ id: "just-past-week", due_on: "2026-11-07" }),
      reminder({ id: "done-old", due_on: "2026-10-01", done_at: "2026-10-02T00:00:00Z" }),
      reminder({ id: "done-new", due_on: "2026-10-10", done_at: "2026-10-11T00:00:00Z" }),
    ];
    const b = reminderBuckets(list, TODAY);
    expect(b.overdue.map((r) => r.id)).toEqual(["overdue"]);
    expect(b.thisWeek.map((r) => r.id)).toEqual(["today", "week-edge"]);
    expect(b.later.map((r) => r.id)).toEqual(["just-past-week", "later"]);
    expect(b.done.map((r) => r.id)).toEqual(["done-new", "done-old"]);
  });

  it("counts overdue + due within 7 days for the badge", () => {
    const list = [
      reminder({ due_on: "2026-10-01" }),
      reminder({ due_on: "2026-11-06" }),
      reminder({ due_on: "2026-11-07" }),
      reminder({ due_on: "2026-10-01", done_at: "2026-10-02T00:00:00Z" }),
    ];
    expect(dueSoonCount(list, TODAY)).toBe(2);
  });
});

describe("labels", () => {
  it("says how far away the due date is", () => {
    expect(dueLabel(TODAY, TODAY)).toBe("Due today");
    expect(dueLabel("2026-10-31", TODAY)).toBe("Due tomorrow");
    expect(dueLabel("2026-11-12", TODAY)).toBe("In 13 days");
    expect(dueLabel("2026-11-13", TODAY)).toBe("In 2 weeks");
    expect(dueLabel("2026-12-19", TODAY)).toBe("In 7 weeks");
    expect(dueLabel("2026-10-29", TODAY)).toBe("1 day overdue");
    expect(dueLabel("2026-10-20", TODAY)).toBe("10 days overdue");
  });

  it("describes the repeat", () => {
    expect(repeatLabel(reminder())).toBeNull();
    expect(repeatLabel(reminder({ repeat_every: 1, repeat_unit: "week" }))).toBe("Every week");
    expect(repeatLabel(reminder({ repeat_every: 50, repeat_unit: "day" }))).toBe("Every 50 days");
    expect(repeatLabel(reminder({ repeat_every: 3, repeat_unit: "month" }))).toBe("Every 3 months");
  });
});

describe("validateReminderDraft", () => {
  it("accepts a one-off and trims it", () => {
    const draft = { ...emptyReminderDraft(TODAY), title: "  Renew passport ", notes: " at DFA ", due_on: "2026-12-01" };
    expect(validateReminderDraft(draft)).toEqual({
      errors: {},
      value: { title: "Renew passport", notes: "at DFA", due_on: "2026-12-01", repeat_every: null, repeat_unit: null },
    });
  });

  it("accepts a repeat", () => {
    const draft = { ...emptyReminderDraft(TODAY), title: "Push a commit", repeats: true, repeat_every: "50", repeat_unit: "day" as const };
    expect(validateReminderDraft(draft).value).toMatchObject({ repeat_every: 50, repeat_unit: "day" });
  });

  it("rejects a missing title, a bad date and a bad interval", () => {
    const draft = { ...emptyReminderDraft(TODAY), title: " ", due_on: "2026-02-30", repeats: true, repeat_every: "0" };
    const { errors, value } = validateReminderDraft(draft);
    expect(value).toBeNull();
    expect(Object.keys(errors).sort()).toEqual(["due_on", "repeat_every", "title"]);
    expect(validateReminderDraft({ ...draft, title: "x", due_on: TODAY, repeat_every: "2.5" }).errors.repeat_every).toBeTruthy();
    expect(validateReminderDraft({ ...draft, title: "x", due_on: TODAY, repeat_every: "366" }).errors.repeat_every).toBeTruthy();
  });

  it("round-trips an existing reminder", () => {
    const r = reminder({ title: "Pay rent", notes: "BDO", due_on: "2026-11-15", repeat_every: 1, repeat_unit: "month" });
    expect(validateReminderDraft(draftFromReminder(r)).value).toEqual({
      title: "Pay rent",
      notes: "BDO",
      due_on: "2026-11-15",
      repeat_every: 1,
      repeat_unit: "month",
    });
  });
});

describe("digestReminders", () => {
  it("lists open reminders due up to the end date, oldest first, flagging overdue ones", () => {
    const list = [
      reminder({ id: "far", due_on: "2026-11-20" }),
      reminder({ id: "next-week", due_on: "2026-11-04" }),
      reminder({ id: "overdue", due_on: "2026-10-25" }),
      reminder({ id: "done", due_on: "2026-10-25", done_at: "2026-10-26T00:00:00Z" }),
    ];
    expect(digestReminders(list, TODAY, "2026-11-08")).toEqual([
      { id: "overdue", title: "Push a commit", due_on: "2026-10-25", overdue: true },
      { id: "next-week", title: "Push a commit", due_on: "2026-11-04", overdue: false },
    ]);
  });
});
