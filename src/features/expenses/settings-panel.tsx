"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dot } from "@/components/ui/dot";
import { Checkbox, Field, Select, TextInput } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { DEFAULT_CATEGORY_BUDGETS, DEFAULT_SETTINGS } from "@/lib/data/defaults";
import { saveExpenseSettings } from "@/lib/data/expense-book";
import { budgetRowForMonth } from "@/lib/expense-stats";
import { groupThousands, monthLong, monthShortYear, peso } from "@/lib/format";
import { monthKeyOf } from "@/lib/dates";
import {
  PAYMENT_LABELS,
  PAYMENT_METHODS,
  type AlertThreshold,
  type BudgetHistoryRow,
  type Category,
  type CategorySlug,
  type ExpenseSettings,
  type ISODate,
  type PaymentMethod,
} from "@/lib/types";

function parseBudget(raw: string, allowEmpty: boolean): { value: number | null; error?: string } {
  const cleaned = raw.replace(/[₱,\s]/g, "");
  if (!cleaned) return allowEmpty ? { value: null } : { value: null, error: "Enter a budget (₱0 for none)." };
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return { value: null, error: "Use a number, e.g. 25,000." };
  return { value: Number(cleaned) };
}

const formatInput = (raw: string) => {
  const { value, error } = parseBudget(raw, true);
  return value === null || error ? raw : groupThousands(value);
};

export function SettingsPanel({
  settings,
  categories,
  history,
  today,
  onClose,
}: {
  settings: ExpenseSettings;
  categories: Category[];
  history: BudgetHistoryRow[];
  today: ISODate;
  onClose: () => void;
}) {
  const toast = useToast();
  const currentMonth = monthKeyOf(today);
  const currentRow = budgetRowForMonth(history, currentMonth);

  const [form, setForm] = useState<ExpenseSettings>(settings);
  const [budget, setBudget] = useState(groupThousands(currentRow?.monthly_budget ?? settings.monthly_budget));
  const [catBudgets, setCatBudgets] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      categories.map((c) => {
        const v = currentRow?.category_budgets[c.slug] ?? c.monthly_budget;
        return [c.slug, v ? groupThousands(v) : ""];
      }),
    ),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const parsedBudget = parseBudget(budget, false).value ?? 0;
  const catTotal = categories.reduce((t, c) => t + (parseBudget(catBudgets[c.slug] ?? "", true).value ?? 0), 0);
  const overTotal = catTotal > parsedBudget;

  const reset = () => {
    setForm({ ...DEFAULT_SETTINGS, cycle_start_day: form.cycle_start_day });
    setBudget(groupThousands(DEFAULT_SETTINGS.monthly_budget));
    setCatBudgets(Object.fromEntries(categories.map((c) => [c.slug, groupThousands(DEFAULT_CATEGORY_BUDGETS[c.slug])])));
    setErrors({});
  };

  const done = async () => {
    if (saving) return;
    const next: Record<string, string> = {};
    const b = parseBudget(budget, false);
    if (b.error) next.budget = b.error;
    const perCategory: Partial<Record<CategorySlug, number>> = {};
    for (const c of categories) {
      const v = parseBudget(catBudgets[c.slug] ?? "", true);
      if (v.error) next[c.slug] = v.error;
      else if (v.value !== null && v.value > 0) perCategory[c.slug] = v.value;
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setSaving(true);
    setSaveError(null);
    const saved = await saveExpenseSettings({ ...form, monthly_budget: b.value ?? 0 }, perCategory);
    setSaving(false);
    if (!saved) {
      setSaveError("Couldn’t save your settings. Try again.");
      return;
    }
    toast("Settings saved");
    onClose();
  };

  const historyRows = [...history].sort((a, b) => b.effective_month.localeCompare(a.effective_month));

  return (
    <section aria-labelledby="settings-title" className="flex flex-col gap-5 rounded-[16px] border-2 border-ink bg-surface p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="settings-title" className="m-0 font-display text-[22px] font-bold">
            Expense settings
          </h2>
          <p className="mt-1 mb-0 text-sm text-muted">
            Changes apply from {monthLong(currentMonth)} onward. Past months keep the budget they had.
          </p>
        </div>
        <Button aria-label="Close settings" onClick={onClose} size="icon">
          ×
        </Button>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        <Field id="set-budget" label="Monthly budget (₱)" error={errors.budget}>
          <TextInput
            id="set-budget"
            inputMode="decimal"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            onBlur={() => setBudget(formatInput(budget))}
            invalid={!!errors.budget}
            className="font-mono"
          />
        </Field>
        <Field id="set-pay" label="Default payment method">
          <Select
            id="set-pay"
            value={form.default_payment_method}
            onChange={(e) => setForm({ ...form, default_payment_method: e.target.value as PaymentMethod })}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_LABELS[m]}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="set-alert" label="Warn me at">
          <Select
            id="set-alert"
            value={form.alert_threshold_pct}
            onChange={(e) => setForm({ ...form, alert_threshold_pct: Number(e.target.value) as AlertThreshold })}
          >
            <option value={80}>80% of budget</option>
            <option value={90}>90% of budget</option>
            <option value={100}>100% of budget</option>
          </Select>
        </Field>
        <Field id="set-cycle" label="Budget month starts" hint="Coming soon — v1 uses calendar months.">
          <Select id="set-cycle" value={form.cycle_start_day} disabled aria-describedby="set-cycle-hint">
            <option value={1}>1st of the month</option>
            <option value={15}>Payday — 15th</option>
            <option value={30}>Payday — 30th</option>
          </Select>
        </Field>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="m-0 text-[15px] font-semibold">Budget history</h3>
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {historyRows.map((h, i) => (
            <li
              key={h.effective_month}
              className={`inline-flex items-center gap-2 rounded-[10px] px-3 py-2 text-[13px] ${i === 0 ? "bg-accent-soft" : "bg-bg"}`}
            >
              <span className="text-muted">From {monthShortYear(monthKeyOf(h.effective_month))}</span>
              <span className="font-mono">{peso(h.monthly_budget)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="m-0 text-[15px] font-semibold">Category budgets</h3>
          <span className={`text-[13px] ${overTotal ? "font-semibold text-warn-ink" : "text-muted"}`}>
            Total {peso(catTotal)} of {peso(parsedBudget)} monthly budget
          </span>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
          {categories.map((c) => (
            <Field key={c.id} id={`cb-${c.slug}`} label={<><Dot color={c.color} />{c.label}</>} error={errors[c.slug]}>
              <TextInput
                id={`cb-${c.slug}`}
                inputMode="decimal"
                placeholder="No limit"
                value={catBudgets[c.slug] ?? ""}
                onChange={(e) => setCatBudgets({ ...catBudgets, [c.slug]: e.target.value })}
                onBlur={() => setCatBudgets((cb) => ({ ...cb, [c.slug]: formatInput(cb[c.slug] ?? "") }))}
                invalid={!!errors[c.slug]}
                className="font-mono"
              />
            </Field>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Checkbox
          label="Show AI insights on this page"
          checked={form.ai_insights_enabled}
          onChange={(e) => setForm({ ...form, ai_insights_enabled: e.target.checked })}
        />
        <Checkbox
          label="Include expenses in the weekly digest email"
          checked={form.include_in_digest}
          onChange={(e) => setForm({ ...form, include_in_digest: e.target.checked })}
        />
        <Checkbox
          label="Roll unused budget into next month"
          checked={form.rollover_enabled}
          onChange={(e) => setForm({ ...form, rollover_enabled: e.target.checked })}
        />
      </div>

      {saveError ? (
        <p role="alert" className="m-0 text-sm text-warn-ink">
          {saveError}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button onClick={reset}>Reset to defaults</Button>
        <Button variant="primary" onClick={done} disabled={saving}>
          {saving ? "Saving…" : "Done"}
        </Button>
      </div>
    </section>
  );
}
