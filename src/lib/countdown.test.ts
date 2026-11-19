import { describe, expect, it } from "vitest";
import { countdownEnd, countdownTitleError, elapsedRatio, manilaDate, shortTimeLeft, timeLeft } from "./countdown";

describe("countdownEnd", () => {
  it("adds months on the Manila calendar at the same time of day", () => {
    // 19 Nov 2026, 8:53 AM in Manila
    expect(countdownEnd(new Date("2026-11-19T00:53:48Z"), 3).toISOString()).toBe("2027-02-19T00:53:48.000Z");
    expect(countdownEnd(new Date("2026-11-19T00:53:48Z"), 6).toISOString()).toBe("2027-05-19T00:53:48.000Z");
  });

  it("uses the Manila date, not the UTC one", () => {
    // 31 Dec 2026 11 PM UTC is already 1 Jan 2027, 7 AM in Manila
    expect(countdownEnd(new Date("2026-12-31T23:00:00Z"), 1).toISOString()).toBe("2027-01-31T23:00:00.000Z");
  });

  it("clamps to the end of a shorter month", () => {
    // 31 Jan 2027, 10 AM Manila + 1 month = 28 Feb 2027
    expect(countdownEnd(new Date("2027-01-31T02:00:00Z"), 1).toISOString()).toBe("2027-02-28T02:00:00.000Z");
  });
});

describe("timeLeft", () => {
  const end = "2026-12-01T00:00:00Z";

  it("splits what's left into days, hours, minutes and seconds", () => {
    const now = new Date(end).getTime() - ((2 * 24 + 3) * 3600 + 4 * 60 + 5) * 1000;
    expect(timeLeft(end, now)).toEqual({ done: false, days: 2, hours: 3, minutes: 4, seconds: 5 });
  });

  it("stops at zero once it ends", () => {
    expect(timeLeft(end, new Date(end).getTime() + 5000)).toEqual({ done: true, days: 0, hours: 0, minutes: 0, seconds: 0 });
  });
});

describe("elapsedRatio", () => {
  it("is the share of the span already gone, kept within 0–1", () => {
    const start = "2026-01-01T00:00:00Z";
    const end = "2026-01-11T00:00:00Z";
    expect(elapsedRatio(start, end, new Date("2026-01-03T12:00:00Z").getTime())).toBe(0.25);
    expect(elapsedRatio(start, end, new Date("2025-12-31T00:00:00Z").getTime())).toBe(0);
    expect(elapsedRatio(start, end, new Date("2026-02-01T00:00:00Z").getTime())).toBe(1);
  });
});

describe("shortTimeLeft", () => {
  const end = new Date("2026-12-01T00:00:00Z").getTime();
  const at = (ms: number) => shortTimeLeft("2026-12-01T00:00:00Z", end - ms);

  it("shows the two biggest units, rounded down like the big countdown", () => {
    expect(at((84 * 24 + 3) * 3600_000 + 30 * 60_000)).toBe("84d 3h left");
    expect(at(3 * 3600_000 + 12 * 60_000)).toBe("3h 12m left");
    // A second short of 181 days is still 180d 23h, not 181d 0h.
    expect(at(181 * 86_400_000 - 1000)).toBe("180d 23h left");
  });

  it("rounds the last hour's minutes up so it never shows 0m before the end", () => {
    expect(at(30_000)).toBe("1m left");
    expect(at(11 * 60_000 + 1000)).toBe("12m left");
  });

  it("says Done at the end", () => {
    expect(at(0)).toBe("Done");
    expect(at(-1000)).toBe("Done");
  });
});

describe("manilaDate", () => {
  it("gives the Manila calendar date of a timestamp", () => {
    expect(manilaDate("2026-11-18T16:30:00Z")).toBe("2026-11-19");
  });
});

describe("countdownTitleError", () => {
  it("requires a name under the limit", () => {
    expect(countdownTitleError("  ")).not.toBeNull();
    expect(countdownTitleError("x".repeat(81))).not.toBeNull();
    expect(countdownTitleError(" No-spend run ")).toBeNull();
  });
});
