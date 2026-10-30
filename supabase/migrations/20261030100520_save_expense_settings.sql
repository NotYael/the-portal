-- Saving the Settings panel in one transaction (docs/PORTAL_SPEC.md → Budget
-- history): the settings row, each category's current budget, and the
-- current month's budget_history row, so a failed save changes nothing.
-- SECURITY INVOKER: it runs as the caller, so RLS and the table grants apply.

create or replace function public.save_expense_settings(
  p_monthly_budget numeric,
  p_default_payment_method text,
  p_alert_threshold_pct int,
  p_cycle_start_day int,
  p_ai_insights_enabled boolean,
  p_include_in_digest boolean,
  p_rollover_enabled boolean,
  -- {"food": 7000, ...}; a missing key = no limit for that category
  p_category_budgets jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  this_month date := date_trunc('month', now() at time zone 'Asia/Manila')::date;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  update public.expense_settings set
    monthly_budget = p_monthly_budget,
    default_payment_method = p_default_payment_method,
    alert_threshold_pct = p_alert_threshold_pct,
    cycle_start_day = p_cycle_start_day,
    ai_insights_enabled = p_ai_insights_enabled,
    include_in_digest = p_include_in_digest,
    rollover_enabled = p_rollover_enabled
  where user_id = uid;
  if not found then
    raise exception 'expense settings missing' using errcode = 'P0002';
  end if;

  update public.categories c
  set monthly_budget = (p_category_budgets ->> c.slug)::numeric
  where c.user_id = uid;

  insert into public.budget_history (user_id, effective_month, monthly_budget, category_budgets)
  values (uid, this_month, p_monthly_budget, p_category_budgets)
  on conflict (user_id, effective_month) do update set
    monthly_budget = excluded.monthly_budget,
    category_budgets = excluded.category_budgets;
end;
$$;

revoke execute on function public.save_expense_settings(numeric, text, int, int, boolean, boolean, boolean, jsonb)
  from public, anon;
grant execute on function public.save_expense_settings(numeric, text, int, int, boolean, boolean, boolean, jsonb)
  to authenticated;
