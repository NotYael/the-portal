-- Job agent. The Python bot (separate repo, GitHub Actions) writes matches and
-- runs with the service role key, setting user_id explicitly. The Portal only
-- reads matches and changes their status.

create table public.job_matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null,                      -- board, e.g. 'himalayas', 'remoteok'
  source_id text not null,                   -- the agent's stable "<source>:<id>"
  title text not null,
  company text not null default '',
  location text not null default '',
  hq text,                                   -- company HQ country as judged by the agent; null when unclear
  url text not null,
  salary text,
  job_type text,
  work_mode text check (work_mode in ('remote', 'hybrid', 'onsite')),
  match_pct smallint not null check (match_pct between 0 and 100),
  reason text not null default '',
  posted_at timestamptz,
  found_at timestamptz not null default now(),
  status text not null default 'new'
    check (status in ('new', 'saved', 'applied', 'interviewing', 'dismissed')),
  status_changed_at timestamptz,
  -- The agent inserts with ON CONFLICT DO NOTHING on this key, so finding a
  -- job again never resets a status the user already set.
  unique (user_id, source_id)
);

create index job_matches_user_status_idx on public.job_matches (user_id, status, match_pct desc);

create or replace function private.stamp_job_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;
  return new;
end;
$$;

revoke execute on function private.stamp_job_status() from public, anon, authenticated;

create trigger job_matches_stamp_status
  before update on public.job_matches
  for each row execute function private.stamp_job_status();

create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ran_at timestamptz not null default now(),
  triggered_by text not null default 'schedule' check (triggered_by in ('schedule', 'manual')),
  status text not null check (status in ('success', 'failed')),
  fetched int not null default 0 check (fetched >= 0),
  candidates int not null default 0 check (candidates >= 0),
  matched int not null default 0 check (matched >= 0),
  error text
);

create index agent_runs_user_ran_idx on public.agent_runs (user_id, ran_at desc);

-- ---------- row-level security ----------

alter table public.job_matches enable row level security;
alter table public.agent_runs enable row level security;

-- The user can read and delete matches but only change their status.
revoke all on table public.job_matches, public.agent_runs from anon, authenticated;
grant select, delete on table public.job_matches to authenticated;
grant update (status) on table public.job_matches to authenticated;
grant select on table public.agent_runs to authenticated;
grant select, insert, update, delete on table public.job_matches, public.agent_runs to service_role;

create policy "Owner can read their job matches"
  on public.job_matches for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Owner can update their job matches"
  on public.job_matches for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Owner can delete their job matches"
  on public.job_matches for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Owner can read their agent runs"
  on public.agent_runs for select to authenticated
  using ((select auth.uid()) = user_id);
