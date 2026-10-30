# The Portal

A private, single-user workspace: expenses, goals, job agent, journal, reminders and a weekly digest behind one login.

The full spec lives in [`docs/PORTAL_SPEC.md`](docs/PORTAL_SPEC.md). The visual reference is the
[mockup canvas](https://claude.ai/artifact/5Mnvh76Ko68MZ9zUHmGFP5).

## Status

Login, Expenses (expenses, categories, settings, budget history), the Job agent and Reminders run on Supabase, and the expense
AI features run on Gemini; goals, journal and profile still run on seeded demo data in `localStorage`.
Without `.env.local` (see `.env.example`) the whole app runs in **demo mode**: any email and password sign in,
and expenses and jobs are demo data too.

| Route | What works today |
|---|---|
| `/login` | Supabase email + password login (demo mode: any well-formed email + password, mock cookie). |
| `/` | Home: greeting, 4 summary cards, this week's wins/targets, recent spending, top matches, goal progress |
| `/expenses` | Full Expenses module: Gemini quick add, insights and Ask (rule/template fallbacks), hide-amounts eye button (asks for your password both ways), quick add (rule-based parser), manual form, edit drawer, month tabs + year switcher (`?m=YYYY-MM`, `?y=YYYY`), 6 stat cards, budget alert, insights, all charts, advanced breakdown, year overview, settings with budget history |
| `/goals` | Year tabs, check-in banner, goal cards with quarterly milestones and a sub-goal checklist (progress = sub-goals ticked ÷ total; all ticked = Done), new-goal form |
| `/jobs` | Real matches from the job-agent bot, its live status (active / late / stopped / failing), pipeline counts, filters, Dismiss / Save / Mark applied |
| `/journal` | Daily prompt, tags, link to goal, this week's entries, streak |
| `/reminders` | Reminders for weeks from now (one-off or every N days/weeks/months): add form with 3/6/10-week shortcuts, Overdue / Due this week / Coming up / Done, edit drawer, Done moves a repeating one to its next date. Sidebar badge and a Home card show what's due in the next 7 days; the digest lists the week ahead |
| `/digest` | Preview of this week's digest email |

To start over with fresh demo data, clear the site's `localStorage` (key `the-portal.mock-db.v1`).

**Hide amounts** (eye button on Expenses) shows every peso amount in the Portal as `*******` and locks editing,
so you can show the site to people. Turning it on or off asks for your account password, checked on the server
(`src/features/privacy/check-password.ts`). It's remembered per browser, and it only keeps amounts off the screen:
the data is still loaded in the page.

**AI** (`src/lib/ai/`, routes in `src/app/api/expenses/`): quick add (`parse`), insights and Ask call Gemini from the
server; the key never reaches the browser. `GEMINI_MODELS` is tried in order: a model that times out, is rate-limited,
missing, overloaded or returns JSON that fails validation hands over to the next, and all models share a 40 s budget
so each gets a turn. Requests ask for low thinking (answers in ~2–5 s instead of 10–15 s+). When every model fails,
quick add uses the rule parser, insights keep the template ones, and Ask says AI is unavailable. Only a signed-in
user (or `ALLOWED_USER_ID`) can call the routes, 12 requests a minute. Insights send aggregates only and are cached in
the browser per month until the numbers change; Ask sends the month's rows. While amounts are hidden, ₱ figures in AI
text are masked and Ask is off.

**Bot status** (`src/lib/agent-health.ts`): the job-agent logs every run to `agent_runs`. Measured from the last
scheduled run, more than 34 hours of silence (24 h + 10 h for GitHub's late starts) is "Missed a run" and more than
58 hours is "Stopped". A failed last run is "Last run failed", and a run that logged a warning (jobs Gemini couldn't
score) is "Ran with problems".

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # unit tests for the stats, parser and summaries
npm run lint
npm run typecheck
```

## How it's put together

- `src/lib/expense-stats.ts` — every expense number as pure, unit-tested functions. The API routes will reuse it.
- `src/lib/expense-parser.ts` — the quick-add rule parser (the no-AI fallback from the spec).
- `src/lib/portal-summary.ts`, `src/lib/digest.ts` — what Home and the digest read from each module.
- `src/lib/data/store.ts` — the mock data layer. Row shapes match the Supabase tables (`src/lib/types.ts`).
- `src/lib/data/expense-book.ts` — expenses, categories, settings and budget history from Supabase (or the mock store in demo mode). Settings save through the `save_expense_settings` function in one transaction.
- `src/lib/data/job-board.ts` — job matches and agent runs from Supabase (or the mock store in demo mode).
- `src/lib/supabase/*` — browser, server and proxy clients (publishable key; RLS does the rest).
- `src/proxy.ts` — the auth gate (Next.js 16 "proxy", formerly middleware); refreshes the Supabase session.
- `src/features/*` — one folder per module; `src/components/*` — shared UI and charts.
- Design tokens: `src/styles/tokens.css` (CSS variables from the spec), mirrored in `src/lib/theme.ts` for Chart.js.

## Differences from the spec

The spec targets Angular. This app is **Next.js 16 (App Router) + React 19 + Tailwind 4** instead:

- `ng2-charts` → `react-chartjs-2` (still Chart.js)
- `NG_APP_*` env vars → `NEXT_PUBLIC_*` (see `.env.example`)
- `GEMINI_MODEL` → `GEMINI_MODELS`, a fallback list: the next model is tried when one times out or is overloaded
- `@google/genai` SDK → Gemini's REST API via `fetch` (`src/lib/ai/gemini.ts`), so the fallback and timeouts are explicit
- AI routes read no tables yet: expenses still live in the browser, so the page sends the aggregates (insights) or rows
  (Ask), and insights are cached in `localStorage` instead of `ai_insight_cache`. Switch both once expenses move to Supabase.
- Vercel `/api` functions → Next.js route handlers under `src/app/api` (when the backend lands)
- Angular `authGuard` → `src/proxy.ts`
- **Send test** on `/digest` emails the previewed digest through Resend (`POST /api/digest/test`, needs `RESEND_API_KEY`
  and `DIGEST_TO_EMAIL`).
- Keep-alive: a GitHub Actions workflow (`.github/workflows/keep-supabase-alive.yml`) queries `profiles` every 8 hours
  instead of the daily `/api/cron/keepalive` Vercel cron. It needs the repo secrets `SUPABASE_URL` and
  `SUPABASE_SECRET_KEY` (the `sb_secret_…` key; `anon` can't read any table).

## Database

The Supabase project `the-portal` (ref `dpbioilargqxniuhdvfw`) has the full schema applied from
[`supabase/migrations/`](supabase/migrations): profiles, expenses (categories, expenses, settings,
budget history, insight cache), goals + milestones + sub-goals, journal, job matches + agent runs, reminders, and digest runs.
A trigger keeps `goals.progress_pct` and `status` in step with `goal_subgoals` (same rule as `src/lib/goal-progress.ts`).
Every table has row-level security limited to its owner, and `anon` has no access at all.
Signing up seeds the profile, settings, 8 categories and the first budget row. Types: `src/lib/database.types.ts`.

Who writes what:

| Table | Signed-in user | Server only (service role) |
|---|---|---|
| expenses, categories, expense_settings, budget_history, goals, goal_milestones, goal_subgoals, journal_entries, reminders | read + write | — |
| profiles | read + update | — |
| job_matches | read, delete, change `status` only | job agent inserts |
| agent_runs, ai_insight_cache, digest_runs | read | job agent / API / cron write |

## Next: connecting the backend

1. In the Supabase dashboard, turn off **Allow new users to sign up** (Authentication → Sign In / Providers).
2. Swap the rest of `src/lib/data/store.ts` (expenses, goals, journal, profile) for Supabase queries, like
   `src/lib/data/job-board.ts` does for jobs; keep the return shapes.
3. Then have the AI routes read rows server-side and cache insights in `ai_insight_cache`.
4. Add the `weekly-digest` cron (keep-alive already runs on GitHub Actions).
