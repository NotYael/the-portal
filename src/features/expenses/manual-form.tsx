"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { addExpenses } from "@/lib/data/expense-book";
import type { Category, ExpenseSettings, ISODate } from "@/lib/types";
import { emptyDraft, validateDraft, type DraftErrors } from "./expense-draft";
import { ExpenseFields } from "./expense-fields";

export function ManualForm({
  categories,
  settings,
  today,
  prefill,
  onDone,
}: {
  categories: Category[];
  settings: ExpenseSettings;
  today: ISODate;
  prefill?: string;
  onDone: () => void;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState(() => emptyDraft(today, categories, settings.default_payment_method, prefill));
  const [errors, setErrors] = useState<DraftErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const { errors, value } = validateDraft(draft, today, categories);
    setErrors(errors);
    if (!value) return;
    setSaving(true);
    setSaveError(null);
    const saved = await addExpenses([{ ...value, source: "manual" }]);
    setSaving(false);
    if (!saved) {
      setSaveError("Couldn’t save the expense. Try again.");
      return;
    }
    toast("Expense saved");
    onDone();
  };

  return (
    <form
      aria-label="Add expense manually"
      noValidate
      onSubmit={onSubmit}
      className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] items-start gap-3 rounded-[16px] border border-line bg-surface p-4 sm:p-6"
    >
      <ExpenseFields idPrefix="manual" draft={draft} errors={errors} categories={categories} today={today} onChange={setDraft} />
      <div className="flex flex-col gap-1.5">
        <span aria-hidden="true" className="hidden text-[13px] font-semibold sm:block">
          &nbsp;
        </span>
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? "Saving…" : "Save expense"}
        </Button>
      </div>
      {saveError ? (
        <p role="alert" className="col-span-full m-0 text-sm text-warn-ink">
          {saveError}
        </p>
      ) : null}
    </form>
  );
}
