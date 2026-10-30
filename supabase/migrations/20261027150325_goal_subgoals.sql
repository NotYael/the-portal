-- Sub-goals: a checklist under each goal. A goal with sub-goals takes its
-- progress from them (done ÷ total, rounded) and is 'done' once every one is
-- ticked; unticking one moves a done goal back to 'on_track'. A goal without
-- sub-goals keeps the progress_pct it has.

create table public.goal_subgoals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid not null references public.goals (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  done boolean not null default false,
  done_at timestamptz,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index goal_subgoals_goal_idx on public.goal_subgoals (goal_id, sort_order);
create index goal_subgoals_user_idx on public.goal_subgoals (user_id);

-- done_at: when it was ticked; cleared when unticked.
create or replace function private.stamp_subgoal_done()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not new.done then
    new.done_at := null;
  elsif tg_op = 'INSERT' or not old.done then
    new.done_at := now();
  end if;
  return new;
end;
$$;

-- Recomputes the goal(s) a sub-goal change touched. Runs as the user, so RLS
-- still limits it to their own goals.
create or replace function private.sync_goal_progress()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  targets uuid[];
  target uuid;
  total int;
  finished int;
begin
  if tg_op = 'INSERT' then
    targets := array[new.goal_id];
  elsif tg_op = 'DELETE' then
    targets := array[old.goal_id];
  elsif new.goal_id is distinct from old.goal_id then
    targets := array[old.goal_id, new.goal_id];
  else
    targets := array[new.goal_id];
  end if;

  foreach target in array targets loop
    select count(*), count(*) filter (where done) into total, finished
    from public.goal_subgoals
    where goal_id = target;

    if total > 0 then
      update public.goals
      set progress_pct = round(100.0 * finished / total)::int,
          status = case
            when finished = total then 'done'
            when status = 'done' then 'on_track'
            else status
          end
      where id = target;
    end if;
  end loop;
  return null;
end;
$$;

revoke execute on function private.stamp_subgoal_done(), private.sync_goal_progress()
  from public, anon, authenticated;

create trigger goal_subgoals_stamp_done
  before insert or update of done on public.goal_subgoals
  for each row execute function private.stamp_subgoal_done();

create trigger goal_subgoals_sync_progress
  after insert or delete or update of done, goal_id on public.goal_subgoals
  for each row execute function private.sync_goal_progress();

-- ---------- row-level security ----------

alter table public.goal_subgoals enable row level security;

revoke all on table public.goal_subgoals from anon, authenticated;
grant select, insert, update, delete on table public.goal_subgoals to authenticated, service_role;

create policy "Owner manages sub-goals on their goals"
  on public.goal_subgoals for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.goals g
      where g.id = goal_id and g.user_id = (select auth.uid())
    )
  );
