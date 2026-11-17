-- NUUR Phase 5 hardening: keep privileged implementations private and reduce overlapping RLS policies.

create or replace function private.admin_dashboard_summary_impl()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
begin
  if not private.is_app_admin_any() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'generated_at', statement_timestamp(),
    'users', jsonb_build_object(
      'total_accounts', (select count(*) from auth.users),
      'registered_users', (select count(*) from auth.users where is_anonymous = false),
      'anonymous_sessions', (select count(*) from auth.users where is_anonymous = true),
      'new_registered_users_7d', (
        select count(*) from auth.users
        where is_anonymous = false and created_at >= now() - interval '7 days'
      ),
      'profiles', (select count(*) from public.profiles)
    ),
    'content', jsonb_build_object(
      'adhkar_categories', (select count(*) from public.adhkar_categories),
      'active_adhkar_categories', (select count(*) from public.adhkar_categories where is_active),
      'adhkar_items', (select count(*) from public.adhkar_items),
      'active_adhkar_items', (select count(*) from public.adhkar_items where is_active),
      'quran_surahs', (select count(*) from public.quran_surahs),
      'quran_verses', (select count(*) from public.quran_verses),
      'quran_translations', (select count(*) from public.quran_translations),
      'reviewed_quran_translations', (select count(*) from public.quran_translations where is_reviewed)
    ),
    'admins', jsonb_build_object(
      'owners', (select count(*) from public.app_admins where role = 'owner'),
      'editors', (select count(*) from public.app_admins where role = 'editor'),
      'viewers', (select count(*) from public.app_admins where role = 'viewer')
    ),
    'announcements', jsonb_build_object(
      'total', (select count(*) from public.app_announcements),
      'active_now', (
        select count(*) from public.app_announcements
        where is_active and starts_at <= now() and (ends_at is null or ends_at > now())
      )
    ),
    'app_versions', jsonb_build_object(
      'active_android_releases', (
        select count(*) from public.app_versions where platform = 'android' and is_active
      )
    )
  )
  into v_result;

  return v_result;
end;
$function$;

create or replace function private.admin_list_users_impl(
  p_limit integer default 25,
  p_offset integer default 0,
  p_search text default null
)
returns table (
  user_id uuid,
  email text,
  display_name text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  is_anonymous boolean,
  admin_role text,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if not private.is_app_admin_owner() then
    raise exception 'Owner access required' using errcode = '42501';
  end if;

  return query
  with filtered as (
    select
      u.id,
      u.email::text as email,
      p.display_name,
      u.created_at,
      u.last_sign_in_at,
      u.is_anonymous,
      a.role as admin_role
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join public.app_admins a on a.user_id = u.id
    where nullif(btrim(p_search), '') is null
       or coalesce(u.email, '') ilike ('%' || btrim(p_search) || '%')
       or coalesce(p.display_name, '') ilike ('%' || btrim(p_search) || '%')
  )
  select
    f.id,
    f.email,
    f.display_name,
    f.created_at,
    f.last_sign_in_at,
    f.is_anonymous,
    f.admin_role,
    count(*) over ()::bigint
  from filtered f
  order by f.created_at desc
  limit greatest(1, least(coalesce(p_limit, 25), 100))
  offset greatest(coalesce(p_offset, 0), 0);
end;
$function$;

create or replace function private.admin_set_admin_role_impl(p_user_id uuid, p_role text)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_current_role text;
begin
  if not private.is_app_admin_owner() then
    raise exception 'Owner access required' using errcode = '42501';
  end if;

  if p_user_id is null then
    raise exception 'User ID is required' using errcode = '22004';
  end if;

  if p_user_id = (select auth.uid()) then
    raise exception 'The Owner cannot change their own role through this function' using errcode = '22023';
  end if;

  if p_role is not null and p_role not in ('owner','editor','viewer') then
    raise exception 'Role must be owner, editor, viewer, or null to remove admin access' using errcode = '22023';
  end if;

  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'Target Auth user does not exist' using errcode = 'P0002';
  end if;

  select a.role into v_current_role
  from public.app_admins a
  where a.user_id = p_user_id;

  if v_current_role = 'owner' and p_role is distinct from 'owner'
     and (select count(*) from public.app_admins where role = 'owner') <= 1 then
    raise exception 'The last Owner cannot be removed or downgraded' using errcode = '23514';
  end if;

  if p_role is null then
    delete from public.app_admins where user_id = p_user_id;
    return 'removed';
  end if;

  insert into public.app_admins (user_id, role)
  values (p_user_id, p_role)
  on conflict (user_id) do update
    set role = excluded.role;

  return p_role;
end;
$function$;

revoke all on function private.admin_dashboard_summary_impl() from public, anon;
revoke all on function private.admin_list_users_impl(integer, integer, text) from public, anon;
revoke all on function private.admin_set_admin_role_impl(uuid, text) from public, anon;
grant execute on function private.admin_dashboard_summary_impl() to authenticated;
grant execute on function private.admin_list_users_impl(integer, integer, text) to authenticated;
grant execute on function private.admin_set_admin_role_impl(uuid, text) to authenticated;

-- Public RPC endpoints are invoker wrappers. Privileged work stays in private schema.
create or replace function public.get_admin_dashboard_summary()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.admin_dashboard_summary_impl();
$function$;

create or replace function public.admin_list_users(
  p_limit integer default 25,
  p_offset integer default 0,
  p_search text default null
)
returns table (
  user_id uuid,
  email text,
  display_name text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  is_anonymous boolean,
  admin_role text,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select *
  from private.admin_list_users_impl(p_limit, p_offset, p_search);
$function$;

create or replace function public.admin_set_admin_role(p_user_id uuid, p_role text)
returns text
language sql
security invoker
set search_path = ''
as $function$
  select private.admin_set_admin_role_impl(p_user_id, p_role);
$function$;

-- Role lookup needs only the caller's own app_admins row, so it does not need SECURITY DEFINER.
create or replace function public.get_my_admin_role()
returns text
language sql
stable
security invoker
set search_path = ''
as $function$
  select case
    when (select auth.uid()) is null
      or coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)
      then null
    else (
      select a.role
      from public.app_admins a
      where a.user_id = (select auth.uid())
      limit 1
    )
  end;
$function$;

revoke all on function public.get_admin_dashboard_summary() from public, anon;
revoke all on function public.admin_list_users(integer, integer, text) from public, anon;
revoke all on function public.admin_set_admin_role(uuid, text) from public, anon;
revoke all on function public.get_my_admin_role() from public, anon;
grant execute on function public.get_admin_dashboard_summary() to authenticated;
grant execute on function public.admin_list_users(integer, integer, text) to authenticated;
grant execute on function public.admin_set_admin_role(uuid, text) to authenticated;
grant execute on function public.get_my_admin_role() to authenticated;

-- Keep one SELECT policy per role/action and separate write policies to avoid overlap.
drop policy if exists "Anyone reads active adhkar categories" on public.adhkar_categories;
drop policy if exists "Admins read all adhkar categories" on public.adhkar_categories;
drop policy if exists "Admins manage adhkar categories" on public.adhkar_categories;
create policy "Public reads active adhkar categories"
on public.adhkar_categories for select to anon using (is_active = true);
create policy "Authenticated reads active or admin adhkar categories"
on public.adhkar_categories for select to authenticated
using (is_active = true or private.is_app_admin_any());
create policy "Admins insert adhkar categories"
on public.adhkar_categories for insert to authenticated
with check (private.is_app_admin());
create policy "Admins update adhkar categories"
on public.adhkar_categories for update to authenticated
using (private.is_app_admin()) with check (private.is_app_admin());
create policy "Admins delete adhkar categories"
on public.adhkar_categories for delete to authenticated
using (private.is_app_admin());

drop policy if exists "Anyone reads active adhkar items" on public.adhkar_items;
drop policy if exists "Admins read all adhkar items" on public.adhkar_items;
drop policy if exists "Admins manage adhkar items" on public.adhkar_items;
create policy "Public reads active adhkar items"
on public.adhkar_items for select to anon
using (
  is_active = true
  and exists (
    select 1 from public.adhkar_categories c
    where c.id = adhkar_items.category_id and c.is_active = true
  )
);
create policy "Authenticated reads active or admin adhkar items"
on public.adhkar_items for select to authenticated
using (
  (
    is_active = true
    and exists (
      select 1 from public.adhkar_categories c
      where c.id = adhkar_items.category_id and c.is_active = true
    )
  )
  or private.is_app_admin_any()
);
create policy "Admins insert adhkar items"
on public.adhkar_items for insert to authenticated
with check (private.is_app_admin());
create policy "Admins update adhkar items"
on public.adhkar_items for update to authenticated
using (private.is_app_admin()) with check (private.is_app_admin());
create policy "Admins delete adhkar items"
on public.adhkar_items for delete to authenticated
using (private.is_app_admin());

drop policy if exists "Admins read own admin record" on public.app_admins;
drop policy if exists "Owners read admin roster" on public.app_admins;
create policy "Admins read own record or Owners read roster"
on public.app_admins for select to authenticated
using (user_id = (select auth.uid()) or private.is_app_admin_owner());

drop policy if exists "Authenticated reads current announcements" on public.app_announcements;
drop policy if exists "Admins read all announcements" on public.app_announcements;
create policy "Authenticated reads current or admin announcements"
on public.app_announcements for select to authenticated
using (
  (
    is_active = true and starts_at <= now()
    and (ends_at is null or ends_at > now())
  )
  or private.is_app_admin_any()
);

drop policy if exists "Authenticated reads visible app settings" on public.app_settings;
drop policy if exists "Admins read all app settings" on public.app_settings;
drop policy if exists "Owners manage app settings" on public.app_settings;
create policy "Authenticated reads visible or admin app settings"
on public.app_settings for select to authenticated
using (is_public = true or private.is_app_admin_any());
create policy "Owners insert app settings"
on public.app_settings for insert to authenticated
with check (private.is_app_admin_owner());
create policy "Owners update app settings"
on public.app_settings for update to authenticated
using (private.is_app_admin_owner()) with check (private.is_app_admin_owner());
create policy "Owners delete app settings"
on public.app_settings for delete to authenticated
using (private.is_app_admin_owner());

drop policy if exists "Authenticated reads active app versions" on public.app_versions;
drop policy if exists "Admins read all app versions" on public.app_versions;
drop policy if exists "Owners manage app versions" on public.app_versions;
create policy "Authenticated reads active or admin app versions"
on public.app_versions for select to authenticated
using (is_active = true or private.is_app_admin_any());
create policy "Owners insert app versions"
on public.app_versions for insert to authenticated
with check (private.is_app_admin_owner());
create policy "Owners update app versions"
on public.app_versions for update to authenticated
using (private.is_app_admin_owner()) with check (private.is_app_admin_owner());
create policy "Owners delete app versions"
on public.app_versions for delete to authenticated
using (private.is_app_admin_owner());

drop policy if exists "Owners manage content sources" on public.content_sources;
create policy "Owners insert content sources"
on public.content_sources for insert to authenticated
with check (private.is_app_admin_owner());
create policy "Owners update content sources"
on public.content_sources for update to authenticated
using (private.is_app_admin_owner()) with check (private.is_app_admin_owner());
create policy "Owners delete content sources"
on public.content_sources for delete to authenticated
using (private.is_app_admin_owner());

drop policy if exists "Owners manage Quran surahs" on public.quran_surahs;
create policy "Owners insert Quran surahs"
on public.quran_surahs for insert to authenticated
with check (private.is_app_admin_owner());
create policy "Owners update Quran surahs"
on public.quran_surahs for update to authenticated
using (private.is_app_admin_owner()) with check (private.is_app_admin_owner());
create policy "Owners delete Quran surahs"
on public.quran_surahs for delete to authenticated
using (private.is_app_admin_owner());

drop policy if exists "Owners manage Quran verses" on public.quran_verses;
create policy "Owners insert Quran verses"
on public.quran_verses for insert to authenticated
with check (private.is_app_admin_owner());
create policy "Owners update Quran verses"
on public.quran_verses for update to authenticated
using (private.is_app_admin_owner()) with check (private.is_app_admin_owner());
create policy "Owners delete Quran verses"
on public.quran_verses for delete to authenticated
using (private.is_app_admin_owner());

drop policy if exists "Owners manage Quran translations" on public.quran_translations;
create policy "Owners insert Quran translations"
on public.quran_translations for insert to authenticated
with check (private.is_app_admin_owner());
create policy "Owners update Quran translations"
on public.quran_translations for update to authenticated
using (private.is_app_admin_owner()) with check (private.is_app_admin_owner());
create policy "Owners delete Quran translations"
on public.quran_translations for delete to authenticated
using (private.is_app_admin_owner());

drop policy if exists "Owners read user directory profiles" on public.profiles;
drop policy if exists "Users read own profile" on public.profiles;
create policy "Users or Owners read profiles"
on public.profiles for select to authenticated
using (id = (select auth.uid()) or private.is_app_admin_owner());

-- Remove the two duplicate indexes discovered by the advisor; retain the original equivalents.
drop index if exists public.app_versions_active_version_lookup_idx;
drop index if exists public.app_announcements_public_feed_idx;
