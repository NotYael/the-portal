-- Expenses module (docs/PORTAL_SPEC.md → Database schema).
-- All money is PHP as numeric(12,2); all dates are Asia/Manila calendar dates.

-- ---------- categories ----------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z][a-z0-9_]{0,31}$'),
  label text not null check (char_length(label) between 1 and 40),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  is_fixed boolean not null default false,
  monthly_budget numeric(12, 2) check (monthly_budget is null or monthly_budget >= 0), -- null = no limit
  sort_order int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, slug)
);

-- ---------- expenses ----------

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id uuid not null references public.categories (id),
  amount numeric(12, 2) not null check (amount > 0),
  spent_on date not null default ((now() at time zone 'Asia/Manila')::date),
  description text not null check (char_length(description) between 1 and 200),
  payment_method text not null check (payment_method in ('gcash', 'card', 'cash', 'bank')),
  source text not null default 'manual' check (source in ('manual', 'ai')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index expenses_user_date_idx on public.expenses (user_id, spent_on desc);
create index expenses_category_idx on public.expenses (category_id);

create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute function private.set_updated_at();

-- ---------- settings ----------

create table public.expense_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  monthly_budget numeric(12, 2) not null default 25000 check (monthly_budget >= 0),
  default_payment_method text not null default 'gcash'
    check (default_payment_method in ('gcash', 'card', 'cash', 'bank')),
  alert_threshold_pct int not null default 80 check (alert_threshold_pct in (80, 90, 100)),
  cycle_start_day int not null default 1 check (cycle_start_day in (1, 15, 30)),
  ai_insights_enabled boolean not null default true,
  include_in_digest boolean not null default true,
  rollover_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create trigger expense_settings_set_updated_at
  before update on public.expense_settings
  for each row execute function private.set_updated_at();

-- ---------- budget history ----------
-- The source of truth for any month's budget: the row with the latest
-- effective_month <= that month. Saving Settings upserts the current month's
-- row, so past months keep the budget they actually had.

create table public.budget_history (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  effective_month date not null check (extract(day from effective_month) = 1),
  monthly_budget numeric(12, 2) not null check (monthly_budget >= 0),
  -- {"food": 7000, ...}; a missing key = no limit for that category
  category_budgets jsonb not null default '{}'::jsonb check (jsonb_typeof(category_budgets) = 'object'),
  created_at timestamptz not null default now(),
  primary key (user_id, effective_month)
);

-- ---------- AI insight cache ----------
-- Written only by the API with the service role; the user may read it.

create table public.ai_insight_cache (
  user_id uuid not null references auth.users (id) on delete cascade,
  month date not null check (extract(day from month) = 1), -- first day of the month
  data_hash text not null,                                 -- sha256 of the aggregates sent to Gemini
  insights jsonb not null check (jsonb_typeof(insights) = 'array'), -- [{"text": "..."}]
  generated_at timestamptz not null default now(),
  primary key (user_id, month)
);

-- ---------- row-level security ----------

alter table public.categories enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_settings enable row level security;
alter table public.budget_history enable row level security;
alter table public.ai_insight_cache enable row level security;

revoke all on table
  public.categories, public.expenses, public.expense_settings, public.budget_history, public.ai_insight_cache
  from anon, authenticated;

grant select, insert, update, delete on table public.categories to authenticated;
grant select, insert, update, delete on table public.expenses to authenticated;
grant select, insert, update on table public.expense_settings to authenticated;
grant select, insert, update on table public.budget_history to authenticated;
grant select on table public.ai_insight_cache to authenticated;

grant select, insert, update, delete on table
  public.categories, public.expenses, public.expense_settings, public.budget_history, public.ai_insight_cache
  to service_role;

create policy "Owner manages their categories"
  on public.categories for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Owner manages their expenses"
  on public.expenses for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.categories c
      where c.id = category_id and c.user_id = (select auth.uid())
    )
  );

create policy "Owner manages their expense settings"
  on public.expense_settings for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Owner manages their budget history"
  on public.budget_history for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Owner can read their cached insights"
  on public.ai_insight_cache for select to authenticated
  using ((select auth.uid()) = user_id);
