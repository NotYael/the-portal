"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import {
  COUNTDOWN_TITLE_MAX,
  countdownEnd,
  countdownTitleError,
  elapsedRatio,
  manilaDate,
  shortTimeLeft,
  timeLeft,
  type TimeLeft,
} from "@/lib/countdown";
import { startCountdown, useCountdown } from "@/lib/data/countdown";
import { useNow, useNowSeconds } from "@/lib/data/store";
import { mediumDate, shortDate } from "@/lib/format";
import { COUNTDOWN_MONTHS, type Countdown, type CountdownMonths } from "@/lib/types";

const panel = "flex flex-col gap-5 rounded-[16px] bg-panel px-4 py-6 text-white sm:px-8 sm:py-8";
const eyebrow = "m-0 text-[13px] font-semibold uppercase tracking-wide text-dark-muted";
/** A finished countdown stays in the sidebar this long, then only Home shows it. */
const SIDEBAR_DONE_DAYS = 7;

/** Big countdown for Home: running, finished, or the form to start one. */
export function CountdownHero() {
  const { loaded, countdown, error } = useCountdown();
  const now = useNowSeconds();
  /** The finished countdown whose "Start a new countdown" was pressed. */
  const [replacing, setReplacing] = useState<string | null>(null);

  if (!loaded || now === null) return <div aria-hidden="true" className="h-[260px] animate-pulse rounded-[16px] bg-panel" />;
  if (error && !countdown) {
    return (
      <p role="alert" className="m-0 rounded-[12px] bg-warn-soft px-4 py-3 text-sm text-warn-ink">
        {error}
      </p>
    );
  }
  if (countdown && !timeLeft(countdown.ends_at, now).done) return <Running countdown={countdown} now={now} />;
  if (countdown && replacing !== countdown.id) return <Finished countdown={countdown} onStartNew={() => setReplacing(countdown.id)} />;
  return <StartForm now={now} onCancel={countdown ? () => setReplacing(null) : undefined} />;
}

/** Days / hours / min / sec boxes. Decorative: callers give screen readers the value in words. */
function DigitBoxes({ left, size }: { left: TimeLeft; size: "hero" | "preview" }) {
  const units = [
    { value: left.days, label: left.days === 1 ? "day" : "days" },
    { value: left.hours, label: "hours" },
    { value: left.minutes, label: "min" },
    { value: left.seconds, label: "sec" },
  ];
  return (
    <div aria-hidden="true" className={`grid grid-cols-4 ${size === "hero" ? "gap-2 sm:gap-4" : "gap-2 xl:gap-3"}`}>
      {units.map((u) => (
        <div
          key={u.label}
          className={`flex flex-col items-center gap-1 rounded-[12px] bg-dark-raised px-1 ${size === "hero" ? "py-3 sm:py-5" : "py-3 xl:py-4"}`}
        >
          <span
            className={`font-mono leading-none tabular-nums ${size === "hero" ? "text-[34px] sm:text-6xl lg:text-7xl" : "text-4xl xl:text-5xl"}`}
          >
            {String(u.value).padStart(2, "0")}
          </span>
          <span className="text-xs text-dark-muted sm:text-sm">{u.label}</span>
        </div>
      ))}
    </div>
  );
}

function Running({ countdown, now }: { countdown: Countdown; now: number }) {
  const left = timeLeft(countdown.ends_at, now);
  const ratio = elapsedRatio(countdown.started_at, countdown.ends_at, now);
  return (
    <section aria-labelledby="countdown-title" className={panel}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="flex min-w-0 flex-col gap-1">
          <p className={eyebrow}>{countdown.months}-month countdown · can’t be stopped</p>
          <h2 id="countdown-title" className="m-0 font-display text-2xl font-bold break-words sm:text-3xl">
            {countdown.title}
          </h2>
        </div>
        <p className="m-0 text-sm text-dark-muted">Ends {mediumDate(manilaDate(countdown.ends_at))}</p>
      </div>

      <div role="timer">
        <span className="sr-only">
          {left.days} days, {left.hours} hours and {left.minutes} minutes left
        </span>
        <DigitBoxes left={left} size="hero" />
      </div>

      <div className="flex flex-col gap-2">
        <ProgressBar ratio={ratio} height={8} track="var(--dark-line)" />
        <div className="flex flex-wrap justify-between gap-2 text-[13px] text-dark-muted">
          <span>Started {shortDate(manilaDate(countdown.started_at))}</span>
          <span>{Math.floor(ratio * 100)}% of the way</span>
        </div>
      </div>
    </section>
  );
}

function Finished({ countdown, onStartNew }: { countdown: Countdown; onStartNew: () => void }) {
  return (
    <section aria-labelledby="countdown-title" className={panel}>
      <div className="flex flex-col gap-1">
        <p className={eyebrow}>Countdown finished</p>
        <h2 id="countdown-title" className="m-0 font-display text-2xl font-bold break-words sm:text-3xl">
          {countdown.title} — done
        </h2>
        <p className="m-0 text-sm text-dark-muted">
          {countdown.months} month{countdown.months === 1 ? "" : "s"}, {mediumDate(manilaDate(countdown.started_at))} to{" "}
          {mediumDate(manilaDate(countdown.ends_at))}
        </p>
      </div>
      <ProgressBar ratio={1} height={8} track="var(--dark-line)" />
      <div>
        <Button variant="light" onClick={onStartNew}>
          Start a new countdown
        </Button>
      </div>
    </section>
  );
}

function StartForm({ now, onCancel }: { now: number; onCancel?: () => void }) {
  const [title, setTitle] = useState("");
  const [months, setMonths] = useState<CountdownMonths>(3);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endOf = (m: CountdownMonths) => countdownEnd(new Date(now), m).toISOString();
  const endsOn = mediumDate(manilaDate(endOf(months)));

  const review = (event: FormEvent) => {
    event.preventDefault();
    const problem = countdownTitleError(title);
    setTitleError(problem);
    if (!problem) setConfirming(true);
  };

  const start = async () => {
    setSaving(true);
    setError(null);
    const result = await startCountdown(title.trim(), months);
    setSaving(false);
    // On success (or another tab already started one) the hero switches to the running view.
    if (result === "failed") setError("Couldn’t start it. Nothing was started, so try again.");
  };

  return (
    <section aria-labelledby="countdown-title" className={panel}>
      <div className="grid gap-6 lg:grid-cols-2 lg:gap-10">
        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h2 id="countdown-title" className="m-0 font-display text-2xl font-bold sm:text-3xl">
              Start a countdown
            </h2>
            <p className="m-0 text-sm text-dark-muted">1, 3 or 6 months. Once it starts, it can’t be stopped, paused or changed.</p>
          </div>

          {confirming ? (
            <div className="flex flex-col gap-4 rounded-[12px] border border-dark-line bg-dark-raised p-4">
              <p className="m-0 text-[15px]">
                Start <strong className="break-words">“{title.trim()}”</strong> for {months} month{months === 1 ? "" : "s"}, ending {endsOn}? There’s
                no way to stop it once it starts.
              </p>
              {error ? (
                <p role="alert" className="m-0 text-sm text-[#FFB98A]">
                  {error}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button variant="light" onClick={start} disabled={saving}>
                  {saving ? "Starting…" : "Yes, start it"}
                </Button>
                <Button variant="outline-dark" onClick={() => setConfirming(false)} disabled={saving}>
                  Go back
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={review} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="countdown-name" className="text-[13px] font-semibold">
                  What’s it for?
                </label>
                <input
                  id="countdown-name"
                  value={title}
                  maxLength={COUNTDOWN_TITLE_MAX}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setTitleError(null);
                  }}
                  placeholder="No-spend run"
                  aria-invalid={!!titleError || undefined}
                  aria-describedby={titleError ? "countdown-name-error" : undefined}
                  className="h-12 w-full min-w-0 rounded-[10px] border border-dark-line bg-dark-raised px-3.5 text-[15px] text-white placeholder:text-dark-muted aria-invalid:border-warn"
                />
                {titleError ? (
                  <p id="countdown-name-error" className="m-0 text-[13px] text-[#FFB98A]">
                    {titleError}
                  </p>
                ) : null}
              </div>

              <fieldset className="m-0 flex flex-col border-0 p-0">
                <legend className="mb-1.5 p-0 text-[13px] font-semibold">How long</legend>
                <div className="grid grid-cols-3 gap-2">
                  {COUNTDOWN_MONTHS.map((m) => {
                    const picked = months === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        aria-pressed={picked}
                        onClick={() => setMonths(m)}
                        className={[
                          "flex min-w-0 cursor-pointer flex-col items-start gap-1 rounded-[12px] border px-3 py-3 text-left transition-colors sm:px-4",
                          picked ? "border-white bg-white text-panel" : "border-dark-line bg-transparent text-white hover:bg-dark-raised",
                        ].join(" ")}
                      >
                        <span className="flex items-baseline gap-1.5">
                          <span className="font-mono text-2xl leading-none sm:text-3xl">{m}</span>
                          <span className="text-sm font-semibold">month{m === 1 ? "" : "s"}</span>
                        </span>
                        <span className={`text-xs ${picked ? "opacity-70" : "text-dark-muted"}`}>ends {shortDate(manilaDate(endOf(m)))}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="primary" size="lg">
                  Start countdown
                </Button>
                {onCancel ? (
                  <Button variant="outline-dark" size="lg" onClick={onCancel}>
                    Cancel
                  </Button>
                ) : null}
              </div>
            </form>
          )}
        </div>

        <Preview title={title.trim()} months={months} startedAt={new Date(now).toISOString()} endsAt={endOf(months)} now={now} />
      </div>
    </section>
  );
}

/** What the countdown will look like once started; desktop only, where the form leaves room beside it. */
function Preview({ title, months, startedAt, endsAt, now }: { title: string; months: CountdownMonths; startedAt: string; endsAt: string; now: number }) {
  return (
    <div aria-hidden="true" className="hidden min-w-0 flex-col justify-center gap-5 rounded-[14px] border border-dashed border-dark-line p-6 lg:flex">
      <div className="flex min-w-0 flex-col gap-1">
        <p className={eyebrow}>Preview · {months}-month countdown</p>
        <p className={`m-0 truncate font-display text-2xl font-bold ${title ? "" : "text-dark-muted"}`}>{title || "Your countdown"}</p>
      </div>
      <DigitBoxes left={timeLeft(endsAt, now)} size="preview" />
      <div className="flex flex-col gap-2">
        <ProgressBar ratio={0} height={8} track="var(--dark-line)" />
        <div className="flex justify-between gap-2 text-[13px] text-dark-muted">
          <span>Starts {shortDate(manilaDate(startedAt))}</span>
          <span>Ends {mediumDate(manilaDate(endsAt))}</span>
        </div>
      </div>
    </div>
  );
}

/** Small countdown for the sidebar on every page but Home; nothing when there's none to show. */
export function CountdownCompact() {
  const { countdown } = useCountdown();
  const now = useNow();
  if (!countdown || now === null) return null;
  const ended = new Date(countdown.ends_at).getTime();
  if (now - ended > SIDEBAR_DONE_DAYS * 86_400_000) return null;
  const done = now >= ended;
  return (
    <Link
      href="/"
      className="mb-2 flex flex-col gap-2 rounded-[12px] bg-panel px-3 py-2.5 text-white no-underline hover:text-white hover:opacity-90 min-[780px]:mb-4"
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-[13px] font-semibold">{countdown.title}</span>
        <span className="font-mono text-xs text-dark-muted">{shortTimeLeft(countdown.ends_at, now)}</span>
      </span>
      <ProgressBar ratio={done ? 1 : elapsedRatio(countdown.started_at, countdown.ends_at, now)} height={4} track="var(--dark-line)" />
    </Link>
  );
}
