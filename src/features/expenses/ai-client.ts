"use client";

/**
 * Calls the expense AI routes. Every call has a way out: quick add falls
 * back to the rule parser in the browser, insights keep the template ones,
 * and Ask shows the route's message.
 */
import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { AskData, InsightData } from "@/lib/ai/expense-ai";
import { parseExpensesWithRules, type ParseResult } from "@/lib/expense-parser";
import type { ISODate } from "@/lib/types";

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

const UNAVAILABLE = "AI is unavailable right now.";

async function post<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      // The server gives up on Gemini after ~40s; this is the backstop.
      signal: AbortSignal.timeout(55_000),
    });
    const json = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
    if (res.ok && json) return { ok: true, data: json };
    return { ok: false, error: json?.error ?? UNAVAILABLE };
  } catch {
    return { ok: false, error: UNAVAILABLE };
  }
}

// ---------- quick add ----------

export interface QuickParse extends ParseResult {
  /** Why AI wasn't used, when it wasn't. */
  notice: string | null;
}

export async function parseQuickAdd(text: string, today: ISODate): Promise<QuickParse> {
  const res = await post<ParseResult & { notice?: string }>("/api/expenses/parse", { text });
  if (res.ok) return { items: res.data.items, source: res.data.source, notice: res.data.notice ?? null };
  return { ...parseExpensesWithRules(text, today), notice: res.error };
}

// ---------- ask ----------

export function askAboutSpending(question: string, data: AskData) {
  return post<{ answer: string }>("/api/expenses/ask", { question, data });
}

// ---------- insights ----------

const CACHE_KEY = "the-portal.ai-insights.v1";
const CACHE_MONTHS = 12;

type InsightCache = Record<string, { hash: string; insights: string[]; at: number }>;

function readCache(): InsightCache {
  try {
    return JSON.parse(window.localStorage.getItem(CACHE_KEY) ?? "{}") as InsightCache;
  } catch {
    return {};
  }
}

function writeCache(month: string, hash: string, insights: string[]) {
  try {
    const cache = { ...readCache(), [month]: { hash, insights, at: Date.now() } };
    const kept = Object.entries(cache)
      .sort((a, b) => b[1].at - a[1].at)
      .slice(0, CACHE_MONTHS);
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(kept)));
  } catch {
    // No storage: insights are fetched again next visit.
  }
}

async function digest(text: string): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Non-secure contexts have no crypto.subtle; a weak hash is fine for a cache key.
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16) + text.length;
}

interface InsightEntry {
  insights: string[] | null;
  loading: boolean;
  error: string | null;
}

const EMPTY: InsightEntry = { insights: null, loading: false, error: null };
const MAX_ENTRIES = 20;

// Keyed by the aggregates' JSON, so a month whose numbers changed is a new entry.
const entries = new Map<string, InsightEntry>();
const listeners = new Set<() => void>();

function setEntry(key: string, entry: InsightEntry) {
  entries.delete(key);
  entries.set(key, entry);
  if (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value!);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function loadInsights(json: string, force: boolean) {
  const previous = entries.get(json);
  if (previous?.loading) return;
  if (!force && previous?.insights) return;

  const data = JSON.parse(json) as InsightData;
  const hash = await digest(json);
  const cached = readCache()[data.month];
  if (!force && cached?.hash === hash) {
    setEntry(json, { insights: cached.insights, loading: false, error: null });
    return;
  }

  setEntry(json, { insights: previous?.insights ?? null, loading: true, error: null });
  const res = await post<{ insights: string[] }>("/api/expenses/insights", { data, force });
  if (res.ok) {
    writeCache(data.month, hash, res.data.insights);
    setEntry(json, { insights: res.data.insights, loading: false, error: null });
  } else {
    setEntry(json, { insights: previous?.insights ?? null, loading: false, error: res.error });
  }
}

/**
 * AI insights for one month's aggregates. Answers are cached per month in
 * localStorage under a hash of the aggregates, so Gemini is only asked again
 * when the numbers change or on refresh().
 */
export function useAiInsights(data: InsightData | null) {
  const json = data ? JSON.stringify(data) : null;
  const entry = useSyncExternalStore(subscribe, () => (json ? entries.get(json) : undefined), () => undefined);

  useEffect(() => {
    if (json) void loadInsights(json, false);
  }, [json]);

  const refresh = useCallback(() => {
    if (json) void loadInsights(json, true);
  }, [json]);

  const current = entry ?? EMPTY;
  return {
    insights: current.insights,
    loading: entry ? entry.loading : json !== null,
    error: current.error,
    refresh,
  };
}
