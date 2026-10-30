import type { Category, CategorySlug, ExpenseSettings } from "../types";

/** The 8 categories the signup trigger seeds (docs/PORTAL_SPEC.md → Database schema). */
export const DEFAULT_CATEGORIES: Category[] = [
  { id: "cat-food", slug: "food", label: "Food", color: "#2F5BFF", is_fixed: false, monthly_budget: 7000, sort_order: 1, archived: false },
  { id: "cat-transport", slug: "transport", label: "Transport", color: "#E0661F", is_fixed: false, monthly_budget: 3500, sort_order: 2, archived: false },
  { id: "cat-living", slug: "living", label: "Living expenses", color: "#111418", is_fixed: true, monthly_budget: 12000, sort_order: 3, archived: false },
  { id: "cat-gifts", slug: "gifts", label: "Gifts", color: "#9B4DCA", is_fixed: false, monthly_budget: 2000, sort_order: 4, archived: false },
  { id: "cat-shopping", slug: "shopping", label: "Shopping", color: "#F2A774", is_fixed: false, monthly_budget: 2000, sort_order: 5, archived: false },
  { id: "cat-subs", slug: "subs", label: "Subscriptions", color: "#7C8594", is_fixed: true, monthly_budget: 2000, sort_order: 6, archived: false },
  { id: "cat-leisure", slug: "leisure", label: "Leisure", color: "#9DB0FF", is_fixed: false, monthly_budget: 2000, sort_order: 7, archived: false },
  { id: "cat-other", slug: "other", label: "Other", color: "#C9CED6", is_fixed: false, monthly_budget: 1000, sort_order: 8, archived: false },
];

export const DEFAULT_CATEGORY_BUDGETS: Record<CategorySlug, number> = {
  food: 7000,
  transport: 3500,
  living: 12000,
  gifts: 2000,
  shopping: 2000,
  subs: 2000,
  leisure: 2000,
  other: 1000,
};

export const DEFAULT_SETTINGS: ExpenseSettings = {
  monthly_budget: 25000,
  default_payment_method: "gcash",
  alert_threshold_pct: 80,
  cycle_start_day: 1,
  ai_insights_enabled: true,
  include_in_digest: true,
  rollover_enabled: false,
};
