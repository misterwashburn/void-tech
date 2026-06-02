revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

create index bug_reports_reporter_user_id_idx on public.bug_reports (reporter_user_id);

drop policy if exists "Admins can read all profiles" on public.profiles;
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Admins can update profiles" on public.profiles;

create policy "Profiles are readable by owners and admins"
  on public.profiles for select
  to authenticated
  using (((select auth.uid()) = id) or public.is_admin());

create policy "Profiles are editable by owners and admins"
  on public.profiles for update
  to authenticated
  using (((select auth.uid()) = id) or public.is_admin())
  with check (((select auth.uid()) = id) or public.is_admin());

drop policy if exists "Users can read own behavior events" on public.app_events;
drop policy if exists "Admins can read all behavior events" on public.app_events;

create policy "Behavior events are readable by owners and admins"
  on public.app_events for select
  to authenticated
  using (((select auth.uid()) = user_id) or public.is_admin());

drop policy if exists "Clients can submit bug reports" on public.bug_reports;
drop policy if exists "Users can read own bug reports" on public.bug_reports;
drop policy if exists "Admins can manage bug reports" on public.bug_reports;

create policy "Bug reports can be submitted by clients"
  on public.bug_reports for insert
  to anon, authenticated
  with check ((reporter_user_id is null) or ((select auth.uid()) = reporter_user_id) or public.is_admin());

create policy "Bug reports are readable by owners and admins"
  on public.bug_reports for select
  to authenticated
  using (((select auth.uid()) = reporter_user_id) or public.is_admin());

create policy "Bug reports are editable by admins"
  on public.bug_reports for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Bug reports are deletable by admins"
  on public.bug_reports for delete
  to authenticated
  using (public.is_admin());
