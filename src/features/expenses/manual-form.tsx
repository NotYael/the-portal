"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { addExpenses } from "@/lib/data/store";
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

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const { errors, value } = validateDraft(draft, today, categories);
    setErrors(errors);
    if (!value) return;
    addExpenses([{ ...value, source: "manual" }]);
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
        <Button type="submit" variant="primary">
          Save expense
        </Button>
      </div>
    </form>
  );
}
