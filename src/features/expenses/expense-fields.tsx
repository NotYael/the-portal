"use client";

import { Field, Select, TextInput } from "@/components/ui/field";
import { PAYMENT_LABELS, PAYMENT_METHODS, type Category, type ISODate, type PaymentMethod } from "@/lib/types";
import type { DraftErrors, ExpenseDraft } from "./expense-draft";

export function ExpenseFields({
  idPrefix,
  draft,
  errors,
  categories,
  today,
  onChange,
}: {
  idPrefix: string;
  draft: ExpenseDraft;
  errors: DraftErrors;
  categories: Category[];
  today: ISODate;
  onChange: (next: ExpenseDraft) => void;
}) {
  const set = <K extends keyof ExpenseDraft>(key: K, value: ExpenseDraft[K]) => onChange({ ...draft, [key]: value });
  const id = (name: string) => `${idPrefix}-${name}`;
  return (
    <>
      <Field id={id("amount")} label="Amount (₱)" error={errors.amount}>
        <TextInput
          id={id("amount")}
          inputMode="decimal"
          placeholder="0.00"
          value={draft.amount}
          onChange={(e) => set("amount", e.target.value)}
          invalid={!!errors.amount}
          className="font-mono"
        />
      </Field>
      <Field id={id("category")} label="Category" error={errors.category_id}>
        <Select id={id("category")} value={draft.category_id} onChange={(e) => set("category_id", e.target.value)}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field id={id("date")} label="Date" error={errors.spent_on}>
        <TextInput
          id={id("date")}
          type="date"
          max={today}
          value={draft.spent_on}
          onChange={(e) => set("spent_on", e.target.value)}
          invalid={!!errors.spent_on}
        />
      </Field>
      <Field id={id("pay")} label="Paid with" error={errors.payment_method}>
        <Select id={id("pay")} value={draft.payment_method} onChange={(e) => set("payment_method", e.target.value as PaymentMethod)}>
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {PAYMENT_LABELS[m]}
            </option>
          ))}
        </Select>
      </Field>
      <Field id={id("desc")} label="Description" error={errors.description}>
        <TextInput
          id={id("desc")}
          placeholder="e.g. Lunch with team"
          maxLength={200}
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
          invalid={!!errors.description}
        />
      </Field>
    </>
  );
}
