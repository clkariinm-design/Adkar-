create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

drop policy if exists "Admins read admin roster" on public.app_admins;
drop policy if exists "Public reads visible app settings" on public.app_settings;
drop policy if exists "Admins manage app settings" on public.app_settings;
drop policy if exists "Public reads active app versions" on public.app_versions;
drop policy if exists "Admins manage app versions" on public.app_versions;
drop policy if exists "Public reads current announcements" on public.app_announcements;
drop policy if exists "Admins manage announcements" on public.app_announcements;

drop function if exists public.is_app_admin();

create or replace function private.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.app_admins a
    where a.user_id = (select auth.uid())
      and a.role in ('owner','editor')
  );
$$;
revoke all on function private.is_app_admin() from public, anon;
grant execute on function private.is_app_admin() to authenticated;

create policy "Admins read admin roster"
  on public.app_admins for select to authenticated
  using (user_id = (select auth.uid()) or private.is_app_admin());

create policy "Public reads visible app settings"
  on public.app_settings for select to anon using (is_public);
create policy "Authenticated reads visible app settings"
  on public.app_settings for select to authenticated
  using (is_public or private.is_app_admin());
create policy "Admins insert app settings"
  on public.app_settings for insert to authenticated
  with check (private.is_app_admin());
create policy "Admins update app settings"
  on public.app_settings for update to authenticated
  using (private.is_app_admin()) with check (private.is_app_admin());
create policy "Admins delete app settings"
  on public.app_settings for delete to authenticated
  using (private.is_app_admin());

create policy "Public reads active app versions"
  on public.app_versions for select to anon using (is_active);
create policy "Authenticated reads active app versions"
  on public.app_versions for select to authenticated
  using (is_active or private.is_app_admin());
create policy "Admins insert app versions"
  on public.app_versions for insert to authenticated
  with check (private.is_app_admin());
create policy "Admins update app versions"
  on public.app_versions for update to authenticated
  using (private.is_app_admin()) with check (private.is_app_admin());
create policy "Admins delete app versions"
  on public.app_versions for delete to authenticated
  using (private.is_app_admin());

create policy "Public reads current announcements"
  on public.app_announcements for select to anon
  using (is_active = true and starts_at <= now() and (ends_at is null or ends_at > now()));
create policy "Authenticated reads current announcements"
  on public.app_announcements for select to authenticated
  using (
    (is_active = true and starts_at <= now() and (ends_at is null or ends_at > now()))
    or private.is_app_admin()
  );
create policy "Admins insert announcements"
  on public.app_announcements for insert to authenticated
  with check (private.is_app_admin());
create policy "Admins update announcements"
  on public.app_announcements for update to authenticated
  using (private.is_app_admin()) with check (private.is_app_admin());
create policy "Admins delete announcements"
  on public.app_announcements for delete to authenticated
  using (private.is_app_admin());

create index if not exists app_settings_updated_by_idx on public.app_settings(updated_by);
create index if not exists app_versions_created_by_idx on public.app_versions(created_by);
create index if not exists app_announcements_created_by_idx on public.app_announcements(created_by);
