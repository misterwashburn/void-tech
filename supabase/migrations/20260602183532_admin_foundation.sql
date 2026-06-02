create extension if not exists pgcrypto;

create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'is_admin', '') = 'true';
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  plan text not null default 'free',
  onboarding_state text not null default 'new',
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.app_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  session_id text not null default gen_random_uuid()::text,
  event_name text not null,
  event_type text not null default 'interaction',
  route text,
  app_version text,
  properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint app_events_event_name_length check (char_length(event_name) between 2 and 120),
  constraint app_events_event_type_length check (char_length(event_type) between 2 and 60)
);

create table public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid references auth.users(id) on delete set null,
  reporter_email text,
  title text not null,
  description text not null,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open' check (status in ('open', 'triaged', 'in_progress', 'resolved', 'closed')),
  app_version text,
  platform text,
  diagnostics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.financial_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  provider text not null default 'manual',
  provider_event_id text,
  event_type text not null,
  amount_cents integer not null default 0,
  currency text not null default 'USD',
  status text not null default 'recorded' check (status in ('pending', 'recorded', 'failed', 'refunded', 'voided')),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint financial_events_currency_format check (currency = upper(currency) and char_length(currency) = 3),
  constraint financial_events_provider_event_unique unique (provider, provider_event_id)
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

create trigger bug_reports_touch_updated_at
before update on public.bug_reports
for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
    updated_at = now();

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.app_events enable row level security;
alter table public.bug_reports enable row level security;
alter table public.financial_events enable row level security;

create policy "Admins can read all profiles" on public.profiles for select to authenticated using (public.is_admin());
create policy "Users can read own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "Users can update own profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "Admins can update profiles" on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Clients can record behavior events" on public.app_events for insert to anon, authenticated with check ((user_id is null) or ((select auth.uid()) = user_id) or public.is_admin());
create policy "Users can read own behavior events" on public.app_events for select to authenticated using ((select auth.uid()) = user_id);
create policy "Admins can read all behavior events" on public.app_events for select to authenticated using (public.is_admin());
create policy "Clients can submit bug reports" on public.bug_reports for insert to anon, authenticated with check ((reporter_user_id is null) or ((select auth.uid()) = reporter_user_id) or public.is_admin());
create policy "Users can read own bug reports" on public.bug_reports for select to authenticated using ((select auth.uid()) = reporter_user_id);
create policy "Admins can manage bug reports" on public.bug_reports for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins can manage financial events" on public.financial_events for all to authenticated using (public.is_admin()) with check (public.is_admin());

create index profiles_created_at_idx on public.profiles (created_at desc);
create index profiles_last_seen_at_idx on public.profiles (last_seen_at desc nulls last);
create index app_events_occurred_at_idx on public.app_events (occurred_at desc);
create index app_events_user_id_occurred_at_idx on public.app_events (user_id, occurred_at desc);
create index app_events_event_name_idx on public.app_events (event_name);
create index bug_reports_status_created_at_idx on public.bug_reports (status, created_at desc);
create index bug_reports_severity_created_at_idx on public.bug_reports (severity, created_at desc);
create index financial_events_occurred_at_idx on public.financial_events (occurred_at desc);
create index financial_events_user_id_occurred_at_idx on public.financial_events (user_id, occurred_at desc);

create view public.admin_overview
with (security_invoker = true)
as
select
  (select count(*) from public.profiles) as total_users,
  (select count(*) from public.profiles where created_at >= now() - interval '7 days') as new_users_7d,
  (select count(*) from public.app_events where occurred_at >= now() - interval '24 hours') as events_24h,
  (select count(*) from public.bug_reports where status in ('open', 'triaged', 'in_progress')) as open_bug_reports,
  (select coalesce(sum(amount_cents), 0) from public.financial_events where status = 'recorded') as recorded_revenue_cents;

grant usage on schema public to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant insert, select on public.app_events to anon, authenticated;
grant insert, select, update on public.bug_reports to anon, authenticated;
grant select, insert, update, delete on public.financial_events to authenticated;
grant select on public.admin_overview to authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
