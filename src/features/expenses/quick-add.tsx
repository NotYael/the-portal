"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dot } from "@/components/ui/dot";
import { useToast } from "@/components/ui/toast";
import { addExpenses } from "@/lib/data/store";
import { MAX_PARSE_LENGTH } from "@/lib/expense-parser";
import type { Category, ExpenseSettings, ISODate } from "@/lib/types";
import { parseQuickAdd } from "./ai-client";
import { validateDraft, type DraftErrors, type ExpenseDraft } from "./expense-draft";

const darkControl =
  "h-10 min-w-0 rounded-lg border border-dark-line bg-panel px-2.5 text-sm text-white aria-invalid:border-warn";

interface PreviewRow extends ExpenseDraft {
  key: number;
  errors: DraftErrors;
}

/**
 * Type it like a text and get one editable row per expense. Gemini splits and
 * categorizes it (POST /api/expenses/parse); the rule parser takes over when
 * AI isn't available.
 */
export function QuickAdd({
  categories,
  settings,
  today,
  onParseFailed,
}: {
  categories: Category[];
  settings: ExpenseSettings;
  today: ISODate;
  /** Opens the manual form with the text; without it (e.g. on Home) only a hint shows. */
  onParseFailed?: (text: string) => void;
}) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  /** How the preview was made: by AI, or by the rules with the reason AI wasn't used. */
  const [parsedBy, setParsedBy] = useState<{ ai: boolean; notice: string | null }>({ ai: false, notice: null });

  const bySlug = new Map(categories.map((c) => [c.slug, c]));
  const byId = new Map(categories.map((c) => [c.id, c]));

  const parse = async (event: FormEvent) => {
    event.preventDefault();
    if (!text.trim()) {
      setError("Type what you spent, e.g. “grab to ATC 186, coffee 140”.");
      return;
    }
    setParsing(true);
    setError(null);
    const { items, source, notice } = await parseQuickAdd(text, today);
    setParsing(false);
    if (items.length === 0) {
      setRows(null);
      setError(
        onParseFailed
          ? "Couldn’t find an amount in that — finish it in the form below."
          : "Couldn’t find an amount in that. Add one, e.g. “coffee 140”.",
      );
      onParseFailed?.(text);
      return;
    }
    setParsedBy({ ai: source === "ai", notice });
    setRows(
      items.map((item, key) => ({
        key,
        amount: String(item.amount),
        category_id: (bySlug.get(item.category_slug) ?? bySlug.get("other") ?? categories[0]).id,
        spent_on: item.spent_on,
        payment_method: item.payment_method ?? settings.default_payment_method,
        description: item.description,
        errors: {},
      })),
    );
  };

  const updateRow = (key: number, patch: Partial<ExpenseDraft>) =>
    setRows((list) => list?.map((r) => (r.key === key ? { ...r, ...patch, errors: {} } : r)) ?? null);

  const removeRow = (key: number) =>
    setRows((list) => {
      const next = list?.filter((r) => r.key !== key) ?? null;
      return next && next.length ? next : null;
    });

  const save = () => {
    if (!rows) return;
    const checked = rows.map((r) => ({ row: r, ...validateDraft(r, today, categories) }));
    if (checked.some((c) => !c.value)) {
      setRows(checked.map((c) => ({ ...c.row, errors: c.errors })));
      return;
    }
    addExpenses(checked.map((c) => ({ ...c.value!, source: parsedBy.ai ? ("ai" as const) : ("manual" as const) })));
    toast(`Saved ${rows.length} expense${rows.length === 1 ? "" : "s"}`);
    setRows(null);
    setText("");
  };

  return (
    <section aria-labelledby="quick-add-title" className="flex flex-col gap-3 rounded-[16px] bg-panel px-4 py-5 text-white sm:px-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="quick-add-title" className="m-0 font-display text-lg font-bold">
          Quick add
        </h2>
        <span className="text-[13px] text-dark-muted">Type it like a text — it splits and categorizes by nature of purchase</span>
      </div>
      <form onSubmit={parse} className="flex flex-wrap gap-2">
        <label htmlFor="quick" className="sr-only">
          Describe your expenses
        </label>
        <input
          id="quick"
          type="text"
          maxLength={MAX_PARSE_LENGTH}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="grab to ATC 186, coffee 140, gift for mama 1,500"
          className="h-12 min-w-0 flex-[1_1_320px] rounded-[10px] border border-dark-line bg-dark-raised px-3.5 text-[15px] text-white placeholder:text-dark-muted"
        />
        <Button type="submit" variant="primary" size="lg" disabled={parsing}>
          {parsing ? "Parsing…" : "Parse"}
        </Button>
      </form>
      {error ? (
        <p role="alert" className="m-0 text-sm text-[#FFB98A]">
          {error}
        </p>
      ) : null}

      {rows ? (
        <div className="flex flex-col gap-2">
          <p className="m-0 text-[13px] text-dark-muted">
            {parsedBy.ai
              ? "Parsed by Gemini — check the rows before saving."
              : `Parsed without AI${parsedBy.notice ? ` (${parsedBy.notice.replace(/\.$/, "")})` : ""} — check categories before saving.`}
          </p>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {rows.map((r, i) => {
              const cat = byId.get(r.category_id);
              const err = Object.values(r.errors).filter(Boolean).join(" ");
              return (
                <li key={r.key} className="flex flex-col gap-1 rounded-[10px] bg-dark-raised px-3.5 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="sr-only" htmlFor={`qa-desc-${r.key}`}>{`Description ${i + 1}`}</label>
                    <input
                      id={`qa-desc-${r.key}`}
                      value={r.description}
                      maxLength={200}
                      onChange={(e) => updateRow(r.key, { description: e.target.value })}
                      aria-invalid={!!r.errors.description || undefined}
                      className={`${darkControl} flex-[1_1_200px]`}
                    />
                    <span className="inline-flex items-center gap-1.5">
                      {cat ? <Dot color={cat.color} /> : null}
                      <label className="sr-only" htmlFor={`qa-cat-${r.key}`}>{`Category ${i + 1}`}</label>
                      <select
                        id={`qa-cat-${r.key}`}
                        value={r.category_id}
                        onChange={(e) => updateRow(r.key, { category_id: e.target.value })}
                        className={darkControl}
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </span>
                    <label className="sr-only" htmlFor={`qa-date-${r.key}`}>{`Date ${i + 1}`}</label>
                    <input
                      id={`qa-date-${r.key}`}
                      type="date"
                      max={today}
                      value={r.spent_on}
                      onChange={(e) => updateRow(r.key, { spent_on: e.target.value })}
                      aria-invalid={!!r.errors.spent_on || undefined}
                      className={`${darkControl} [color-scheme:dark]`}
                    />
                    <label className="sr-only" htmlFor={`qa-amt-${r.key}`}>{`Amount ${i + 1} in pesos`}</label>
                    <input
                      id={`qa-amt-${r.key}`}
                      inputMode="decimal"
                      value={r.amount}
                      onChange={(e) => updateRow(r.key, { amount: e.target.value })}
                      aria-invalid={!!r.errors.amount || undefined}
                      className={`${darkControl} w-28 text-right font-mono`}
                    />
                    <button
                      type="button"
                      onClick={() => removeRow(r.key)}
                      aria-label={`Remove ${r.description || `row ${i + 1}`}`}
                      className="size-10 cursor-pointer rounded-lg text-xl text-dark-muted hover:bg-panel hover:text-white"
                    >
                      ×
                    </button>
                  </div>
                  {err ? <p className="m-0 text-[13px] text-[#FFB98A]">{err}</p> : null}
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline-dark" onClick={() => setRows(null)}>
              Discard
            </Button>
            <Button variant="light" onClick={save}>
              {`Save ${rows.length} expense${rows.length === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
