"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { askData, CANT_TELL, insightData, MAX_QUESTION_LENGTH } from "@/lib/ai/expense-ai";
import type { MonthInput, MonthStats } from "@/lib/expense-stats";
import { monthLong } from "@/lib/format";
import { maskAmounts } from "@/lib/privacy";
import { useAmountsHidden } from "@/lib/use-amounts-hidden";
import { askAboutSpending, useAiInsights } from "./ai-client";

const REFRESH_COOLDOWN = 60;

/**
 * Gemini insights for the month (from aggregates only) and "Ask". The
 * template insights show until the AI ones arrive, and stay if AI is
 * unavailable.
 */
export function InsightsPanel({ stats, input, templates }: { stats: MonthStats; input: MonthInput; templates: string[] }) {
  const hidden = useAmountsHidden();
  const data = useMemo(() => insightData(stats, input), [stats, input]);
  const ai = useAiInsights(data);
  const [cooldown, setCooldown] = useState(0);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<{ text: string; error: boolean } | null>(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const refresh = () => {
    setCooldown(REFRESH_COOLDOWN);
    ai.refresh();
  };

  const ask = async (event: FormEvent) => {
    event.preventDefault();
    if (!question.trim() || asking) return;
    setAsking(true);
    setAnswer(null);
    const res = await askAboutSpending(question.trim(), askData(stats, input));
    setAsking(false);
    setAnswer(res.ok ? { text: res.data.answer, error: false } : { text: res.error, error: true });
  };

  const shown = ai.insights ?? templates;
  // AI text carries its own ₱ figures, so it's masked here rather than by the formatters.
  const display = (text: string) => (hidden ? maskAmounts(text) : text);
  const status = ai.loading
    ? "Writing AI insights…"
    : ai.insights
      ? "Written by Gemini"
      : ai.error
        ? `${ai.error} Showing the basic insights.`
        : null;

  return (
    <section aria-labelledby="insights-title" className="flex flex-col gap-3 rounded-[16px] bg-warn-soft px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 id="insights-title" className="m-0 text-xs font-semibold tracking-[0.06em] text-warn-ink uppercase">
            Insights · {monthLong(stats.month)}
          </h2>
          {status ? (
            <p role="status" className="m-0 text-xs text-muted">
              {status}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={cooldown > 0 || ai.loading}
          className="h-9 cursor-pointer rounded-lg border border-warn-line bg-surface px-3 text-[13px] font-semibold text-warn-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          {cooldown > 0 ? `Refreshed · ${cooldown}s` : "Refresh"}
        </button>
      </div>
      <ul aria-busy={ai.loading} className="m-0 flex list-none flex-col gap-2 p-0">
        {shown.map((text) => (
          <li key={text} className="flex gap-2.5 text-sm leading-normal">
            <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-warn" />
            <span>{display(text)}</span>
          </li>
        ))}
      </ul>
      {hidden ? (
        <p className="m-0 text-xs text-muted">Ask is off while amounts are hidden.</p>
      ) : (
        <form onSubmit={ask} className="flex flex-col gap-1.5">
          <div className="flex flex-wrap gap-2">
            <label htmlFor="ask" className="sr-only">
              Ask about your spending
            </label>
            <input
              id="ask"
              type="text"
              maxLength={MAX_QUESTION_LENGTH}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask: how much did I spend on Grab this month?"
              aria-describedby="ask-help"
              className="h-11 min-w-0 flex-[1_1_240px] rounded-[10px] border border-warn-line bg-surface px-3 text-sm placeholder:text-muted"
            />
            <Button type="submit" variant="dark" disabled={asking}>
              {asking ? "Asking…" : "Ask"}
            </Button>
          </div>
          <p id="ask-help" className="m-0 text-xs text-muted">
            Sends this month’s expenses to Gemini.
          </p>
          {answer ? (
            <p
              role="status"
              className={`m-0 rounded-[10px] bg-surface px-3 py-2.5 text-sm ${answer.error || answer.text === CANT_TELL ? "text-muted" : ""}`}
            >
              {answer.text}
            </p>
          ) : null}
        </form>
      )}
    </section>
  );
}
