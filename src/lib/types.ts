/**
 * Row shapes mirror the Supabase tables in docs/PORTAL_SPEC.md so the mock
 * store can be swapped for real queries without touching the UI.
 * Dates are ISO strings: `spent_on` is "YYYY-MM-DD" in Asia/Manila.
 */

export type ISODate = string;
/** "YYYY-MM" */
export type MonthKey = string;

export const PAYMENT_METHODS = ["gcash", "card", "cash", "bank"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  gcash: "GCash",
  card: "Card",
  cash: "Cash",
  bank: "Bank",
};

export type CategorySlug =
  | "food"
  | "transport"
  | "living"
  | "gifts"
  | "shopping"
  | "subs"
  | "leisure"
  | "other";

export interface Category {
  id: string;
  slug: CategorySlug;
  label: string;
  color: string;
  is_fixed: boolean;
  /** null = no limit */
  monthly_budget: number | null;
  sort_order: number;
  archived: boolean;
}

export type ExpenseSource = "manual" | "ai";

export interface Expense {
  id: string;
  category_id: string;
  amount: number;
  spent_on: ISODate;
  description: string;
  payment_method: PaymentMethod;
  source: ExpenseSource;
  created_at: string;
  updated_at: string;
}

export type NewExpense = Pick<
  Expense,
  "category_id" | "amount" | "spent_on" | "description" | "payment_method" | "source"
>;

export type AlertThreshold = 80 | 90 | 100;
export type CycleStartDay = 1 | 15 | 30;

export interface ExpenseSettings {
  monthly_budget: number;
  default_payment_method: PaymentMethod;
  alert_threshold_pct: AlertThreshold;
  cycle_start_day: CycleStartDay;
  ai_insights_enabled: boolean;
  include_in_digest: boolean;
  rollover_enabled: boolean;
}

export interface BudgetHistoryRow {
  /** First day of the month the budget takes effect, "YYYY-MM-01". */
  effective_month: ISODate;
  monthly_budget: number;
  /** Missing key = no limit for that category. */
  category_budgets: Partial<Record<CategorySlug, number>>;
}

// ---------- Phase 5 modules ----------

export type GoalStatus = "on_track" | "behind" | "done";
export type MilestoneState = "done" | "current" | "todo";

export interface GoalMilestone {
  quarter: 1 | 2 | 3 | 4;
  label: string;
  state: MilestoneState;
}

/** A row of goal_subgoals: one checklist item under a goal. */
export interface GoalSubgoal {
  id: string;
  title: string;
  done: boolean;
  done_at: string | null;
}

export interface Goal {
  id: string;
  year: number;
  area: string;
  title: string;
  /** With sub-goals, done ÷ total (see lib/goal-progress.ts); without, set by hand. */
  progress_pct: number;
  status: GoalStatus;
  next_step: string;
  milestones: GoalMilestone[];
  /** In display order. */
  subgoals: GoalSubgoal[];
}

export type WorkMode = "remote" | "hybrid" | "onsite";
export type JobStatus = "new" | "saved" | "applied" | "interviewing" | "dismissed";

/** A row of job_matches. The job-agent bot (separate repo) inserts them; the Portal only changes `status`. */
export interface JobMatch {
  id: string;
  /** Job board it came from, e.g. "himalayas". */
  source: string;
  title: string;
  company: string;
  location: string;
  /** Country the company is based in, as judged by the agent; null when unclear. */
  hq: string | null;
  url: string;
  salary: string | null;
  job_type: string | null;
  work_mode: WorkMode | null;
  match_pct: number;
  reason: string;
  posted_at: string | null;
  found_at: string;
  status: JobStatus;
}

/** A row of agent_runs: the bot logs one at the end of every run. */
export interface AgentRun {
  id: string;
  ran_at: string;
  triggered_by: "schedule" | "manual";
  status: "success" | "failed";
  fetched: number;
  candidates: number;
  matched: number;
  /** Why a failed run failed; on a successful run, a warning (e.g. jobs Gemini couldn't score). */
  error: string | null;
}

export type JournalTag = "win" | "target" | "lesson" | "note";

export interface JournalEntry {
  id: string;
  entry_date: ISODate;
  prompt: string;
  body: string;
  tag: JournalTag;
  goal_id: string | null;
  created_at: string;
}
