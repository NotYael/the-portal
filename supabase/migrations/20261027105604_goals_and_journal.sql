-- Goals (yearly goals with quarterly milestones) and Journal (tagged daily entries).

-- ---------- goals ----------

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  year int not null check (year between 2000 and 2100),
  area text not null check (char_length(area) between 1 and 40),
  title text not null check (char_length(title) between 1 and 200),
  progress_pct int not null default 0 check (progress_pct between 0 and 100),
  status text not null default 'on_track' check (status in ('on_track', 'behind', 'done')),
  next_step text not null default '' check (char_length(next_step) <= 200),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index goals_user_year_idx on public.goals (user_id, year);

create trigger goals_set_updated_at
  before update on public.goals
  for each row execute function private.set_updated_at();

create table public.goal_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid not null references public.goals (id) on delete cascade,
  quarter smallint not null check (quarter between 1 and 4),
  label text not null default '' check (char_length(label) <= 60),
  state text not null default 'todo' check (state in ('done', 'current', 'todo')),
  unique (goal_id, quarter)
);

create index goal_milestones_user_idx on public.goal_milestones (user_id);

-- ---------- journal ----------

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_date date not null default ((now() at time zone 'Asia/Manila')::date),
  prompt text not null default '' check (char_length(prompt) <= 300),
  body text not null check (char_length(body) between 1 and 20000),
  tag text not null default 'note' check (tag in ('win', 'target', 'lesson', 'note')),
  goal_id uuid references public.goals (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index journal_entries_user_date_idx on public.journal_entries (user_id, entry_date desc);
create index journal_entries_goal_idx on public.journal_entries (goal_id);

create trigger journal_entries_set_updated_at
  before update on public.journal_entries
  for each row execute function private.set_updated_at();

-- ---------- row-level security ----------

alter table public.goals enable row level security;
alter table public.goal_milestones enable row level security;
alter table public.journal_entries enable row level security;

revoke all on table public.goals, public.goal_milestones, public.journal_entries from anon, authenticated;
grant select, insert, update, delete on table public.goals, public.goal_milestones, public.journal_entries
  to authenticated, service_role;

create policy "Owner manages their goals"
  on public.goals for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Owner manages milestones on their goals"
  on public.goal_milestones for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.goals g
      where g.id = goal_id and g.user_id = (select auth.uid())
    )
  );

create policy "Owner manages their journal entries"
  on public.journal_entries for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      goal_id is null
      or exists (
        select 1 from public.goals g
        where g.id = goal_id and g.user_id = (select auth.uid())
      )
    )
  );
