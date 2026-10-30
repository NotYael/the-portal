# The Portal — Implementation Guide for Claude Code

2026-10-25 · @Yael

## How to use this guide

Build The Portal phase by phase (see Build phases), starting with auth and the Expenses module. Export this doc as Markdown, save it in the repo as `docs/PORTAL_SPEC.md`, and point Claude Code at it.

**Working agreement for Claude Code**

- Work one phase at a time. Finish its acceptance criteria before starting the next.
- Ask before anything destructive (dropping tables, deleting data, force-pushing), any architectural change to this spec, and anything that costs money or leaves a free tier.
- Otherwise proceed on stated assumptions and list them in the PR or commit message.
- Keep every secret server-side. The Gemini, Resend and Supabase service-role keys never reach the browser.
- Write SQL as migrations in `supabase/migrations/`, never as ad-hoc dashboard edits.
- All money is Philippine pesos (PHP), stored as `numeric(12,2)`. All dates use the `Asia/Manila` timezone.
- The mockup is the visual reference: https://claude.ai/artifact/5Mnvh76Ko68MZ9zUHmGFP5

## Product overview

The Portal is a private, single-user web app that bundles personal tools behind one login. It must run on free tiers.

| Module | What it does | Phase |
|---|---|---|
| Login gate | Email + password and Google sign-in for one allowed user | 1 |
| Expenses | Log expenses (AI quick-add or form), month dashboard, charts, settings, AI insights | 2–3 |
| Weekly digest | Sunday email recapping wins and next week's targets | 4 |
| Home | At-a-glance cards from every module | 5 |
| Goals | Yearly goals with quarterly milestones | 5 |
| Job agent | Shows matches from the existing job-search bot | 5 |
| Journal | Daily entries tagged Win / Target / Lesson / Note; tags feed the digest | 5 |

**Core design rule:** each module writes structured rows to its own tables. Home and the digest only read those tables. Adding a tool later means adding its tables, its page, and a digest reader. Shared code never needs to change.

**Out of scope:** income, account balances, net worth, multiple users, and native mobile apps. The Expenses module tracks spending only.

## Stack and free-tier constraints

Target cost is ₱0/month. Every choice below stays on a free plan. Free-tier limits were checked in October 2026 and change often, so re-check them before relying on any number.

| Layer | Choice | Free-tier limit to design around |
|---|---|---|
| Frontend | Angular (latest stable, standalone components, signals) on Vercel Hobby | Hobby is for personal, non-commercial use |
| Serverless API | Vercel Functions in TypeScript under `/api` | 300 s max duration on Hobby |
| Database + auth | Supabase Free (Postgres, Auth, RLS) | 500 MB DB, 2 projects; **pauses after 7 days of no activity** |
| Scheduled jobs | Vercel Cron | Hobby: **once per day at most**, fires anytime within the scheduled hour, UTC only |
| Job agent runner | GitHub Actions scheduled workflow (existing Python bot) | Free minutes are enough for one daily run |
| Email | Resend Free | 100 emails/day, 3,000/month; without a verified domain it delivers only to the account owner's email, which is enough here |
| AI | Gemini API free tier, Flash or Flash-Lite model | Low RPM/RPD limits; **free-tier prompts may be used by Google to improve products** |
| Charts | Chart.js via `ng2-charts` | Free and open source |

**Rules that follow from these limits**

- Keep Supabase awake: a daily cron (`/api/cron/keepalive`) runs one real query. The job agent's daily write also counts as activity.
- Only two Vercel cron jobs: a daily keep-alive and the weekly digest.
- Put the Gemini model name in the `GEMINI_MODEL` env var. Pick a model the free tier currently allows in Google AI Studio; don't hardcode it.
- Every Gemini call handles `429 RESOURCE_EXHAUSTED` gracefully. Each AI feature needs a non-AI fallback (see AI features).
- Privacy: send Gemini the minimum data. Prefer aggregates over raw rows, and never send journal text unless the user triggers that action.

## Repo structure

Use one repo with the Angular app at the root. Vercel deploys it together with the `/api` functions.

```
the-portal/
├─ src/app/
│  ├─ core/            # supabase client, auth guard, auth service, date + peso utils
│  ├─ shared/          # layout shell, sidebar, stat-card, chips, tabs, chart wrappers
│  ├─ features/
│  │  ├─ login/
│  │  ├─ home/
│  │  ├─ expenses/      # page, components, expense.service.ts, stats.ts (pure functions)
│  │  ├─ goals/
│  │  ├─ jobs/
│  │  ├─ journal/
│  │  └─ digest/        # in-app preview of the weekly email
│  └─ app.routes.ts
├─ lib/                # expense-stats.ts — pure functions shared by app + api
├─ api/
│  ├─ _lib/            # gemini.ts, supabase-admin.ts, auth.ts (verify user JWT), resend.ts
│  ├─ expenses/parse.ts
│  ├─ expenses/insights.ts
│  ├─ expenses/ask.ts
│  └─ cron/
│     ├─ keepalive.ts
│     └─ weekly-digest.ts
├─ emails/             # digest email template (HTML string or react-email build output)
├─ supabase/migrations/
├─ docs/PORTAL_SPEC.md # this guide
└─ vercel.json         # crons + rewrites
```

- Put the stats math in a root-level `lib/expense-stats.ts` as pure, unit-tested functions with no Angular imports. Both the Angular dashboard and the `/api` insights and digest functions import from it.
- Routes: `/login`, `/` (home), `/expenses`, `/goals`, `/jobs`, `/journal`, `/digest`. Every route except `/login` sits behind the auth guard.

## Design system

Copy these tokens into `src/styles/tokens.scss` as CSS custom properties. Match the mockup's spacing and radii.

| Token | Value | Use |
|---|---|---|
| `--bg` | #F3F4F6 | Page background |
| `--surface` | #FFFFFF | Cards, sidebar |
| `--border` | #E3E6EB | Card borders |
| `--border-strong` | #C9CED6 | Inputs, secondary buttons |
| `--ink` | #111418 | Text, active nav, dark panels |
| `--muted` | #5B6270 | Secondary text (passes 4.5:1 on white) |
| `--accent` | #2F5BFF | Primary buttons, main chart series |
| `--accent-ink` | #1E3FCC | Accent text on light-blue fills |
| `--accent-soft` | #E8EDFF | Chips, info banners |
| `--warn` | #E0661F | Over budget, peak values (fills only) |
| `--warn-ink` | #B23D0A | Warning text |
| `--warn-soft` | #FFF1E8 | AI insights panel |

**Type:** Space Grotesk 700 for headings, Inter 400/500/600 for body, JetBrains Mono 500 for every amount and number. All three come from Google Fonts.

**Shape:** cards use a 16 px radius, 1 px border and 20–24 px padding. Buttons and inputs use a 10 px radius with a minimum height of 44 px. Pills use a 999 px radius.

**Category colors** (fixed, also stored in the DB):

| Category | Slug | Color | Fixed cost? |
|---|---|---|---|
| Food | food | #2F5BFF | No |
| Transport | transport | #E0661F | No |
| Living expenses | living | #111418 | Yes |
| Gifts | gifts | #9B4DCA | No |
| Shopping | shopping | #F2A774 | No |
| Subscriptions | subs | #7C8594 | Yes |
| Leisure | leisure | #9DB0FF | No |
| Other | other | #C9CED6 | No |

**Layout:** a 220 px sidebar, then the content column at max 1280 px. Below 780 px the sidebar stacks on top. Wide tables scroll inside their own container. Every control is a real `<button>`, `<a>` or `<label>`+`<input>`. Chart colors are never the only carrier of meaning: always show a label or value.

## Database schema

Four tables cover Expenses. Row-level security on every table limits each row to its owner. A trigger seeds the settings and the 8 categories when the user signs up. Put this in `supabase/migrations/0001_expenses.sql`.

```sql
create extension if not exists pgcrypto;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null,
  label text not null,
  color text not null,
  is_fixed boolean not null default false,
  monthly_budget numeric(12,2) check (monthly_budget is null or monthly_budget >= 0), -- null = no limit
  sort_order int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, slug)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id),
  amount numeric(12,2) not null check (amount > 0),
  spent_on date not null default ((now() at time zone 'Asia/Manila')::date),
  description text not null check (char_length(description) between 1 and 200),
  payment_method text not null check (payment_method in ('gcash','card','cash','bank')),
  source text not null default 'manual' check (source in ('manual','ai')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index expenses_user_date_idx on public.expenses (user_id, spent_on desc);

create table public.expense_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  monthly_budget numeric(12,2) not null default 25000 check (monthly_budget >= 0),
  default_payment_method text not null default 'gcash'
    check (default_payment_method in ('gcash','card','cash','bank')),
  alert_threshold_pct int not null default 80 check (alert_threshold_pct in (80, 90, 100)),
  cycle_start_day int not null default 1 check (cycle_start_day in (1, 15, 30)),
  ai_insights_enabled boolean not null default true,
  include_in_digest boolean not null default true,
  rollover_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.ai_insight_cache (
  user_id uuid not null references auth.users(id) on delete cascade,
  month date not null,            -- first day of the month
  data_hash text not null,        -- hash of the aggregates sent to Gemini
  insights jsonb not null,        -- [{"text": "..."}]
  generated_at timestamptz not null default now(),
  primary key (user_id, month)
);

-- RLS
alter table public.categories enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_settings enable row level security;
alter table public.ai_insight_cache enable row level security;

create policy own_categories on public.categories for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy own_expenses on public.expenses for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.categories c where c.id = category_id and c.user_id = auth.uid())
  );

create policy own_settings on public.expense_settings for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- cache is written only by the API with the service role (bypasses RLS); the user may read it
create policy read_own_insights on public.ai_insight_cache for select
  using (user_id = auth.uid());

-- seed on signup
create or replace function public.seed_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.expense_settings (user_id) values (new.id);
  insert into public.categories (user_id, slug, label, color, is_fixed, monthly_budget, sort_order) values
    (new.id, 'food',      'Food',            '#2F5BFF', false, 7000,  1),
    (new.id, 'transport', 'Transport',       '#E0661F', false, 3500,  2),
    (new.id, 'living',    'Living expenses', '#111418', true,  12000, 3),
    (new.id, 'gifts',     'Gifts',           '#9B4DCA', false, 2000,  4),
    (new.id, 'shopping',  'Shopping',        '#F2A774', false, 2000,  5),
    (new.id, 'subs',      'Subscriptions',   '#7C8594', true,  2000,  6),
    (new.id, 'leisure',   'Leisure',         '#9DB0FF', false, 2000,  7),
    (new.id, 'other',     'Other',           '#C9CED6', false, 1000,  8);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.seed_new_user();
```

**Budget history (multi-year).** Budgets change over time, and past months must keep the budget they actually had. `budget_history` is the source of truth for any month's budget. `expense_settings.monthly_budget` and `categories.monthly_budget` only hold the current values the Settings form edits. Saving Settings updates those columns and upserts the history row for the current month. Add this as `supabase/migrations/0002_budget_history.sql`:

```sql
create table public.budget_history (
  user_id uuid not null references auth.users(id) on delete cascade,
  effective_month date not null check (extract(day from effective_month) = 1),
  monthly_budget numeric(12,2) not null check (monthly_budget >= 0),
  category_budgets jsonb not null default '{}'::jsonb,  -- {"food": 7000, ...}; missing key = no limit
  created_at timestamptz not null default now(),
  primary key (user_id, effective_month)
);

alter table public.budget_history enable row level security;
create policy own_budget_history on public.budget_history for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- seed a first row on signup
create or replace function public.seed_budget_history() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.budget_history (user_id, effective_month, monthly_budget, category_budgets)
  values (new.id, date_trunc('month', now() at time zone 'Asia/Manila')::date, 25000,
    '{"food":7000,"transport":3500,"living":12000,"gifts":2000,"shopping":2000,"subs":2000,"leisure":2000,"other":1000}');
  return new;
end $$;

create trigger on_auth_user_created_budget
  after insert on auth.users
  for each row execute function public.seed_budget_history();
```

The budget for month M is the row with the latest `effective_month` ≤ M. Months before the first row use the earliest row. The client fetches every history row once (a handful of rows) and resolves it in `lib/expense-stats.ts`.

- Add a generic `set_updated_at` trigger on `expenses` and `expense_settings`.
- Generate types with `supabase gen types typescript` into `src/app/core/database.types.ts`, then use them everywhere.
- Data volume is roughly 30–60 rows a month, so the client fetches the selected year plus the previous year in one query (well under 1,500 rows) and computes stats in memory. No SQL views are needed yet.

## Auth and login gate

Use Supabase Auth for one user. Signups are closed once that account exists.

1. Create the account once (email + password) in the Supabase dashboard. Then turn **Allow new users to sign up** off.
2. Optional: enable Google OAuth in Supabase and add the Vercel domain to its redirect URLs.
3. Defense in depth: every `/api` function verifies the caller's Supabase JWT (`Authorization: Bearer <access_token>`) and rejects any user id that isn't `ALLOWED_USER_ID`.
4. Angular: `authGuard` redirects to `/login` when there is no session. `/login` redirects to `/` when a session exists. The session persists via the Supabase client.
5. Log out with `supabase.auth.signOut()`, then route to `/login`.
6. Recommended: turn on MFA (TOTP) in Supabase Auth. The login screen shows a code step when the account has a factor enrolled.

**Login screen** (mockup: "Login gate"): split layout with a dark brand panel on the left and the form on the right. It has email, password, a "Forgot?" link (Supabase reset email), Log in, and Continue with Google. Show inline errors under the form, never as alerts.

## Expenses module

This is the most important module. Match the "Expense tracker" artboard in the mockup. The page tracks spending only and is organized by month and by nature of purchase.

**Page order, top to bottom**

1. Header: "Expenses · October 2026", a subtitle ("Month in progress · 1–24 Oct" or "Full month"), a **Settings** button and a **+ Add manually** button.
2. Settings panel (inline, shown when opened).
3. Quick add (AI): a dark panel with a text input and a Parse button.
4. Manual add form (inline, shown when opened).
5. Month tabs.
6. Stat cards (6).
7. AI insights panel (orange). Hidden when insights are off in Settings.
8. Daily spending chart + category donut.
9. Last 6 months chart + biggest expenses.
10. **Advanced breakdown** toggle button, then the advanced charts.
11. Expense table with category filter chips.

### Month and year selection

- **Year switcher** (‹ 2026 ›) sits left of the month tabs. It runs from the year of the first expense to the current year, and its arrows disable at both ends.
- **Month tabs:**
    - Past years show January to December. The current year shows January to the current month.
    - Months with no expenses get a dashed, greyed border but stay clickable. They show the empty state: "No expenses in February 2025 — your records start in March 2025", with Go to first month and Add buttons.
    - A **Year** tab at the end of the row opens the year overview (below).
- URL: `/expenses?m=2026-10` for a month and `/expenses?y=2025` for a year overview. The default is the current month of the current year. Switching years keeps the month, clamped to the current month in the current year.
- Every stat, chart, insight and table follows the selection. Compute everything from real dates (`spent_on`), never month indexes, so comparisons cross year boundaries.
- A month is **current** when it contains today in Asia/Manila. Its `daysCounted` is today's day of the month. Past months use their full length.
- v1 uses calendar months. `cycle_start_day` is stored, but the setting stays disabled with "coming soon" until Phase 3b.

### Year overview

| Widget | Details |
|---|---|
| Stat cards | Spent (year to date for the current year), monthly average across months with records, and vs last year. vs last year uses the same months only (both years need records; the current month is cut at today's day in both), e.g. "Same months (Mar–Oct 24) in 2025: ₱X". Also months under budget (completed months only, each against its own `budget_history` budget), top category, and biggest month |
| Monthly spending vs budget | 12 bars, Jan–Dec. `--accent` when under budget, `--warn` when over, light blue for the month in progress, a grey stub for no records. A dark tick on each bar marks that month's budget, so budget changes are visible. Clicking a bar opens that month |
| By nature of purchase | Doughnut + legend for the whole year |
| This year vs last year by category | Paired bars per category (this year blue, last year grey) over the same months, with % change. Shows "No 2024 records to compare yet" when the years don't overlap |
| By month | Table, newest first: Month (links to it), Spent, Budget, under/over, Top category |

### Stat cards

Implement as pure functions in `lib/expense-stats.ts` with unit tests.

| Card | Value | Subtext |
|---|---|---|
| Total spent | sum(amount) for the month | "{count} expenses" |
| Daily average | total ÷ daysCounted | "over {daysCounted} days" |
| vs last month | (total − prev) ÷ prev, signed % | "more/less than Sep 1–24 (₱X)". For a current month, prev = last month's spend on days ≤ today's day (clamped to that month's length); otherwise last month's full total. January compares against December of the previous year. Up = `--warn-ink`, down = `--accent-ink` |
| Top category | category with the largest sum | "₱X · Y% of spend" |
| Biggest day | max single-day total | the date |
| Budget used | total ÷ effective budget, as % with a progress bar | "₱X left of ₱B" or "₱X over ₱B". Turns warn when > 100%. "No budget set" when the budget is 0 |

- A month's budget comes from `budget_history` (latest `effective_month` ≤ that month). Never use current settings for past months.
- Effective budget = that budget. When rollover is on, add max(0, last month's budget − last month's total). December rolls into January the same way.
- Projected month-end for a current month = fixed spend so far (categories with `is_fixed`) + variable spend ÷ daysCounted × daysInMonth. Rent and other fixed costs are counted once, not extrapolated. For past months, projected = total.
- Budget alert: when budget used ≥ `alert_threshold_pct`, show a dismissible banner above the stats (and later on Home): "You've used 82% of your October budget with 7 days left."

### Charts (always visible)

| Chart | Type | Details |
|---|---|---|
| Daily spending | Bar, one per day | Future days are a flat grey stub. The peak day uses `--warn`. Tooltip shows date + ₱. X labels at 1, 8, 15, 22, 29 |
| By nature of purchase | Doughnut | Total in the center. Legend sorted by amount with % and ₱. Zero categories hidden |
| Last 6 months | Bar, totals | Ends at the selected month, which is `--ink`; the others are #C7D2FF. Clicking a bar selects that month. When the 6 months span two years, every label carries its year (Dec ’25, Jan ’26) |
| Biggest expenses | List | Top 5 single expenses: description, category · date, amount |

### Advanced breakdown (collapsed by default)

One full-width toggle button: "Advanced breakdown ▾" / "Hide advanced breakdown ▴", with `aria-expanded`. Remember its state in `localStorage`.

| Chart | Type | Details |
|---|---|---|
| Spending pace vs budget | Line | Solid cumulative actual through today. Dashed projection from today to month-end. Dashed `--warn` horizontal budget line. One summary sentence below ("At this pace you'll spend ₱27,900 by Oct 31 — ₱2,900 over your ₱25,000 budget.") |
| Category budgets | Progress bars | Only categories with a budget. Shows "₱used / ₱budget" and %. The bar turns `--warn` when > 100%. An Edit button opens Settings |
| Categories over 6 months | Stacked bar | One stack per month, segments in category colors, the selected month outlined, legend below |
| By day of week | Bar, Mon–Sun | Sum per weekday for the month. The heaviest day uses `--warn`, with a note "Sat is your heaviest day" |
| How you pay | 100% stacked horizontal bar + list | GCash / Card / Cash / Bank with % and ₱ |
| Fixed vs variable | 100% stacked bar | Fixed = categories with `is_fixed`. Also shows the average per expense |

### Expense table

- Rows for the selected month, sorted by `spent_on` desc, then `created_at` desc.
- Columns: Date ("Oct 24"), Description, Category (colored dot + label), Paid with, Amount (right-aligned, mono).
- Filter chips: All + each category. The header shows "{n} shown · ₱{sum of shown}".
- The table scrolls inside a box with a max height of 560 px. The header row is sticky, and it scrolls horizontally on phones.
- Clicking a row opens an edit drawer with every field editable. Delete asks for confirmation.

### Adding expenses

- **Manual form:** Amount (₱, > 0, max 2 decimals), Category, Date (default today), Paid with (default from settings), Description (required, ≤ 200 chars). Save inserts with `source = 'manual'` and closes the form.
- **Quick add:** free text like "grab to ATC 186, coffee 140, gift for mama 1,500". Parse calls `/api/expenses/parse` and shows one preview row per expense. Each row's category, amount, description and date are editable. "Save N expenses" bulk-inserts them with `source = 'ai'`. When parsing fails, show an inline error and open the manual form with the text prefilled in Description.
- After any insert, edit or delete, recompute the stats and invalidate that month's insight cache.

### Settings panel

| Field | Stored in | Notes |
|---|---|---|
| Monthly budget (₱) | expense_settings.monthly_budget | Number input with thousands separators. Saving upserts budget_history for the current month, so past months keep their budget. The panel lists the budget history ("From Jan 2026 ₱25,000 · From Mar 2025 ₱22,000") and says "Changes apply from October 2026 onward" |
| Default payment method | expense_settings.default_payment_method | Prefills both forms |
| Warn me at | expense_settings.alert_threshold_pct | 80 / 90 / 100% |
| Budget month starts | expense_settings.cycle_start_day | Disabled in v1 ("coming soon") |
| Category budgets | categories.monthly_budget | One input per category, saved into the same budget_history row. Empty = no limit. Shows "Total ₱X of ₱B monthly budget", in warn color when the total exceeds the budget |
| Show AI insights | expense_settings.ai_insights_enabled | Hides the panel and skips the Gemini calls |
| Include expenses in weekly digest | expense_settings.include_in_digest |  |
| Roll unused budget into next month | expense_settings.rollover_enabled |  |

Buttons: **Reset to defaults** (seed values) and **Done** (saves everything in one go, shows a toast, and closes the panel). Validate inline. A failed save keeps the panel open with an error.

### States

- Loading: skeleton cards and charts, never layout jumps.
- Empty month: "No expenses in March yet" plus Add buttons. Charts show an empty state, not zero bars.
- Errors: an inline message with a Retry button.

## AI features

Three Vercel functions call Gemini. All three work without AI too: each has a deterministic fallback so the page never breaks on a 429.

**Shared rules (`api/_lib/gemini.ts`)**

- Use the `@google/genai` SDK, with the model from `GEMINI_MODEL` and a 15 s timeout. Retry once on 5xx.
- On `429 RESOURCE_EXHAUSTED`, return HTTP 429 with `{ error: "AI is busy — try again in a minute" }`. The UI shows that message inline.
- Always request structured output (`responseMimeType: "application/json"` + `responseSchema`). Validate the response with zod before using it.
- Each function first verifies the user's JWT and then reads data with the service role, scoped to that user id.

| Endpoint | Input | Sends to Gemini | Output | Fallback |
|---|---|---|---|---|
| `POST /api/expenses/parse` | `{ text ≤ 500 chars, today }` | Only the typed text | `{ items: [{ description, amount, category_slug, spent_on, payment_method }], source }` | Rule-based parser (below) |
| `POST /api/expenses/insights` | `{ month: "2026-10", force? }` | Aggregates only, never raw rows | `{ insights: [{ text }], cached }` | The 4 template insights |
| `POST /api/expenses/ask` | `{ question ≤ 300 chars, month }` | That month's rows + 6-month aggregates | `{ answer }` | "AI is unavailable right now" |

### Parse (quick add)

System prompt essentials:

- Split the text into separate expenses. Inputs mix English, Filipino and Taglish ("groceries sa Puregold", "pamasahe", "kahapon").
- Amounts are PHP. "1.5k" means 1500 and "1,240" means 1240. Never invent an amount; skip items without one.
- Categorize by nature of purchase into exactly one slug: food, transport, living, gifts, shopping, subs, leisure, other.
- Hints: Grab, Angkas, jeep, MRT, gas → transport. Rent, Meralco, water, internet → living. Spotify, Netflix, hosting → subs. gift, regalo → gifts. Shopee, Lazada → shopping.
- Resolve relative dates against `today`. Leave payment_method null unless it's stated ("via GCash").

Rule-based fallback: split on commas and "and", take the last number in each chunk as the amount, and map keywords to slugs with the hint list above (default `other`). Return `source: "rules"` so the UI can say "Parsed without AI — check categories".

### Insights

1. On the server, compute aggregates with `lib/expense-stats.ts`: totals, per-category this month vs the comparable part of last month, projection, effective budget, over-budget categories, and the most frequent description in the top category with its count.
2. Hash the aggregates (sha256). If `ai_insight_cache` has the same hash for that month and `force` is not set, return the cache.
3. Otherwise ask Gemini for 3–4 insights, each ≤ 30 words. Each one must cite a ₱ figure or %. Plain tone, no lecturing, no advice outside spending. Store the result in the cache.
4. Limit Refresh (`force: true`) to once per minute.
5. Skip the call entirely when `ai_insights_enabled` is false.

The template insights double as few-shot examples:

- "At this pace you'll spend ₱27,900 by Oct 31 — ₱2,900 over your ₱25,000 budget."
- "Food is 31% of your spending — “Coffee” alone shows up 7×."
- "Transport is up ₱640 vs Sep 1–24."
- "Food and Gifts are already past their category budget."

### Ask

- The prompt says to answer only from the provided data, show the ₱ figure, stay under 80 words, and reply "I can't tell from your data" when the data doesn't cover the question.
- The UI shows small helper text under the input: "Sends this month's expenses to Gemini."

**Privacy:** free-tier Gemini prompts may be used to improve Google's products. Parse sends only what the user typed, insights sends only aggregates, and Ask sends rows only when the user asks. Moving to a paid tier removes this concern but costs money, so ask the user before enabling billing.

## Weekly digest and cron jobs

The digest goes out Sunday at 8:00 PM Manila time, which is Sunday 12:00 UTC. Vercel Hobby may fire it anytime within that hour.

```json
// vercel.json
{
  "crons": [
    { "path": "/api/cron/keepalive",     "schedule": "0 1 * * *" },
    { "path": "/api/cron/weekly-digest", "schedule": "0 12 * * 0" }
  ]
}
```

- Both cron functions reject any request whose `Authorization` header isn't `Bearer ${CRON_SECRET}`. Vercel sends this header automatically when `CRON_SECRET` is set.
- `keepalive`: one `select 1` through Supabase so the free project never pauses.
- `weekly-digest`:
    - Covers the week Monday 00:00 → Sunday 20:00 Manila.
    - Reads the modules that exist so far. In Phase 4 that's expenses only: week total, vs the previous week, top category, budget used for the month, and the top insight. Later phases add journal Win/Target entries, goal deltas and job-agent counts.
    - Asks Gemini (aggregates only) to draft the subject plus up to 5 wins and 4 targets. Fallback: a template digest built from the numbers.
    - Renders the HTML email (mockup: "Weekly digest email") and sends it with Resend from `onboarding@resend.dev` (or a verified domain later) to `DIGEST_TO_EMAIL`.
    - Logs each send in a `digest_runs` table (week_start, sent_at, status, resend_id) so a retry never double-sends.
    - Respect `include_in_digest`. If every module is opted out, skip sending.
- The in-app `/digest` page renders the same template for the current week and has a **Send test** button.

## Other modules (Phase 5)

Build these after Expenses and the digest ship. Each one adds its own migration, page and digest reader. Follow the matching artboard in the mockup.

| Module | Tables (all with `user_id` + owner-only RLS) | Page essentials | Feeds digest/Home with |
|---|---|---|---|
| Home | none (reads others) | Greeting + date, 4 summary cards, this week's wins/targets, recent expenses, top job matches, goal progress | n/a |
| Goals | `goals` (year, area, title, progress_pct, status, next_step), `goal_milestones` (goal_id, quarter 1–4, label, state: done/current/todo) | Year tabs (2026, 2027 draft), Q4 banner, goal cards with 4 quarter chips, + New goal | Progress change this week, goals behind pace |
| Job agent | `job_matches` (title, company, location, work_mode, match_pct, reason, url, posted_at, status: new/saved/applied/interviewing/dismissed), `agent_runs` (ran_at, found, status) | Agent status strip, pipeline counts, filter chips, match list with Dismiss / Save / Mark applied | New matches this week, applications sent |
| Journal | `journal_entries` (entry_date, prompt, body, tag: win/target/lesson/note, goal_id null) | Today's prompt + textarea, tag pills, link-to-goal select, this week's list, streak | Win and Target entries become digest bullets |

**Job agent integration:** the existing Python bot runs as a GitHub Actions cron (`schedule: '0 23 * * *'` = 7:00 AM Manila). It writes to `job_matches` and `agent_runs` with the Supabase service-role key stored in GitHub secrets. Upsert on `url` to avoid duplicates, and keep its existing message notification. The **Run now** button triggers the workflow through the GitHub `workflow_dispatch` API from a Vercel function, using a fine-grained token kept in env vars.

**Privacy:** journal text never goes to Gemini automatically. Only entries tagged Win or Target are summarized for the digest, and only if the user enables that in Journal settings (default off).

## Environment variables and deployment

Only the two `NG_APP_` values reach the browser. Everything else is server-only, set in Vercel project settings and in a local `.env` that is git-ignored. Commit a `.env.example` with empty values.

| Variable | Where | Purpose |
|---|---|---|
| `NG_APP_SUPABASE_URL` | Browser + server | Supabase project URL |
| `NG_APP_SUPABASE_ANON_KEY` | Browser + server | Public anon key (safe with RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Cron jobs + AI functions (bypasses RLS, always scope by user id) |
| `ALLOWED_USER_ID` | Server only | The one auth user id permitted |
| `GEMINI_API_KEY` | Server only | From Google AI Studio |
| `GEMINI_MODEL` | Server only | A free-tier Flash or Flash-Lite model id |
| `RESEND_API_KEY` | Server only | Resend |
| `DIGEST_TO_EMAIL` | Server only | Must match the Resend account email until a domain is verified |
| `CRON_SECRET` | Server only | Protects the `/api/cron/*` routes |
| `GITHUB_DISPATCH_TOKEN` | Server only (Phase 5) | Triggers the job-agent workflow |

**Deploy steps**

1. Create the Supabase project (region closest to Manila, e.g. Singapore). Run the migrations with the Supabase CLI.
2. Create the user, disable signups, and copy the user id into `ALLOWED_USER_ID`.
3. Import the repo into Vercel (Hobby), set the env vars, and deploy. In `vercel.json`, rewrite all non-`/api` paths to `index.html` for Angular routing.
4. Confirm both crons appear under Vercel → Settings → Cron Jobs. Trigger them once manually to test.
5. Add the Vercel URL to Supabase Auth → URL configuration (site URL + redirect URLs).

## Build phases

Ship each phase to Vercel before starting the next. Tick its criteria as they pass.

### Phase 0 — Setup

- [ ] Angular app scaffolded with standalone components, ESLint, Prettier, and `@ngx-env/builder` for `NG_APP_*` env vars
- [ ] Supabase project and CLI linked; migration `0001_expenses.sql` applied
- [ ] Design tokens and fonts in place; app shell with sidebar (Home, Expenses, Goals, Job agent, Journal, Weekly digest, + Add a tool)
- [ ] Deployed to Vercel with env vars set

### Phase 1 — Auth

- [ ] Login with email + password works; unknown users are rejected; signups are disabled
- [ ] Every route except `/login` is guarded; logout works
- [ ] Signup trigger seeded settings + 8 categories (verify in the DB)

### Phase 2 — Expenses core

- [ ] Manual add, edit and delete (with confirm) work and persist
- [ ] Month tabs + `?m=YYYY-MM` deep link; every widget follows the selected month
- [ ] All 6 stat cards match `lib/expense-stats.ts`; unit tests cover the current-month comparison, empty months, and a 0 budget
- [ ] Daily, donut, 6-month and biggest-expenses widgets render; clicking a 6-month bar switches months
- [ ] Table with category filter chips, a shown-count + total, a scroll box and a sticky header
- [ ] Loading, empty and error states; usable at 390 px width

- [ ] Year switcher + Year tab; empty months greyed with the empty state; `?y=YYYY` deep link
- [ ] January compares with December of the previous year; the 6-month chart labels years when it spans two
- [ ] Year overview: stat cards, monthly-vs-budget bars with per-month budget ticks, category doughnut, year-vs-year by category, by-month table
- [ ] Past months are judged against their own `budget_history` row; changing the budget never alters past months

### Phase 3a — Settings, advanced breakdown, AI

- [ ] Settings panel saves to `expense_settings, categories and the current month's budget_history row`; Reset restores defaults
- [ ] Budget-used card, alert banner and rollover behave as specified
- [ ] Advanced breakdown toggle + all 6 advanced charts; open state remembered
- [ ] `/api/expenses/parse` with preview + edit before save; the rule fallback works when Gemini is unavailable
- [ ] `/api/expenses/insights` with cache + hash; Refresh is rate-limited; hidden when disabled
- [ ] `/api/expenses/ask` answers from data with the privacy helper text shown
- [ ] No API key appears in the browser bundle (check with a production build search)

### Phase 3b — Budget cycle start (stretch)

- [ ] Months follow `cycle_start_day` (1 / 15 / 30) across tabs, stats, charts and the digest

### Phase 4 — Digest + crons

- [ ] `keepalive` and `weekly-digest` crons are registered and protected by `CRON_SECRET`
- [ ] The digest email arrives on Sunday; `digest_runs` prevents double sends; the template fallback works
- [ ] `/digest` preview + Send test

### Phase 5 — Other modules

- [ ] Goals, Journal, Job agent (GitHub Actions writing to Supabase), then Home, each with its digest reader

**Open questions for the user** (ask when the relevant phase starts):

- Which channel does the job agent currently message (Telegram, Messenger, email)? Keep it or move it to the Portal only?
- Real monthly and category budgets to replace the seed values?
- Buy a domain later for a custom Resend sender? It costs money, so this needs approval.
