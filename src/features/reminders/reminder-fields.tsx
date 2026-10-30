"use client";

import { FilterChip } from "@/components/ui/chip";
import { Checkbox, Field, Select, TextArea, TextInput } from "@/components/ui/field";
import { addDays } from "@/lib/dates";
import { NOTES_MAX, REPEAT_MAX, TITLE_MAX, type ReminderDraft, type ReminderDraftErrors } from "@/lib/reminders";
import type { ISODate, RepeatUnit } from "@/lib/types";

/** Shortcuts for the due date: these reminders are for weeks from now. */
const QUICK_WEEKS = [3, 6, 10];

const UNITS: { value: RepeatUnit; label: string }[] = [
  { value: "day", label: "days" },
  { value: "week", label: "weeks" },
  { value: "month", label: "months" },
];

export function ReminderFields({
  idPrefix,
  draft,
  errors,
  today,
  onChange,
}: {
  idPrefix: string;
  draft: ReminderDraft;
  errors: ReminderDraftErrors;
  today: ISODate;
  onChange: (next: ReminderDraft) => void;
}) {
  const set = <K extends keyof ReminderDraft>(key: K, value: ReminderDraft[K]) => onChange({ ...draft, [key]: value });
  const id = (name: string) => `${idPrefix}-${name}`;
  return (
    <>
      <Field id={id("title")} label="Remind me to" error={errors.title}>
        <TextInput
          id={id("title")}
          placeholder="e.g. Renew the domain"
          maxLength={TITLE_MAX}
          value={draft.title}
          onChange={(e) => set("title", e.target.value)}
          invalid={!!errors.title}
        />
      </Field>

      <Field id={id("due")} label="Due" error={errors.due_on}>
        <TextInput
          id={id("due")}
          type="date"
          value={draft.due_on}
          onChange={(e) => set("due_on", e.target.value)}
          invalid={!!errors.due_on}
        />
        <div className="flex flex-wrap gap-2 pt-1" role="group" aria-label="Due date shortcuts">
          {QUICK_WEEKS.map((weeks) => {
            const date = addDays(today, weeks * 7);
            return (
              <FilterChip key={weeks} pressed={draft.due_on === date} onClick={() => set("due_on", date)}>
                In {weeks} weeks
              </FilterChip>
            );
          })}
        </div>
      </Field>

      <div className="flex flex-col gap-1.5">
        <Checkbox label="Repeats" checked={draft.repeats} onChange={(e) => set("repeats", e.target.checked)} />
        {draft.repeats ? (
          <Field id={id("every")} label="Every" error={errors.repeat_every}>
            <div className="flex gap-2">
              <TextInput
                id={id("every")}
                inputMode="numeric"
                min={1}
                max={REPEAT_MAX}
                value={draft.repeat_every}
                onChange={(e) => set("repeat_every", e.target.value)}
                invalid={!!errors.repeat_every}
                className="max-w-24 font-mono"
              />
              <Select
                aria-label="Repeat unit"
                value={draft.repeat_unit}
                onChange={(e) => set("repeat_unit", e.target.value as RepeatUnit)}
                className="max-w-36"
              >
                {UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </Select>
            </div>
          </Field>
        ) : null}
      </div>

      <Field id={id("notes")} label="Notes" error={errors.notes} hint="Optional">
        <TextArea
          id={id("notes")}
          rows={2}
          maxLength={NOTES_MAX}
          value={draft.notes}
          onChange={(e) => set("notes", e.target.value)}
        />
      </Field>
    </>
  );
}
