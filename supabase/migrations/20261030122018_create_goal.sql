-- Creating a goal in one transaction: the goal, its four quarterly
-- milestones and its first sub-goals, so a failed save leaves nothing half
-- made. The sub-goal trigger (…_goal_subgoals.sql) sets progress and status.
-- SECURITY INVOKER: it runs as the caller, so RLS and the table grants apply.

create or replace function public.create_goal(
  p_year int,
  p_area text,
  p_title text,
  p_next_step text,
  -- Q1–Q4 labels, in order
  p_milestones text[],
  -- sub-goal titles, in order
  p_subgoals text[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  new_id uuid;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if coalesce(array_length(p_milestones, 1), 0) <> 4 then
    raise exception 'a goal needs four milestones' using errcode = '22023';
  end if;

  -- New goals go after the year's other goals.
  insert into public.goals (year, area, title, next_step, sort_order)
  values (
    p_year, p_area, p_title, p_next_step,
    coalesce((select max(g.sort_order) + 1 from public.goals g where g.user_id = uid and g.year = p_year), 0)
  )
  returning id into new_id;

  insert into public.goal_milestones (goal_id, quarter, label)
  select new_id, q, p_milestones[q] from generate_series(1, 4) as q;

  insert into public.goal_subgoals (goal_id, title, sort_order)
  select new_id, s.title, s.ord - 1
  from unnest(coalesce(p_subgoals, '{}'::text[])) with ordinality as s(title, ord);

  return new_id;
end;
$$;

revoke execute on function public.create_goal(int, text, text, text, text[], text[]) from public, anon;
grant execute on function public.create_goal(int, text, text, text, text[], text[]) to authenticated;
