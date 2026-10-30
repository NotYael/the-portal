import { describe, expect, it } from "vitest";
import { maskAmounts } from "./privacy";

describe("maskAmounts", () => {
  it("masks peso amounts in AI text and leaves percentages and dates alone", () => {
    expect(maskAmounts("At this pace you'll spend ₱27,900 by Oct 31 — ₱2,900 over your ₱ 25,000 budget.")).toBe(
      "At this pace you'll spend ******* by Oct 31 — ******* over your ******* budget.",
    );
    expect(maskAmounts("Food is 31% of spending; PHP 1,240.50 and 1.5k pesos on Grab, ₱1.5k on gifts.")).toBe(
      "Food is 31% of spending; ******* and ******* on Grab, ******* on gifts.",
    );
    expect(maskAmounts("“Coffee” shows up 7× since Sep 1–24.")).toBe("“Coffee” shows up 7× since Sep 1–24.");
  });
});
