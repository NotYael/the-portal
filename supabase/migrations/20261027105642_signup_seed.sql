-- When the (single) user signs up, seed their profile, expense settings, the
-- 8 categories and the first budget_history row (docs/PORTAL_SPEC.md).
-- SECURITY DEFINER is needed because the auth service inserts into
-- auth.users without rights on public tables; the function lives in the
-- unexposed `private` schema and nobody can call it directly.

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  this_month date := date_trunc('month', now() at time zone 'Asia/Manila')::date;
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    -- display only, never used for authorization
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), 80)
  );

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

  insert into public.budget_history (user_id, effective_month, monthly_budget, category_budgets)
  values (
    new.id, this_month, 25000,
    '{"food":7000,"transport":3500,"living":12000,"gifts":2000,"shopping":2000,"subs":2000,"leisure":2000,"other":1000}'
  );

  return new;
end;
$$;

revoke execute on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
