-- Weekly digest send log. The Sunday cron writes it with the service role;
-- the one-send-per-week index makes a retry never double-send.

create table public.digest_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1), -- Monday, Asia/Manila
  status text not null check (status in ('sent', 'failed', 'skipped')),
  is_test boolean not null default false,    -- "Send test" from /digest
  sent_at timestamptz,
  resend_id text,
  error text,
  created_at timestamptz not null default now()
);

create unique index digest_runs_one_send_per_week
  on public.digest_runs (user_id, week_start)
  where status = 'sent' and not is_test;

create index digest_runs_user_created_idx on public.digest_runs (user_id, created_at desc);

alter table public.digest_runs enable row level security;

revoke all on table public.digest_runs from anon, authenticated;
grant select on table public.digest_runs to authenticated;
grant select, insert, update, delete on table public.digest_runs to service_role;

create policy "Owner can read their digest runs"
  on public.digest_runs for select to authenticated
  using ((select auth.uid()) = user_id);
