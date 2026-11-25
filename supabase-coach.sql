-- NoNeang · weekly coach plan. Paste in Supabase SQL Editor → Run (once).
-- Claude's Monday job writes next week's plan with the widget token; the app reads it after login.
create table if not exists public.noneang_coach (
  user_id    uuid primary key references auth.users on delete cascade,
  plan       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.noneang_coach enable row level security;
drop policy if exists "noneang coach read own" on public.noneang_coach;
create policy "noneang coach read own" on public.noneang_coach for select to authenticated using (auth.uid() = user_id);

create or replace function public.put_coach(p_token uuid, p_plan jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  select user_id into uid from noneang_data where widget_token = p_token;
  if uid is null then return false; end if;
  insert into noneang_coach (user_id, plan, updated_at) values (uid, p_plan, now())
  on conflict (user_id) do update set plan = excluded.plan, updated_at = now();
  return true;
end $$;
revoke all on function public.put_coach(uuid, jsonb) from public;
grant execute on function public.put_coach(uuid, jsonb) to anon, authenticated;

create or replace function public.get_coach(p_token uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select c.plan from noneang_coach c join noneang_data d on d.user_id = c.user_id where d.widget_token = p_token;
$$;
revoke all on function public.get_coach(uuid) from public;
grant execute on function public.get_coach(uuid) to anon, authenticated;
