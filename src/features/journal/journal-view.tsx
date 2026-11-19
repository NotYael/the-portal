"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { FilterChip } from "@/components/ui/chip";
import { Checkbox, Field, Select, TextArea } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { dayOfMonth, parseISODate, weekdayMon0 } from "@/lib/dates";
import { JOURNAL_PROMPTS } from "@/lib/data/defaults";
import { useGoals } from "@/lib/data/goals";
import { addJournalEntry, useJournal } from "@/lib/data/journal";
import { setJournalAiSummary, useJournalSettings } from "@/lib/data/journal-settings";
import { useToday } from "@/lib/data/store";
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
  const { entries, error: loadError } = useJournal();
  const { goals: allGoals } = useGoals();
  const today = useToday();
  const toast = useToast();
  const [body, setBody] = useState("");
  const [tag, setTag] = useState<JournalTag>("win");
  const [goalId, setGoalId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!entries || !today) {
    if (!loadError) return <PageSkeleton cards={2} label="Loading journal" />;
    return (
      <>
        <PageHeader kicker="Daily entries" title="Journal" />
        <p role="alert" className="m-0 rounded-[12px] bg-warn-soft px-4 py-3 text-sm text-warn-ink">
          {loadError}
        </p>
      </>
    );
  }

  const streak = journalStreak(entries, today);
  const week = entriesThisWeek(entries, today);
  // Linking a goal is optional: if goals can't load, the list just stays empty.
  const goals = goalsForYear(allGoals ?? [], parseISODate(today).year);
  const prompt = JOURNAL_PROMPTS[dayOfMonth(today) % JOURNAL_PROMPTS.length];
  const writtenToday = entries.filter((e) => e.entry_date === today).length;

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (!body.trim()) {
      setError("Write something first.");
      return;
    }
    setSaving(true);
    const saved = await addJournalEntry({ entry_date: today, prompt, body: body.trim(), tag, goal_id: goalId || null });
    setSaving(false);
    if (!saved) {
      setError("Couldn’t save your entry. Try again.");
      return;
    }
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
            maxLength={20000}
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
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? "Saving…" : "Save entry"}
            </Button>
          </div>
          <AiSummarySetting />
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

/** The opt-in for Gemini tidying Win and Target entries in the weekly digest. */
function AiSummarySetting() {
  const { aiSummary, error } = useJournalSettings();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  const toggle = async (enabled: boolean) => {
    setSaving(true);
    const saved = await setJournalAiSummary(enabled);
    setSaving(false);
    toast(saved ? (enabled ? "Gemini will tidy Win and Target entries in the digest" : "Journal text stays out of AI") : "Couldn’t save that. Try again.");
  };

  return (
    <div className="flex flex-col gap-1 border-t border-divider pt-3">
      <Checkbox
        label="Let Gemini tidy this week’s Win and Target entries in the weekly digest"
        checked={aiSummary === true}
        disabled={aiSummary === null || saving}
        onChange={(e) => void toggle(e.target.checked)}
        aria-describedby="ai-summary-hint"
      />
      <p id="ai-summary-hint" className="m-0 text-xs text-muted">
        {error ??
          (aiSummary
            ? "On: only entries tagged Win or Target are sent to Gemini, once a week, to shorten them for the digest."
            : "Off: journal text never leaves the Portal. The digest lists Win and Target entries as you wrote them.")}
      </p>
    </div>
  );
}
