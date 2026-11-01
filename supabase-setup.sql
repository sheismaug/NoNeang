-- NoNeang · Supabase setup. Paste all of this in SQL Editor → Run (once).

-- 1) one row per user: the whole app document + a small summary for the widget
create table if not exists public.noneang_data (
  user_id      uuid primary key default auth.uid() references auth.users on delete cascade,
  doc          jsonb not null,
  summary      jsonb,
  widget_token uuid not null default gen_random_uuid(),
  updated_at   timestamptz not null default now()
);
alter table public.noneang_data enable row level security;

drop policy if exists "noneang read own"   on public.noneang_data;
drop policy if exists "noneang insert own" on public.noneang_data;
drop policy if exists "noneang update own" on public.noneang_data;
create policy "noneang read own"   on public.noneang_data for select to authenticated using (auth.uid() = user_id);
create policy "noneang insert own" on public.noneang_data for insert to authenticated with check (auth.uid() = user_id);
create policy "noneang update own" on public.noneang_data for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2) daily safety copy: before the first change of each day, keep yesterday's version
create table if not exists public.noneang_history (
  id       bigserial primary key,
  user_id  uuid not null references auth.users on delete cascade,
  doc      jsonb not null,
  saved_at timestamptz not null default now()
);
alter table public.noneang_history enable row level security;
drop policy if exists "noneang history read own" on public.noneang_history;
create policy "noneang history read own" on public.noneang_history for select to authenticated using (auth.uid() = user_id);

create or replace function public.noneang_snapshot() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from noneang_history where user_id = old.user_id and saved_at > now() - interval '20 hours') then
    insert into noneang_history (user_id, doc) values (old.user_id, old.doc);
  end if;
  return new;
end $$;
drop trigger if exists noneang_snapshot on public.noneang_data;
create trigger noneang_snapshot before update on public.noneang_data for each row execute function public.noneang_snapshot();

-- 3) widget: read-only summary by secret token (no login inside Scriptable)
create or replace function public.get_widget(p_token uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select summary || jsonb_build_object('synced_at', updated_at) from noneang_data where widget_token = p_token;
$$;
revoke all on function public.get_widget(uuid) from public;
grant execute on function public.get_widget(uuid) to anon, authenticated;
