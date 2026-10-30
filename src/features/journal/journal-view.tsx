"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { FilterChip } from "@/components/ui/chip";
import { Field, Select, TextArea } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { dayOfMonth, parseISODate, weekdayMon0 } from "@/lib/dates";
import { JOURNAL_PROMPTS } from "@/lib/data/seed";
import { addJournalEntry, usePortalData, useToday } from "@/lib/data/store";
import { WEEKDAYS_LONG, WEEKDAYS_SHORT, longDate } from "@/lib/format";
import { entriesThisWeek, goalsForYear, journalStreak } from "@/lib/portal-summary";
import type { JournalTag } from "@/lib/types";

export const TAGS: { id: JournalTag; label: string; color: string }[] = [
  { id: "win", label: "Win", color: "text-accent-ink" },
  { id: "target", label: "Target", color: "text-warn-ink" },
  { id: "lesson", label: "Lesson", color: "text-muted" },
  { id: "note", label: "Note", color: "text-muted" },
];

export function JournalView() {
  const data = usePortalData();
  const today = useToday();
  const toast = useToast();
  const [body, setBody] = useState("");
  const [tag, setTag] = useState<JournalTag>("win");
  const [goalId, setGoalId] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!data || !today) return <PageSkeleton cards={2} label="Loading journal" />;

  const streak = journalStreak(data.journal, today);
  const week = entriesThisWeek(data.journal, today);
  const goals = goalsForYear(data.goals, parseISODate(today).year);
  const prompt = JOURNAL_PROMPTS[dayOfMonth(today) % JOURNAL_PROMPTS.length];
  const writtenToday = data.journal.filter((e) => e.entry_date === today).length;

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!body.trim()) {
      setError("Write something first.");
      return;
    }
    addJournalEntry({ entry_date: today, prompt, body: body.trim(), tag, goal_id: goalId || null });
    setBody("");
    setError(null);
    toast("Entry saved");
  };

  return (
    <>
      <PageHeader kicker={streak > 0 ? `${streak}-day streak` : "Start a streak today"} title="Journal" />

      <div className="flex flex-wrap items-start gap-6">
        <form
          noValidate
          onSubmit={save}
          aria-label="Today’s entry"
          className="flex min-w-0 flex-[999_1_480px] flex-col gap-4.5 rounded-[16px] border border-line bg-surface p-5 sm:p-7"
        >
          <div>
            <p className="m-0 text-[13px] text-muted">
              {longDate(today)}
              {writtenToday ? ` · ${writtenToday} entr${writtenToday === 1 ? "y" : "ies"} today` : ""}
            </p>
            <p className="mt-1.5 mb-0 font-display text-[22px] leading-snug">{prompt}</p>
          </div>
          <label htmlFor="entry" className="sr-only">
            Journal entry
          </label>
          <TextArea
            id="entry"
            rows={9}
            placeholder="Start writing…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            aria-invalid={!!error || undefined}
            aria-describedby={error ? "entry-error" : undefined}
            className="resize-y"
          />
          {error ? (
            <p id="entry-error" className="-mt-2 mb-0 text-[13px] text-warn-ink">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col gap-2">
            <span id="tag-label" className="text-[13px] font-semibold">
              Tag this entry — Win and Target entries feed your weekly digest
            </span>
            <div role="group" aria-labelledby="tag-label" className="flex flex-wrap gap-2">
              {TAGS.map((t) => (
                <FilterChip key={t.id} size="md" pressed={tag === t.id} onClick={() => setTag(t.id)}>
                  {t.label}
                </FilterChip>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <Field id="link" label="Link to goal" className="flex-[1_1_220px]">
              <Select id="link" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
                <option value="">None</option>
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="submit" variant="primary">
              Save entry
            </Button>
          </div>
          <p className="m-0 text-xs text-muted">Journal text stays private. It’s never sent to AI unless you turn that on.</p>
        </form>

        <aside aria-labelledby="week-title" className="flex min-w-0 flex-[1_1_300px] flex-col gap-3">
          <h2 id="week-title" className="m-0 font-display text-xl font-bold">
            This week
          </h2>
          {week.length === 0 ? (
            <p className="m-0 rounded-[12px] border border-dashed border-line-strong bg-surface p-4 text-sm text-muted">
              Nothing yet this week. Your first entry shows up here.
            </p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {week.map((e) => {
                const t = TAGS.find((x) => x.id === e.tag)!;
                const wd = weekdayMon0(e.entry_date);
                return (
                  <li key={e.id} className="flex flex-col gap-1.5 rounded-[12px] border border-line bg-surface p-4">
                    <div className="flex justify-between gap-2">
                      <span className="text-[13px] text-muted">
                        <abbr title={WEEKDAYS_LONG[wd]} className="no-underline">
                          {e.entry_date === today ? "Today" : WEEKDAYS_SHORT[wd]}
                        </abbr>
                      </span>
                      <span className={`text-xs font-semibold uppercase ${t.color}`}>{t.label}</span>
                    </div>
                    <p className="m-0 text-sm leading-normal">{e.body}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>
    </>
  );
}
