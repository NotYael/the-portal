"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { deleteReminder, updateReminder } from "@/lib/data/reminders";
import { mediumDate } from "@/lib/format";
import { draftFromReminder, validateReminderDraft, type ReminderDraft, type ReminderDraftErrors } from "@/lib/reminders";
import type { ISODate, Reminder } from "@/lib/types";
import { ReminderFields } from "./reminder-fields";

/** Right-hand drawer (a modal <dialog>) for editing or deleting a reminder. */
export function ReminderDrawer({ reminder, today, onClose }: { reminder: Reminder | null; today: ISODate; onClose: () => void }) {
  const toast = useToast();
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<ReminderDraft | null>(null);
  const [errors, setErrors] = useState<ReminderDraftErrors>({});
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [openedFor, setOpenedFor] = useState<string | null>(null);

  // Reset the form whenever a different reminder opens.
  if (reminder && reminder.id !== openedFor) {
    setOpenedFor(reminder.id);
    setDraft(draftFromReminder(reminder));
    setErrors({});
    setConfirming(false);
    setSaveError(null);
  }

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (reminder && !el.open) el.showModal();
    if (!reminder && el.open) el.close();
  }, [reminder]);

  const close = () => {
    setOpenedFor(null);
    onClose();
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!reminder || !draft || busy) return;
    const { errors, value } = validateReminderDraft(draft);
    setErrors(errors);
    if (!value) return;
    setBusy(true);
    setSaveError(null);
    // A finished one-off that gets a repeat can't stay done (the table forbids it), so it reopens.
    const saved = await updateReminder(reminder.id, value.repeat_every ? { ...value, done_at: null } : value);
    setBusy(false);
    if (!saved) {
      setSaveError("Couldn’t save your changes. Try again.");
      return;
    }
    toast("Reminder updated");
    close();
  };

  const remove = async () => {
    if (!reminder || busy) return;
    setBusy(true);
    setSaveError(null);
    const deleted = await deleteReminder(reminder.id);
    setBusy(false);
    if (!deleted) {
      setSaveError("Couldn’t delete the reminder. Try again.");
      return;
    }
    toast("Reminder deleted");
    close();
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby="reminder-edit-title"
      onClose={close}
      onClick={(e) => {
        if (e.target === dialog.current) close();
      }}
      className="m-0 ml-auto h-dvh max-h-dvh w-full max-w-[440px] bg-surface p-0 text-ink shadow-2xl"
    >
      {reminder && draft ? (
        <form noValidate onSubmit={save} className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-line px-6 py-5">
            <div>
              <h2 id="reminder-edit-title" className="m-0 font-display text-[22px] font-bold">
                Edit reminder
              </h2>
              <p className="mt-1 mb-0 text-[13px] text-muted">Added {mediumDate(reminder.created_at.slice(0, 10))}</p>
            </div>
            <Button aria-label="Close" onClick={close} size="icon">
              ×
            </Button>
          </div>

          <div className="flex grow flex-col gap-4 overflow-y-auto px-6 py-5">
            <ReminderFields idPrefix="reminder-edit" draft={draft} errors={errors} today={today} onChange={setDraft} />
          </div>

          <div className="flex flex-col gap-3 border-t border-line px-6 py-4">
            {saveError ? (
              <p role="alert" className="m-0 text-sm text-warn-ink">
                {saveError}
              </p>
            ) : null}
            {confirming ? (
              <div role="alert" className="flex flex-col gap-3 rounded-[12px] bg-warn-soft p-4">
                <p className="m-0 text-sm font-medium text-warn-ink">Delete this reminder? This can’t be undone.</p>
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
