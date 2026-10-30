"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/chip";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { addReminder, completeReminder, undoComplete, updateReminder, useReminders } from "@/lib/data/reminders";
import { useToday } from "@/lib/data/store";
import { todayInManila } from "@/lib/dates";
import { mediumDate } from "@/lib/format";
import {
  dueLabel,
  emptyReminderDraft,
  nextDueOn,
  reminderBuckets,
  repeatLabel,
  validateReminderDraft,
  type ReminderDraft,
  type ReminderDraftErrors,
} from "@/lib/reminders";
import type { ISODate, Reminder } from "@/lib/types";
import { ReminderDrawer } from "./reminder-drawer";
import { ReminderFields } from "./reminder-fields";

/** How many finished one-offs the Done list shows. */
const DONE_SHOWN = 10;

export function RemindersView() {
  const { reminders, error } = useReminders();
  const today = useToday();
  const [editing, setEditing] = useState<Reminder | null>(null);

  if (!today || (!reminders && !error)) return <PageSkeleton cards={3} label="Loading reminders" />;

  const header = <PageHeader kicker="Things to remember weeks from now · listed in the Sunday digest" title="Reminders" />;
  if (!reminders) {
    return (
      <>
        {header}
        <p role="alert" className="m-0 rounded-[12px] bg-warn-soft px-4 py-3 text-sm text-warn-ink">
          {error}
        </p>
      </>
    );
  }

  const buckets = reminderBuckets(reminders, today);
  const open = buckets.overdue.length + buckets.thisWeek.length + buckets.later.length;

  return (
    <>
      {header}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          {open === 0 ? (
            <Card>
              <p className="m-0 text-sm text-muted">Nothing to remember yet. Add the first reminder with the form.</p>
            </Card>
          ) : null}
          <Group title="Overdue" tone="warn" list={buckets.overdue} today={today} onEdit={setEditing} />
          <Group title="Due this week" list={buckets.thisWeek} today={today} onEdit={setEditing} />
          <Group title="Coming up" list={buckets.later} today={today} onEdit={setEditing} />
          <DoneGroup list={buckets.done.slice(0, DONE_SHOWN)} />
        </div>

        <NewReminder today={today} />
      </div>

      <ReminderDrawer reminder={editing} today={today} onClose={() => setEditing(null)} />
    </>
  );
}

function NewReminder({ today }: { today: ISODate }) {
  const toast = useToast();
  const [draft, setDraft] = useState<ReminderDraft>(() => emptyReminderDraft(today));
  const [errors, setErrors] = useState<ReminderDraftErrors>({});
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const { errors, value } = validateReminderDraft(draft);
    setErrors(errors);
    if (!value) return;
    setBusy(true);
    setSaveError(null);
    const saved = await addReminder(value);
    setBusy(false);
    if (!saved) {
      setSaveError("Couldn’t save the reminder. Try again.");
      return;
    }
    toast(`Reminder set for ${mediumDate(value.due_on)}`);
    setDraft(emptyReminderDraft(today));
  };

  return (
    <form noValidate onSubmit={submit} aria-label="New reminder" className="flex min-w-0 flex-col gap-4 rounded-[16px] border border-line bg-surface p-4 sm:p-6">
      <CardHeader title="New reminder" />
      <ReminderFields idPrefix="reminder-new" draft={draft} errors={errors} today={today} onChange={setDraft} />
      {saveError ? (
        <p role="alert" className="m-0 text-sm text-warn-ink">
          {saveError}
        </p>
      ) : null}
      <Button type="submit" variant="primary" disabled={busy}>
        {busy ? "Saving…" : "Add reminder"}
      </Button>
    </form>
  );
}

function Group({
  title,
  tone,
  list,
  today,
  onEdit,
}: {
  title: string;
  tone?: "warn";
  list: Reminder[];
  today: ISODate;
  onEdit: (reminder: Reminder) => void;
}) {
  if (!list.length) return null;
  return (
    <Card gap="gap-1" aria-label={title}>
      <CardHeader title={title} aside={<Badge tone={tone ?? "neutral"}>{list.length}</Badge>} />
      <ul className="m-0 list-none p-0">
        {list.map((r, i) => (
          <ReminderRow key={r.id} reminder={r} today={today} last={i === list.length - 1} onEdit={onEdit} />
        ))}
      </ul>
    </Card>
  );
}

function ReminderRow({ reminder, today, last, onEdit }: { reminder: Reminder; today: ISODate; last: boolean; onEdit: (reminder: Reminder) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const repeat = repeatLabel(reminder);
  const overdue = reminder.due_on < today;

  const done = async () => {
    setBusy(true);
    const next = nextDueOn(reminder, today);
    const saved = await completeReminder(reminder);
    setBusy(false);
    if (!saved) {
      toast("Couldn’t mark it done. Try again.");
      return;
    }
    toast(next ? `Done. Next one is due ${mediumDate(next)}` : `Done: “${reminder.title}”`, {
      label: "Undo",
      onClick: () => void undoComplete(reminder),
    });
  };

  return (
    <li className={`flex flex-wrap items-center justify-between gap-3 py-3 ${last ? "" : "border-b border-divider"}`}>
      <div className="min-w-0 grow basis-60">
        <p className="m-0 text-sm font-medium">{reminder.title}</p>
        <p className="mt-0.5 mb-0 text-[13px] text-muted">
          <span className={overdue ? "font-semibold text-warn-ink" : ""}>{dueLabel(reminder.due_on, today)}</span>
          {" · "}
          {mediumDate(reminder.due_on)}
          {repeat ? ` · ${repeat}` : ""}
        </p>
        {reminder.notes ? <p className="mt-1 mb-0 line-clamp-2 text-[13px] text-ink-soft">{reminder.notes}</p> : null}
      </div>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" onClick={() => onEdit(reminder)} aria-label={`Edit “${reminder.title}”`}>
          Edit
        </Button>
        <Button size="sm" variant="primary" onClick={done} disabled={busy} aria-label={`Mark “${reminder.title}” done`}>
          Done
        </Button>
      </div>
    </li>
  );
}

function DoneGroup({ list }: { list: Reminder[] }) {
  const toast = useToast();
  if (!list.length) return null;

  const restore = async (reminder: Reminder) => {
    const saved = await updateReminder(reminder.id, { done_at: null });
    toast(saved ? `“${reminder.title}” is back on the list` : "Couldn’t restore it. Try again.");
  };

  return (
    <Card gap="gap-1" aria-label="Done">
      <CardHeader title="Done" />
      <ul className="m-0 list-none p-0">
        {list.map((r, i) => (
          <li key={r.id} className={`flex items-center justify-between gap-3 py-3 ${i < list.length - 1 ? "border-b border-divider" : ""}`}>
            <div className="min-w-0">
              <p className="m-0 truncate text-sm text-muted line-through">{r.title}</p>
              <p className="mt-0.5 mb-0 text-[13px] text-muted">Done {mediumDate(todayInManila(new Date(r.done_at!)))}</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => void restore(r)} aria-label={`Restore “${r.title}”`}>
              Restore
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
