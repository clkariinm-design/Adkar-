-- NUUR Phase 5: Admin dashboard, user directory, role boundaries, content access, and audit coverage.

-- Resolve admin roles from the trusted database roster, never from user-editable JWT metadata.
create or replace function private.current_app_admin_role()
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select case
    when (select auth.uid()) is null then null
    when coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) then null
    else (
      select a.role
      from public.app_admins a
      where a.user_id = (select auth.uid())
      limit 1
    )
  end;
$function$;

create or replace function private.is_app_admin_any()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select private.current_app_admin_role() is not null;
$function$;

create or replace function private.is_app_admin_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select private.current_app_admin_role() = 'owner';
$function$;

-- Keep the established helper meaning: editors and owners can perform editorial work.
create or replace function private.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select private.current_app_admin_role() in ('owner', 'editor');
$function$;

grant usage on schema private to authenticated;
revoke all on function private.current_app_admin_role() from public, anon;
revoke all on function private.is_app_admin_any() from public, anon;
revoke all on function private.is_app_admin_owner() from public, anon;
revoke all on function private.is_app_admin() from public, anon;
grant execute on function private.current_app_admin_role() to authenticated;
grant execute on function private.is_app_admin_any() to authenticated;
grant execute on function private.is_app_admin_owner() to authenticated;
grant execute on function private.is_app_admin() to authenticated;

-- Explicit read/write grants complement RLS and remove unnecessary anonymous write grants.
revoke all on table public.adhkar_categories, public.adhkar_items,
  public.quran_surahs, public.quran_verses, public.quran_translations,
  public.content_sources, public.app_settings, public.app_versions,
  public.app_announcements
from anon, authenticated;

grant select on table public.adhkar_categories, public.adhkar_items,
  public.quran_surahs, public.quran_verses, public.quran_translations,
  public.content_sources, public.app_settings, public.app_versions,
  public.app_announcements
to anon, authenticated;

grant insert, update, delete on table public.adhkar_categories, public.adhkar_items,
  public.quran_surahs, public.quran_verses, public.quran_translations,
  public.content_sources, public.app_settings, public.app_versions,
  public.app_announcements
to authenticated;

-- Viewer: read-only admin visibility. Editor: adhkar + announcement editorial work.
-- Owner: full content and app-configuration administration.
drop policy if exists "Admins read all adhkar categories" on public.adhkar_categories;
create policy "Admins read all adhkar categories"
on public.adhkar_categories for select to authenticated
using (private.is_app_admin_any());

drop policy if exists "Admins manage adhkar categories" on public.adhkar_categories;
create policy "Admins manage adhkar categories"
on public.adhkar_categories for all to authenticated
using (private.is_app_admin())
with check (private.is_app_admin());

drop policy if exists "Admins read all adhkar items" on public.adhkar_items;
create policy "Admins read all adhkar items"
on public.adhkar_items for select to authenticated
using (private.is_app_admin_any());

drop policy if exists "Admins manage adhkar items" on public.adhkar_items;
create policy "Admins manage adhkar items"
on public.adhkar_items for all to authenticated
using (private.is_app_admin())
with check (private.is_app_admin());

drop policy if exists "Owners manage Quran surahs" on public.quran_surahs;
create policy "Owners manage Quran surahs"
on public.quran_surahs for all to authenticated
using (private.is_app_admin_owner())
with check (private.is_app_admin_owner());

drop policy if exists "Owners manage Quran verses" on public.quran_verses;
create policy "Owners manage Quran verses"
on public.quran_verses for all to authenticated
using (private.is_app_admin_owner())
with check (private.is_app_admin_owner());

drop policy if exists "Owners manage Quran translations" on public.quran_translations;
create policy "Owners manage Quran translations"
on public.quran_translations for all to authenticated
using (private.is_app_admin_owner())
with check (private.is_app_admin_owner());

drop policy if exists "Owners manage content sources" on public.content_sources;
create policy "Owners manage content sources"
on public.content_sources for all to authenticated
using (private.is_app_admin_owner())
with check (private.is_app_admin_owner());

-- App settings and release records are Owner-only; Editors cannot alter maintenance or releases.
drop policy if exists "Admins insert app settings" on public.app_settings;
drop policy if exists "Admins update app settings" on public.app_settings;
drop policy if exists "Admins delete app settings" on public.app_settings;
drop policy if exists "Owners manage app settings" on public.app_settings;
create policy "Owners manage app settings"
on public.app_settings for all to authenticated
using (private.is_app_admin_owner())
with check (private.is_app_admin_owner());

drop policy if exists "Admins insert app versions" on public.app_versions;
drop policy if exists "Admins update app versions" on public.app_versions;
drop policy if exists "Admins delete app versions" on public.app_versions;
drop policy if exists "Owners manage app versions" on public.app_versions;
create policy "Owners manage app versions"
on public.app_versions for all to authenticated
using (private.is_app_admin_owner())
with check (private.is_app_admin_owner());

-- Viewers may inspect all scheduled announcements, but only Editor/Owner can change them.
drop policy if exists "Admins read all announcements" on public.app_announcements;
create policy "Admins read all announcements"
on public.app_announcements for select to authenticated
using (private.is_app_admin_any());

-- All admin roles can read internal configuration and version rows; writes remain Owner-only.
drop policy if exists "Admins read all app settings" on public.app_settings;
create policy "Admins read all app settings"
on public.app_settings for select to authenticated
using (private.is_app_admin_any());

drop policy if exists "Admins read all app versions" on public.app_versions;
create policy "Admins read all app versions"
on public.app_versions for select to authenticated
using (private.is_app_admin_any());

-- Only the Owner can see the complete admin roster; every admin can still read their own role.
drop policy if exists "Admins read admin roster" on public.app_admins;
drop policy if exists "Admins read own admin record" on public.app_admins;
drop policy if exists "Owners read admin roster" on public.app_admins;
create policy "Admins read own admin record"
on public.app_admins for select to authenticated
using (user_id = (select auth.uid()));

create policy "Owners read admin roster"
on public.app_admins for select to authenticated
using (private.is_app_admin_owner());

-- Expand the existing audit trail to cover editorial and Quran/source changes.
alter table public.admin_activity_logs
  drop constraint if exists admin_activity_logs_table_name_check;

alter table public.admin_activity_logs
  add constraint admin_activity_logs_table_name_check
  check (table_name = any (array[
    'app_settings','app_versions','app_announcements','app_admins',
    'adhkar_categories','adhkar_items','quran_surahs','quran_verses',
    'quran_translations','content_sources'
  ]));

create or replace function private.capture_admin_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_old jsonb;
  v_new jsonb;
  v_key text;
begin
  if tg_op in ('UPDATE','DELETE') then
    v_old := to_jsonb(old);
  end if;
  if tg_op in ('INSERT','UPDATE') then
    v_new := to_jsonb(new);
  end if;

  v_key := coalesce(
    v_new->>'setting_key', v_new->>'id', v_new->>'user_id',
    v_new->>'source_slug', v_new->>'slug',
    v_old->>'setting_key', v_old->>'id', v_old->>'user_id',
    v_old->>'source_slug', v_old->>'slug'
  );

  insert into public.admin_activity_logs
    (actor_user_id, action, table_name, record_key, old_data, new_data)
  values
    ((select auth.uid()), tg_op, tg_table_name, v_key, v_old, v_new);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$function$;

drop trigger if exists audit_adhkar_categories on public.adhkar_categories;
create trigger audit_adhkar_categories
after insert or update or delete on public.adhkar_categories
for each row execute function private.capture_admin_activity();

drop trigger if exists audit_adhkar_items on public.adhkar_items;
create trigger audit_adhkar_items
after insert or update or delete on public.adhkar_items
for each row execute function private.capture_admin_activity();

drop trigger if exists audit_quran_surahs on public.quran_surahs;
create trigger audit_quran_surahs
after insert or update or delete on public.quran_surahs
for each row execute function private.capture_admin_activity();

drop trigger if exists audit_quran_verses on public.quran_verses;
create trigger audit_quran_verses
after insert or update or delete on public.quran_verses
for each row execute function private.capture_admin_activity();

drop trigger if exists audit_quran_translations on public.quran_translations;
create trigger audit_quran_translations
after insert or update or delete on public.quran_translations
for each row execute function private.capture_admin_activity();

drop trigger if exists audit_content_sources on public.content_sources;
create trigger audit_content_sources
after insert or update or delete on public.content_sources
for each row execute function private.capture_admin_activity();

create index if not exists admin_activity_logs_created_at_idx
  on public.admin_activity_logs (created_at desc);
create index if not exists admin_activity_logs_table_created_idx
  on public.admin_activity_logs (table_name, created_at desc);

-- Dashboard summary: non-PII aggregates available to all real admins (Owner, Editor, Viewer).
create or replace function public.get_admin_dashboard_summary()
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

-- Owner-only user directory. Anonymous sessions are labelled, not silently mixed with registered users.
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

-- Owner-only role assignment for existing Auth users. Auth invitations remain an Auth Dashboard/Edge Function task.
create or replace function public.admin_set_admin_role(p_user_id uuid, p_role text)
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

-- Do not expose privileged RPCs to anon/PUBLIC. The function bodies still enforce role checks.
revoke all on function public.get_admin_dashboard_summary() from public, anon;
revoke all on function public.admin_list_users(integer, integer, text) from public, anon;
revoke all on function public.admin_set_admin_role(uuid, text) from public, anon;
revoke all on function public.get_my_admin_role() from public, anon;
grant execute on function public.get_admin_dashboard_summary() to authenticated;
grant execute on function public.admin_list_users(integer, integer, text) to authenticated;
grant execute on function public.admin_set_admin_role(uuid, text) to authenticated;
grant execute on function public.get_my_admin_role() to authenticated;
