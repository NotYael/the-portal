-- Countdowns: a 1, 3 or 6 month timer shown big on Home and small in the
-- sidebar. Once started it can't be stopped: `authenticated` may only read and
-- insert (no update/delete grant or policy), the trigger sets started_at and
-- ends_at itself, and a new one is refused while another is still running.
-- Finished rows stay as history.

create table public.countdowns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  months int not null check (months in (1, 3, 6)),
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  constraint countdowns_ends_after_start check (ends_at > started_at)
);

create index countdowns_user_started_idx on public.countdowns (user_id, started_at desc);

create or replace function private.countdowns_before_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Serializes starts per user, so two tabs can't both start one.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('countdowns:' || new.user_id::text, 0));
  if exists (
    select 1 from public.countdowns c
    where c.user_id = new.user_id and c.ends_at > pg_catalog.now()
  ) then
    raise exception 'a countdown is already running' using errcode = '55000';
  end if;
  -- The server's clock decides; months are added on the Manila calendar.
  new.started_at := pg_catalog.now();
  new.ends_at := ((pg_catalog.now() at time zone 'Asia/Manila') + pg_catalog.make_interval(months => new.months))
    at time zone 'Asia/Manila';
  return new;
end;
$$;

revoke execute on function private.countdowns_before_insert() from public, anon, authenticated;

create trigger countdowns_before_insert
  before insert on public.countdowns
  for each row execute function private.countdowns_before_insert();

alter table public.countdowns enable row level security;

revoke all on table public.countdowns from anon, authenticated;
grant select on table public.countdowns to authenticated;
grant insert (title, months) on table public.countdowns to authenticated;
grant select, insert, update, delete on table public.countdowns to service_role;

create policy "Owner reads their countdowns"
  on public.countdowns for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Owner starts a countdown"
  on public.countdowns for insert to authenticated
  with check ((select auth.uid()) = user_id);
