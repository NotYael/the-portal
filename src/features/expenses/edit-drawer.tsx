"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { deleteExpense, updateExpense } from "@/lib/data/expense-book";
import { mediumDate } from "@/lib/format";
import type { Category, Expense, ISODate } from "@/lib/types";
import { draftFromExpense, validateDraft, type DraftErrors, type ExpenseDraft } from "./expense-draft";
import { ExpenseFields } from "./expense-fields";

/** Right-hand drawer (a modal <dialog>) with every field editable. */
export function EditDrawer({
  expense,
  categories,
  today,
  onClose,
}: {
  expense: Expense | null;
  categories: Category[];
  today: ISODate;
  onClose: () => void;
}) {
  const toast = useToast();
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<ExpenseDraft | null>(null);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [openedFor, setOpenedFor] = useState<string | null>(null);

  // Reset the form whenever a different expense opens.
  if (expense && expense.id !== openedFor) {
    setOpenedFor(expense.id);
    setDraft(draftFromExpense(expense));
    setErrors({});
    setConfirming(false);
    setSaveError(null);
  }

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (expense && !el.open) el.showModal();
    if (!expense && el.open) el.close();
  }, [expense]);

  const close = () => {
    setOpenedFor(null);
    onClose();
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!expense || !draft || busy) return;
    const { errors, value } = validateDraft(draft, today, categories);
    setErrors(errors);
    if (!value) return;
    setBusy(true);
    setSaveError(null);
    const saved = await updateExpense(expense.id, value);
    setBusy(false);
    if (!saved) {
      setSaveError("Couldn’t save your changes. Try again.");
      return;
    }
    toast("Expense updated");
    close();
  };

  const remove = async () => {
    if (!expense || busy) return;
    setBusy(true);
    setSaveError(null);
    const deleted = await deleteExpense(expense.id);
    setBusy(false);
    if (!deleted) {
      setSaveError("Couldn’t delete the expense. Try again.");
      return;
    }
    toast("Expense deleted");
    close();
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby="edit-title"
      onClose={close}
      onClick={(e) => {
        if (e.target === dialog.current) close();
      }}
      className="m-0 ml-auto h-dvh max-h-dvh w-full max-w-[440px] bg-surface p-0 text-ink shadow-2xl"
    >
      {expense && draft ? (
        <form noValidate onSubmit={save} className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-line px-6 py-5">
            <div>
              <h2 id="edit-title" className="m-0 font-display text-[22px] font-bold">
                Edit expense
              </h2>
              <p className="mt-1 mb-0 text-[13px] text-muted">
                Added {mediumDate(expense.created_at.slice(0, 10))}
                {expense.source === "ai" ? " with quick add" : ""}
              </p>
            </div>
            <Button aria-label="Close" onClick={close} size="icon">
              ×
            </Button>
          </div>

          <div className="flex grow flex-col gap-4 overflow-y-auto px-6 py-5">
            <ExpenseFields idPrefix="edit" draft={draft} errors={errors} categories={categories} today={today} onChange={setDraft} />
          </div>

          <div className="flex flex-col gap-3 border-t border-line px-6 py-4">
            {saveError ? (
              <p role="alert" className="m-0 text-sm text-warn-ink">
                {saveError}
              </p>
            ) : null}
            {confirming ? (
              <div role="alert" className="flex flex-col gap-3 rounded-[12px] bg-warn-soft p-4">
                <p className="m-0 text-sm font-medium text-warn-ink">Delete this expense? This can’t be undone.</p>
                <div className="flex justify-end gap-2">
                  {/* Keeps focus inside the drawer when the confirm step replaces the Delete button. */}
                  <Button autoFocus onClick={() => setConfirming(false)}>
                    Cancel
                  </Button>
                  <Button variant="danger" onClick={remove} disabled={busy}>
                    {busy ? "Deleting…" : "Delete"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-between gap-2">
                <Button variant="danger-outline" onClick={() => setConfirming(true)}>
                  Delete
                </Button>
                <Button type="submit" variant="primary" disabled={busy}>
                  {busy ? "Saving…" : "Save changes"}
                </Button>
              </div>
            )}
          </div>
        </form>
      ) : null}
    </dialog>
  );
}
