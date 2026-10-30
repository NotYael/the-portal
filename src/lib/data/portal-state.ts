import type {
  AgentRun,
  BudgetHistoryRow,
  Category,
  Expense,
  ExpenseSettings,
  Goal,
  ISODate,
  JobMatch,
  JournalEntry,
} from "../types";

/** Everything the mock store holds. Each key maps to a future Supabase table. */
export interface PortalState {
  /** 2: job matches and agent runs have the database's columns. 3: goals have sub-goals. */
  version: 3;
  seededOn: ISODate;
  profile: { name: string; email: string };
  expenses: Expense[];
  categories: Category[];
  settings: ExpenseSettings;
  budgetHistory: BudgetHistoryRow[];
  goals: Goal[];
  jobs: JobMatch[];
  agentRuns: AgentRun[];
  journal: JournalEntry[];
}
