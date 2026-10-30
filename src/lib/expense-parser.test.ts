import { describe, expect, it } from "vitest";
import { parseExpensesWithRules } from "./expense-parser";

const TODAY = "2026-10-24";

describe("parseExpensesWithRules", () => {
  it("splits the mockup example into three categorized expenses", () => {
    const { items, source } = parseExpensesWithRules("grab to ATC 186, coffee 140, gift for mama 1,500", TODAY);
    expect(source).toBe("rules");
    expect(items).toEqual([
      { description: "Grab to ATC", amount: 186, category_slug: "transport", spent_on: TODAY, payment_method: null },
      { description: "Coffee", amount: 140, category_slug: "food", spent_on: TODAY, payment_method: null },
      { description: "Gift for mama", amount: 1500, category_slug: "gifts", spent_on: TODAY, payment_method: null },
    ]);
  });

  it("understands 1.5k, Taglish dates and stated payment methods", () => {
    const { items } = parseExpensesWithRules("groceries sa Puregold 1.5k via GCash and pamasahe kahapon 60", TODAY);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ amount: 1500, category_slug: "food", payment_method: "gcash", spent_on: TODAY });
    expect(items[0].description).toBe("Groceries sa Puregold");
    expect(items[1]).toMatchObject({ amount: 60, category_slug: "transport", spent_on: "2026-10-23" });
  });

  it("skips chunks without an amount and defaults to other", () => {
    const { items } = parseExpensesWithRules("something nice, haircut 300", TODAY);
    expect(items).toEqual([
      { description: "Haircut", amount: 300, category_slug: "other", spent_on: TODAY, payment_method: null },
    ]);
  });

  it("returns nothing for text without numbers", () => {
    expect(parseExpensesWithRules("coffee with friends", TODAY).items).toEqual([]);
  });
});
