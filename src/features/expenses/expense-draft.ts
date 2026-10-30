import { isISODate } from "@/lib/dates";
import { PAYMENT_METHODS, type Category, type Expense, type ISODate, type NewExpense, type PaymentMethod } from "@/lib/types";

/** Form values as typed, before validation. */
export interface ExpenseDraft {
  amount: string;
  category_id: string;
  spent_on: string;
  payment_method: PaymentMethod;
  description: string;
}

export type DraftErrors = Partial<Record<keyof ExpenseDraft, string>>;

export function emptyDraft(today: ISODate, categories: Category[], payment: PaymentMethod, description = ""): ExpenseDraft {
  return {
    amount: "",
    category_id: categories[0]?.id ?? "",
    spent_on: today,
    payment_method: payment,
    description: description.slice(0, 200),
  };
}

export function draftFromExpense(e: Expense): ExpenseDraft {
  return {
    amount: String(e.amount),
    category_id: e.category_id,
    spent_on: e.spent_on,
    payment_method: e.payment_method,
    description: e.description,
  };
}

const AMOUNT = /^\d+(\.\d{1,2})?$/;

export function validateAmount(raw: string): { amount: number | null; error?: string } {
  const cleaned = raw.replace(/[₱,\s]/g, "");
  if (!cleaned) return { amount: null, error: "Enter an amount." };
  if (!AMOUNT.test(cleaned)) return { amount: null, error: "Use a number with up to 2 decimals." };
  const amount = Number(cleaned);
  if (!(amount > 0)) return { amount: null, error: "Amount must be more than ₱0." };
  if (amount >= 1e10) return { amount: null, error: "That amount is too large." };
  return { amount };
}

export function validateDraft(
  draft: ExpenseDraft,
  today: ISODate,
  categories: Category[],
): { errors: DraftErrors; value: Omit<NewExpense, "source"> | null } {
  const errors: DraftErrors = {};
  const { amount, error } = validateAmount(draft.amount);
  if (error) errors.amount = error;
  if (!categories.some((c) => c.id === draft.category_id)) errors.category_id = "Pick a category.";
  if (!isISODate(draft.spent_on)) errors.spent_on = "Pick a date.";
  else if (draft.spent_on > today) errors.spent_on = "Pick today or an earlier date.";
  if (!PAYMENT_METHODS.includes(draft.payment_method)) errors.payment_method = "Pick how you paid.";
  const description = draft.description.trim();
  if (!description) errors.description = "Add a short description.";
  else if (description.length > 200) errors.description = "Keep it under 200 characters.";

  if (Object.keys(errors).length > 0 || amount === null) return { errors, value: null };
  return {
    errors,
    value: {
      amount,
      category_id: draft.category_id,
      spent_on: draft.spent_on,
      payment_method: draft.payment_method,
      description,
    },
  };
}
