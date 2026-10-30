/**
 * Deterministic demo data so every screen has something real-looking to show
 * before Supabase is connected. Records start in March 2025, like the mockup.
 */
import {
  addDays,
  dayOfMonth,
  daysInMonth,
  monthKey,
  monthKeyOf,
  monthRange,
  parseISODate,
  parseMonthKey,
  toISODate,
} from "../dates";
import { withSubgoals } from "../goal-progress";
import type {
  AgentRun,
  BudgetHistoryRow,
  CategorySlug,
  Expense,
  Goal,
  GoalMilestone,
  GoalSubgoal,
  ISODate,
  JobMatch,
  JournalEntry,
  JournalTag,
  MonthKey,
  PaymentMethod,
} from "../types";
import { DEFAULT_CATEGORIES, DEFAULT_CATEGORY_BUDGETS, DEFAULT_SETTINGS } from "./defaults";
import type { PortalState } from "./portal-state";

export const RECORDS_START: MonthKey = "2025-03";

const OLD_CATEGORY_BUDGETS: Record<CategorySlug, number> = {
  food: 6500,
  transport: 3000,
  living: 11000,
  gifts: 1500,
  shopping: 1500,
  subs: 1500,
  leisure: 1500,
  other: 1000,
};

const VARIABLE: [string, CategorySlug, number, number, PaymentMethod, number][] = [
  ["Coffee", "food", 120, 180, "gcash", 6],
  ["Lunch near office", "food", 180, 320, "cash", 7],
  ["Groceries — Puregold", "food", 900, 1800, "card", 3],
  ["Dinner out", "food", 400, 900, "card", 2],
  ["Grab", "transport", 150, 320, "gcash", 5],
  ["Jeep + MRT", "transport", 40, 80, "cash", 4],
  ["Angkas", "transport", 90, 160, "gcash", 2],
  ["Shopee order", "shopping", 300, 1500, "gcash", 2],
  ["Movie night", "leisure", 400, 700, "card", 1],
  ["Game purchase", "leisure", 500, 1500, "card", 1],
  ["Haircut", "other", 250, 400, "cash", 1],
];

function seedMonth(key: MonthKey, today: ISODate): Expense[] {
  const { year, month } = parseMonthKey(key);
  let seed = ((year * 12 + month - 1) * 7919 + 17) % 2147483647;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const len = daysInMonth(key);
  const last = monthKeyOf(today) === key ? dayOfMonth(today) : len;
  const old = year < 2026;
  const scale = old ? 0.76 : 0.82;
  const rows: Expense[] = [];
  const add = (day: number, description: string, slug: CategorySlug, amount: number, via: PaymentMethod) => {
    if (day > last) return;
    const spent_on = toISODate(year, month, day);
    const stamp = `${spent_on}T${String(8 + (rows.length % 12)).padStart(2, "0")}:00:00+08:00`;
    rows.push({
      id: `seed-${key}-${rows.length}`,
      category_id: `cat-${slug}`,
      amount: Math.round(amount),
      spent_on,
      description,
      payment_method: via,
      source: "manual",
      created_at: stamp,
      updated_at: stamp,
    });
  };

  add(1, "Rent", "living", old ? 6000 : 6500, "bank");
  add(5, "Electricity — Meralco", "living", (1800 + rnd() * 800) * scale, "gcash");
  add(8, "Water bill", "living", (300 + rnd() * 200) * scale, "gcash");
  add(10, "Home internet", "living", old ? 1499 : 1699, "card");
  add(12, "Spotify", "subs", 169, "card");
  add(18, "Netflix", "subs", 549, "card");
  if (!old) add(20, "Cloud hosting", "subs", 1150, "card");
  for (const [description, slug, min, max, via, times] of VARIABLE) {
    const n = Math.max(1, Math.round(times * (0.7 + rnd() * 0.6)));
    for (let i = 0; i < n; i++) {
      add(1 + Math.floor(rnd() * len), description, slug, (min + rnd() * (max - min)) * scale, via);
    }
  }
  const isCurrent = monthKeyOf(today) === key;
  if (rnd() > 0.45 || isCurrent || month === 12) {
    const christmas = month === 12;
    add(
      isCurrent ? Math.max(1, last - 2) : 1 + Math.floor(rnd() * len),
      christmas ? "Christmas gifts" : "Birthday gift",
      "gifts",
      christmas ? 3500 + rnd() * 2500 : 800 + rnd() * 1700,
      "card",
    );
  }
  return rows;
}

function seedExpenses(today: ISODate): Expense[] {
  const current = monthKeyOf(today);
  if (current < RECORDS_START) return [];
  return monthRange(RECORDS_START, current).flatMap((key) => seedMonth(key, today));
}

function seedBudgetHistory(today: ISODate): BudgetHistoryRow[] {
  const { year } = parseISODate(today);
  return [
    { effective_month: `${RECORDS_START}-01`, monthly_budget: 22000, category_budgets: OLD_CATEGORY_BUDGETS },
    { effective_month: `${monthKey(Math.max(2026, year), 1)}-01`, monthly_budget: 25000, category_budgets: DEFAULT_CATEGORY_BUDGETS },
  ];
}

// ---------- goals ----------

function milestones(labels: string[], currentQuarter: number): GoalMilestone[] {
  return labels.map((label, i) => {
    const quarter = (i + 1) as 1 | 2 | 3 | 4;
    return { quarter, label, state: quarter < currentQuarter ? "done" : quarter === currentQuarter ? "current" : "todo" };
  });
}

/** Demo sub-goals per demo goal: [title, done]. Progress follows them. */
const SUBGOALS: Record<string, [string, boolean][]> = {
  "goal-career": [["Polish resume and portfolio", true], ["Set up the job agent", true], ["Apply to 30 roles", true], ["Pass 2 system-design mocks", false], ["Get an offer", false]],
  "goal-startup": [["Scope the MVP", true], ["Emissions-factor import", true], ["Reporting dashboard", true], ["Beta with one SME", true], ["Pricing page", true], ["3 paying pilots", false], ["First UK case study", false]],
  "goal-money": [["Open a high-yield savings account", true], ["Auto-transfer on payday", true], ["1 month of expenses saved", false], ["3 months saved", false], ["6 months saved", false]],
  "goal-attic": [["Launch the community page", true], ["First meetup", true], ["Monthly events running", true], ["50 members", false], ["Studio partnership", false], ["Portfolio night", false], ["Year-end showcase", false], ["100 members", false]],
  "goal-health": [["Pick a gym and a schedule", true], ["3× a week for a month", true], ["3× a week for a quarter", true], ["Run a 5K", false], ["3× a week all year", false]],
  "goal-reading": [["Books 1–3", true], ["Books 4–6", true], ["Books 7–9", false], ["Books 10–12", false]],
};

/** The demo sub-goals for a demo goal id; [] for any other goal. */
export function seedSubgoals(goalId: string, today: ISODate): GoalSubgoal[] {
  return (SUBGOALS[goalId] ?? []).map(([title, done], i) => ({
    id: `${goalId}-s${i + 1}`,
    title,
    done,
    done_at: done ? `${addDays(today, -(30 * (SUBGOALS[goalId].length - i)))}T09:00:00+08:00` : null,
  }));
}

function seedGoals(today: ISODate): Goal[] {
  const { year, month } = parseISODate(today);
  const q = Math.ceil(month / 3);
  const behindQ = Math.max(1, q - 1);
  const goals: Omit<Goal, "subgoals">[] = [
    { id: "goal-career", year, area: "Career", title: "Land a SWE role at a top PH company", progress_pct: 60, status: "on_track", next_step: "System-design prep, 2 interviews", milestones: milestones(["Resume", "Job agent", "Apply 30", "Offer"], q) },
    { id: "goal-startup", year, area: "Startup", title: "Launch carbon SaaS MVP to first UK SMEs", progress_pct: 72, status: "on_track", next_step: "Pilot customer onboarding", milestones: milestones(["Scope", "Build", "Beta", "3 pilots"], q) },
    { id: "goal-money", year, area: "Money", title: "Build an emergency fund", progress_pct: 45, status: "behind", next_step: "Auto-transfer on payday", milestones: milestones(["15%", "30%", "45%", "100%"], behindQ) },
    { id: "goal-attic", year, area: "The Attic", title: "Grow The Attic designer community", progress_pct: 38, status: "behind", next_step: "November community event", milestones: milestones(["Launch", "Events", "Members", "Studio"], Math.max(1, q - 2)) },
    { id: "goal-health", year, area: "Health", title: "Train 3× a week", progress_pct: 70, status: "on_track", next_step: "Keep the streak through December", milestones: milestones(["Habit", "Routine", "Steady", "Finish"], q) },
    { id: "goal-reading", year, area: "Personal", title: "Read 12 books", progress_pct: 58, status: "on_track", next_step: "Book 8 of 12", milestones: milestones(["3", "6", "9", "12"], q) },
  ];
  return goals.map((g) => withSubgoals({ ...g, subgoals: [] }, seedSubgoals(g.id, today)));
}

// ---------- job agent ----------

/** Matches like the job-agent saves: remote, entry-level, companies based outside the Philippines. */
export function seedJobs(today: ISODate): JobMatch[] {
  const job = (
    n: number, title: string, company: string, location: string, hq: string | null, source: string,
    match_pct: number, reason: string, salary: string | null, daysAgo: number, status: JobMatch["status"],
  ): JobMatch => ({
    id: `job-${n}`,
    source,
    title,
    company,
    location,
    hq,
    url: `https://jobs.example.com/${n}`,
    salary,
    job_type: "Full-Time",
    work_mode: "remote",
    match_pct,
    reason,
    posted_at: null,
    found_at: runTime(today, daysAgo),
    status,
  });
  return [
    job(1, "Junior Software Engineer", "Tidewater Labs", "Remote · APAC", "Singapore", "himalayas", 91, "Python + FastAPI, entry level, APAC hours", "USD 40,000–55,000/year", 0, "new"),
    job(2, "Associate Backend Engineer", "Kestrel Analytics", "Remote · Worldwide", "Australia", "remoteok", 86, "Node.js + Postgres, asks 0–2 years", null, 0, "new"),
    job(3, "Graduate Full-stack Developer", "Northlight Software", "Remote", "United Kingdom", "weworkremotely", 82, "React + Laravel, structured grad mentoring", "GBP 32,000/year", 1, "new"),
    job(4, "Software Engineer I", "Fernhill Health", "Remote · Anywhere", "Canada", "remotive", 78, "TypeScript + Angular, small product team", null, 1, "new"),
    job(5, "Junior AI Engineer", "Quillmate", "Remote · APAC", null, "jobicy", 75, "LLM tooling in Python; HQ unclear", null, 2, "new"),
    job(6, "Junior Developer, Platform", "Brightwave Energy", "Remote", "New Zealand", "himalayas", 72, "PHP + Python services, climate domain", null, 3, "new"),
    job(7, "Junior Backend Engineer", "Harbor Payments", "Remote · Worldwide", "Ireland", "remotefirstjobs", 84, "Python payments services, mentoring", "EUR 38,000–45,000/year", 4, "saved"),
    job(8, "Entry-level Software Engineer", "Lumen Robotics", "Remote", "Japan", "workingnomads", 76, "Python tooling for robotics data", null, 6, "saved"),
    job(9, "Associate Software Engineer", "Oakline Data", "Remote · APAC", "Singapore", "himalayas", 83, "SQL + Python pipelines, 0–2 years", null, 9, "applied"),
    job(10, "Junior Full-stack Engineer", "Pebble Commerce", "Remote", "Netherlands", "remoteok", 80, "React + Node, async team", null, 12, "applied"),
    job(11, "Software Engineer, New Grad", "Cedar Systems", "Remote · Worldwide", "United States", "remotive", 88, "Strong match on stack and level", "USD 60,000–70,000/year", 15, "interviewing"),
  ];
}

/** The bot's cron is 8:37 PM Manila and GitHub starts it late; demo runs land at 9:05 PM. */
function runTime(today: ISODate, daysAgo: number) {
  return `${addDays(today, -(daysAgo + 1))}T21:05:00+08:00`;
}

export function seedAgentRuns(today: ISODate): AgentRun[] {
  return Array.from({ length: 7 }, (_, i) => ({
    id: `run-${i}`,
    ran_at: runTime(today, i),
    triggered_by: "schedule" as const,
    status: "success" as const,
    fetched: [532, 518, 547, 501, 539, 522, 510][i],
    candidates: [6, 2, 4, 3, 5, 1, 3][i],
    matched: [2, 2, 1, 1, 1, 0, 1][i],
    error: null,
  }));
}

// ---------- journal ----------

const JOURNAL: [JournalTag, string, string | null][] = [
  ["win", "Emissions-factor import finally passes on real UK supplier data.", "goal-startup"],
  ["lesson", "Batch the job applications on one evening instead of every night.", "goal-career"],
  ["target", "Get two mock system-design sessions in before next Friday.", "goal-career"],
  ["note", "Slow morning. Reading before work helps more than coffee.", null],
  ["win", "Three applications out from this morning’s agent run.", "goal-career"],
  ["target", "Set up the auto-transfer to the emergency fund on payday.", "goal-money"],
  ["win", "Finished book 7 of 12.", "goal-reading"],
  ["target", "Draft The Attic’s November community event.", "goal-attic"],
  ["lesson", "Shipping small beats polishing alone — the pilot user found the real bug.", "goal-startup"],
  ["note", "Training streak holding. Legs day is still the hardest to show up for.", "goal-health"],
  ["win", "First UK SME agreed to a pilot call.", "goal-startup"],
  ["note", "Quiet day, mostly admin.", null],
];

export const JOURNAL_PROMPTS = [
  "What moved you closer to a goal this week?",
  "What would make tomorrow a win?",
  "What did you learn today that you want to keep?",
  "What’s one thing you’ll do differently next week?",
];

function seedJournal(today: ISODate): JournalEntry[] {
  // 12-day streak that ends yesterday, so today's entry is still waiting.
  return JOURNAL.map(([tag, body, goal_id], i) => {
    const entry_date = addDays(today, -(i + 1));
    return {
      id: `journal-${i}`,
      entry_date,
      prompt: JOURNAL_PROMPTS[i % JOURNAL_PROMPTS.length],
      body,
      tag,
      goal_id,
      created_at: `${entry_date}T21:00:00+08:00`,
    };
  });
}

export function seedPortal(today: ISODate): PortalState {
  return {
    version: 3,
    seededOn: today,
    profile: { name: "Danyael", email: "" },
    expenses: seedExpenses(today),
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    settings: { ...DEFAULT_SETTINGS },
    budgetHistory: seedBudgetHistory(today),
    goals: seedGoals(today),
    jobs: seedJobs(today),
    agentRuns: seedAgentRuns(today),
    journal: seedJournal(today),
  };
}
