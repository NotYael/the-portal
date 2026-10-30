"use client";

/**
 * Job matches and agent runs. With Supabase configured they're the real
 * job_matches / agent_runs rows the job-agent bot writes; in demo mode they
 * come from the mock store.
 */
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { supabaseBrowser } from "../supabase/client";
import { supabaseConfigured } from "../supabase/config";
import type { AgentRun, JobMatch, JobStatus } from "../types";
import { setJobStatus as setMockJobStatus, usePortalData } from "./store";

export interface JobBoard {
  jobs: JobMatch[];
  runs: AgentRun[];
}

export interface JobBoardState {
  /** null until the first load finishes (show a skeleton). */
  board: JobBoard | null;
  error: string | null;
}

const JOB_COLUMNS =
  "id, source, title, company, location, hq, url, salary, job_type, work_mode, match_pct, reason, posted_at, found_at, status";
const RUN_COLUMNS = "id, ran_at, triggered_by, status, fetched, candidates, matched, error";

// ---------- Supabase ----------

let state: JobBoardState = { board: null, error: null };
let loading = false;
const listeners = new Set<() => void>();
const SERVER_STATE: JobBoardState = { board: null, error: null };

function emit(next: JobBoardState) {
  state = next;
  for (const listener of listeners) listener();
}

async function load() {
  if (loading) return;
  loading = true;
  const supabase = supabaseBrowser();
  // RLS scopes both queries to the signed-in user. Dismissed jobs never show, so skip them.
  const [jobs, runs] = await Promise.all([
    supabase.from("job_matches").select(JOB_COLUMNS).neq("status", "dismissed").order("match_pct", { ascending: false }),
    supabase.from("agent_runs").select(RUN_COLUMNS).order("ran_at", { ascending: false }).limit(30),
  ]);
  loading = false;
  const error = jobs.error ?? runs.error;
  if (error) {
    emit({ board: state.board, error: "Couldn’t load job matches. Refresh to try again." });
    return;
  }
  // The columns' check constraints guarantee the narrower types.
  emit({ board: { jobs: jobs.data as JobMatch[], runs: runs.data as AgentRun[] }, error: null });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function useSupabaseJobBoard(): JobBoardState {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
  // Show what's cached right away and refresh it on every visit.
  useEffect(() => {
    void load();
  }, []);
  return snapshot;
}

function patchJob(id: string, status: JobStatus) {
  if (!state.board) return;
  const jobs = state.board.jobs.map((j) => (j.id === id ? { ...j, status } : j));
  emit({ ...state, board: { ...state.board, jobs } });
}

// ---------- demo mode ----------

function useMockJobBoard(): JobBoardState {
  const data = usePortalData();
  return useMemo(() => ({ board: data ? { jobs: data.jobs, runs: data.agentRuns } : null, error: null }), [data]);
}

// ---------- public API ----------

/** `supabaseConfigured` is fixed at build time, so each build always calls the same hook. */
export const useJobBoard: () => JobBoardState = supabaseConfigured ? useSupabaseJobBoard : useMockJobBoard;

/** Moves a job along the pipeline. Updates the UI first; returns false (and undoes it) if saving failed. */
export async function setJobStatus(job: JobMatch, status: JobStatus): Promise<boolean> {
  if (!supabaseConfigured) {
    setMockJobStatus(job.id, status);
    return true;
  }
  patchJob(job.id, status);
  const { error } = await supabaseBrowser().from("job_matches").update({ status }).eq("id", job.id);
  if (error) patchJob(job.id, job.status);
  return !error;
}
