"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/chip";
import { Field, TextArea, TextInput } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress-bar";
import { PageSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { parseISODate } from "@/lib/dates";
import { addGoal, addSubgoal, newSubgoal, removeSubgoal, setSubgoalDone, usePortalData, useToday } from "@/lib/data/store";
import { checklistOrder, subgoalProgress } from "@/lib/goal-progress";
import { daysLeftInYear, goalSummary, goalsForYear } from "@/lib/portal-summary";
import type { Goal, GoalSubgoal, MilestoneState } from "@/lib/types";

const STATUS = {
  on_track: { label: "On track", tone: "accent" as const, bar: "var(--accent)" },
  behind: { label: "Behind", tone: "warn" as const, bar: "var(--warn)" },
  done: { label: "Done", tone: "dark" as const, bar: "var(--ink)" },
};

const MILESTONE: Record<MilestoneState, string> = {
  done: "bg-ink text-on-ink",
  current: "bg-accent-soft text-accent-ink",
  todo: "bg-bg text-muted",
};

export function GoalsView() {
  const data = usePortalData();
  const today = useToday();
  const [year, setYear] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  if (!data || !today) return <PageSkeleton cards={3} label="Loading goals" />;

  const { year: thisYear, month } = parseISODate(today);
  const selected = year ?? thisYear;
  const goals = goalsForYear(data.goals, selected);
  const summary = goalSummary(data.goals, thisYear);
  const quarter = Math.ceil(month / 3);

  const planNextYear = () => {
    setYear(thisYear + 1);
    setFormOpen(true);
  };

  return (
    <>
      <PageHeader
        kicker={selected === thisYear ? "Set in January · reviewed weekly" : "Draft · goes live on 1 January"}
        title={`${selected} Goals`}
        actions={
          <>
            {[thisYear, thisYear + 1].map((y) => (
              <Button key={y} variant={y === selected ? "dark" : "secondary"} aria-pressed={y === selected} onClick={() => setYear(y)}>
                {y === thisYear ? y : `${y} · draft`}
              </Button>
            ))}
            <Button variant="primary" onClick={() => setFormOpen((o) => !o)} aria-expanded={formOpen}>
              {formOpen ? "Close form" : "+ New goal"}
            </Button>
          </>
        }
      />

      {selected === thisYear ? (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-[16px] bg-accent-soft px-4 py-5 sm:px-6">
          <div className="flex-[1_1_360px]">
            <p className="m-0 text-[15px] font-semibold">
              Q{quarter} check-in · {daysLeftInYear(today)} days left in {thisYear}
            </p>
            <p className="mt-1 mb-0 text-sm text-ink-soft">
              {summary.behind.length === 0
                ? "Every goal is on pace."
                : `${summary.behind.length === 1 ? "One goal is" : `${summary.behind.length} goals are`} behind pace.`}
              {quarter === 4 ? ` Drafting your ${thisYear + 1} goals now means they’re ready on 1 January.` : ""}
            </p>
          </div>
          {quarter === 4 ? (
            <Button onClick={planNextYear}>
              Start {thisYear + 1} planning
            </Button>
          ) : null}
        </section>
      ) : null}

      {formOpen ? <NewGoalForm year={selected} onDone={() => setFormOpen(false)} /> : null}

      {goals.length === 0 ? (
        <section className="flex flex-col items-center gap-3 rounded-[16px] border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
          <h2 className="m-0 font-display text-[22px] font-bold">No {selected} goals yet</h2>
          <p className="m-0 text-[15px] text-muted">Add up to six. Each gets four quarterly milestones and its own sub-goals.</p>
          {!formOpen ? (
            <Button variant="primary" onClick={() => setFormOpen(true)}>
              + New goal
            </Button>
          ) : null}
        </section>
      ) : (
        // Cards in a row share one height and their sections line up: each card
        // spans six rows of this grid through subgrid (see GoalCard).
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(340px,100%),1fr))] gap-4">
          {goals.map((g) => (
            <GoalCard key={g.id} goal={g} />
          ))}
        </div>
      )}
    </>
  );
}

/** Sub-goals a card shows; the rest open in a dialog, so cards keep one height. */
const VISIBLE_SUBGOALS = 4;

function GoalCard({ goal }: { goal: Goal }) {
  const status = STATUS[goal.status];
  const { done, total } = subgoalProgress(goal.subgoals);
  return (
    // Six rows shared with the cards beside it: header, title, progress, milestones, checklist, add box.
    <article className="row-span-6 grid grid-rows-[subgrid] gap-y-3.5 rounded-[16px] border border-line bg-surface p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold tracking-[0.06em] text-muted uppercase">{goal.area}</span>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <h2 className="m-0 font-display text-xl leading-tight font-bold">{goal.title}</h2>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-3">
          <ProgressBar ratio={goal.progress_pct / 100} height={8} color={status.bar} />
          <span className="font-mono text-sm">{goal.progress_pct}%</span>
        </div>
        <p className="m-0 text-[13px] text-muted">
          {total ? `${done} of ${total} sub-goal${total === 1 ? "" : "s"} done` : "Add sub-goals below to track progress."}
        </p>
      </div>
      <ol className="m-0 grid list-none grid-cols-4 gap-1.5 p-0" aria-label="Quarterly milestones">
        {goal.milestones.map((m) => (
          <li key={m.quarter} className={`flex flex-col gap-0.5 rounded-lg p-2 ${MILESTONE[m.state]}`}>
            <span className="text-[11px] font-semibold">Q{m.quarter}</span>
            <span className="text-xs leading-tight">{m.label}</span>
            <span className="sr-only">{m.state === "done" ? "done" : m.state === "current" ? "in progress" : "to do"}</span>
          </li>
        ))}
      </ol>
      <SubgoalPreview goal={goal} />
      <div className="flex flex-col gap-2">
        <AddSubgoal goal={goal} idPrefix="subgoal" inCard />
        {goal.next_step ? <p className="m-0 text-[13px] text-muted">Next: {goal.next_step}</p> : null}
      </div>
    </article>
  );
}

/** The card's checklist: open sub-goals first, the first four of them, and "Show all" for the rest. */
function SubgoalPreview({ goal }: { goal: Goal }) {
  const [showAll, setShowAll] = useState(false);
  const ordered = checklistOrder(goal.subgoals);
  return (
    <section aria-label={`Sub-goals for ${goal.title}`} className="flex flex-col border-t border-divider pt-2">
      {ordered.length ? (
        <Checklist goal={goal} items={ordered.slice(0, VISIBLE_SUBGOALS)} />
      ) : (
        <p className="m-0 py-2 text-[13px] text-muted">No sub-goals yet. Add the first one below.</p>
      )}
      {ordered.length > VISIBLE_SUBGOALS ? (
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => setShowAll(true)}
          className="min-h-10 cursor-pointer self-start rounded-lg px-1 text-[13px] font-semibold text-accent hover:underline"
        >
          Show all {ordered.length}
        </button>
      ) : null}
      {showAll ? <SubgoalDialog goal={goal} onClose={() => setShowAll(false)} /> : null}
    </section>
  );
}

/** Every sub-goal of one goal, to tick, remove and add without changing the size of its card. */
function SubgoalDialog({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { done, total } = subgoalProgress(goal.subgoals);
  const titleId = `subgoal-dialog-${goal.id}`;

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) dialog.current.close();
      }}
      className="m-auto w-[calc(100%-32px)] max-w-[520px] rounded-[16px] bg-surface p-0 text-ink shadow-2xl"
    >
      <div className="flex max-h-[85dvh] flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-divider px-5 pt-5 pb-4">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-xs font-semibold tracking-[0.06em] text-muted uppercase">{goal.area}</span>
            <h2 id={titleId} className="m-0 font-display text-xl leading-tight font-bold">
              {goal.title}
            </h2>
            <p className="m-0 text-[13px] text-muted">
              {done} of {total} sub-goals done · {goal.progress_pct}%
            </p>
          </div>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label="Close"
            className="size-10 shrink-0 cursor-pointer rounded-lg text-xl text-muted hover:bg-subtle hover:text-ink"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto px-5 py-2">
          <Checklist goal={goal} items={checklistOrder(goal.subgoals)} />
        </div>
        <div className="border-t border-divider px-5 pt-3 pb-5">
          <AddSubgoal goal={goal} idPrefix="subgoal-dialog-add" />
        </div>
      </div>
    </dialog>
  );
}

/** Rows with a checkbox and a remove button. Ticking moves a row down, so keyboard focus stays on the row that takes its place. */
function Checklist({ goal, items }: { goal: Goal; items: GoalSubgoal[] }) {
  const toast = useToast();
  const list = useRef<HTMLUListElement>(null);

  const toggle = (id: string, done: boolean, index: number) => {
    const hadFocus = list.current?.contains(document.activeElement) ?? false;
    setSubgoalDone(goal.id, id, done);
    const remaining = goal.subgoals.filter((s) => !s.done && s.id !== id).length;
    if (done && remaining === 0) toast(`“${goal.title}” is done: every sub-goal is ticked`);
    if (hadFocus) {
      requestAnimationFrame(() => {
        if (list.current?.contains(document.activeElement)) return;
        const boxes = list.current?.querySelectorAll<HTMLInputElement>("input[type=checkbox]");
        boxes?.[Math.min(index, boxes.length - 1)]?.focus();
      });
    }
  };

  return (
    <ul ref={list} className="m-0 flex list-none flex-col p-0">
      {items.map((s, index) => (
        <li key={s.id} className="flex items-center gap-1">
          <label className="flex min-h-10 min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              className="size-[18px] shrink-0 accent-accent"
              checked={s.done}
              onChange={(e) => toggle(s.id, e.target.checked, index)}
            />
            <span className={s.done ? "text-muted line-through" : undefined}>{s.title}</span>
          </label>
          <button
            type="button"
            onClick={() => removeSubgoal(goal.id, s.id)}
            aria-label={`Remove sub-goal: ${s.title}`}
            title="Remove"
            className="size-10 shrink-0 cursor-pointer rounded-lg text-lg text-muted hover:bg-subtle hover:text-ink"
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Adds a sub-goal at the end of the open ones. On a card, says so when it lands past the four shown. */
function AddSubgoal({ goal, idPrefix, inCard = false }: { goal: Goal; idPrefix: string; inCard?: boolean }) {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputId = `${idPrefix}-${goal.id}`;

  const add = (event: FormEvent) => {
    event.preventDefault();
    const clean = title.trim().slice(0, 200);
    if (!clean) return setError("Write the sub-goal first.");
    const open = goal.subgoals.filter((s) => !s.done).length;
    addSubgoal(goal.id, clean);
    if (inCard && open >= VISIBLE_SUBGOALS) toast(`Added “${clean}”. Open “Show all” to see it.`);
    setTitle("");
    setError(null);
  };

  return (
    <form noValidate onSubmit={add} className="flex flex-col gap-1">
      <div className="flex gap-2">
        <label htmlFor={inputId} className="sr-only">
          Add a sub-goal to {goal.title}
        </label>
        <TextInput
          id={inputId}
          placeholder="Add a sub-goal"
          maxLength={200}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (error) setError(null);
          }}
          invalid={!!error}
        />
        <Button type="submit">Add</Button>
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="m-0 text-[13px] text-warn-ink">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function NewGoalForm({ year, onDone }: { year: number; onDone: () => void }) {
  const toast = useToast();
  const [area, setArea] = useState("");
  const [title, setTitle] = useState("");
  const [next, setNext] = useState("");
  const [subgoals, setSubgoals] = useState("");
  const [milestones, setMilestones] = useState(["", "", "", ""]);
  const [errors, setErrors] = useState<{ area?: string; title?: string }>({});

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const e: typeof errors = {};
    if (!area.trim()) e.area = "Name the area, e.g. Career.";
    if (!title.trim()) e.title = "Write the goal.";
    setErrors(e);
    if (Object.keys(e).length) return;
    addGoal({
      year,
      area: area.trim(),
      title: title.trim(),
      progress_pct: 0,
      status: "on_track",
      next_step: next.trim(),
      milestones: milestones.map((label, i) => ({
        quarter: (i + 1) as 1 | 2 | 3 | 4,
        label: label.trim() || "—",
        state: "todo" as const,
      })),
      subgoals: subgoals
        .split("\n")
        .map((line) => line.replace(/^\s*[-•*]\s*/, "").trim())
        .filter(Boolean)
        .map((line) => newSubgoal(line.slice(0, 200))),
    });
    toast(`Goal added to ${year}`);
    onDone();
  };

  return (
    <form noValidate onSubmit={submit} aria-label="New goal" className="flex flex-col gap-4 rounded-[16px] border border-line bg-surface p-4 sm:p-6">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <Field id="goal-area" label="Area" error={errors.area}>
          <TextInput id="goal-area" placeholder="Career" value={area} onChange={(e) => setArea(e.target.value)} invalid={!!errors.area} />
        </Field>
        <Field id="goal-title" label="Goal" error={errors.title} className="sm:col-span-2">
          <TextInput id="goal-title" placeholder="Land a SWE role" value={title} onChange={(e) => setTitle(e.target.value)} invalid={!!errors.title} />
        </Field>
        <Field id="goal-next" label="Next step">
          <TextInput id="goal-next" placeholder="Optional" value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
      </div>
      <Field
        id="goal-subgoals"
        label="Sub-goals"
        hint="One per line. The goal’s progress is how many you’ve ticked off; you can add more later."
      >
        <TextArea
          id="goal-subgoals"
          rows={4}
          placeholder={"Polish resume\nApply to 30 roles\nPass 2 mock interviews"}
          value={subgoals}
          onChange={(e) => setSubgoals(e.target.value)}
          aria-describedby="goal-subgoals-hint"
        />
      </Field>
      <fieldset className="m-0 grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3 border-0 p-0">
        <legend className="mb-2 p-0 text-[13px] font-semibold">Quarterly milestones</legend>
        {milestones.map((m, i) => (
          <Field key={i} id={`goal-q${i + 1}`} label={`Q${i + 1}`}>
            <TextInput
              id={`goal-q${i + 1}`}
              placeholder="Optional"
              value={m}
              onChange={(e) => setMilestones(milestones.map((x, j) => (j === i ? e.target.value : x)))}
            />
          </Field>
        ))}
      </fieldset>
      <div className="flex justify-end gap-2">
        <Button onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary">
          Add goal
        </Button>
      </div>
    </form>
  );
}
