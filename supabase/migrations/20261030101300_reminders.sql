-- Reminders: things to remember weeks from now (renewals, "push a commit before
-- GitHub turns off the keep-alive"). A reminder is a one-off or repeats every
-- N days/weeks/months. Marking a repeating one done moves due_on forward;
-- marking a one-off done sets done_at. The Sunday digest cron reads them with
-- the service role.

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  notes text not null default '' check (char_length(notes) <= 1000),
  due_on date not null,                      -- calendar date in Asia/Manila
  repeat_every int check (repeat_every between 1 and 365),
  repeat_unit text check (repeat_unit in ('day', 'week', 'month')),
  done_at timestamptz,                       -- one-offs only
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reminders_repeat_pair check ((repeat_every is null) = (repeat_unit is null)),
  constraint reminders_repeating_never_done check (repeat_every is null or done_at is null)
);

create index reminders_user_due_idx on public.reminders (user_id, due_on);

create trigger reminders_set_updated_at
  before update on public.reminders
  for each row execute function private.set_updated_at();

alter table public.reminders enable row level security;

revoke all on table public.reminders from anon, authenticated;
grant select, insert, update, delete on table public.reminders to authenticated;
grant select, insert, update, delete on table public.reminders to service_role;

create policy "Owner manages their reminders"
  on public.reminders for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
