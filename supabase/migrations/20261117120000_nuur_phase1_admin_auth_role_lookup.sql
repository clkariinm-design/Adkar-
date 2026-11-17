-- NUUR Phase 1: Admin authentication role lookup.
-- Admin membership is provisioned out-of-band by the project owner/service role.
-- The public client can never grant itself an admin role.

create or replace function public.get_my_admin_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)
      then null
    else (
      select a.role
      from public.app_admins a
      where a.user_id = (select auth.uid())
      limit 1
    )
  end;
$$;

revoke all on function public.get_my_admin_role() from public, anon;
grant execute on function public.get_my_admin_role() to authenticated;

create or replace function private.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and exists (
      select 1
      from public.app_admins a
      where a.user_id = (select auth.uid())
        and a.role in ('owner','editor')
    );
$$;

revoke all on function private.is_app_admin() from public, anon;
grant execute on function private.is_app_admin() to authenticated;

comment on function public.get_my_admin_role() is
  'Returns only the signed-in non-anonymous user own NUUR admin role; NULL for regular or anonymous users.';
comment on function private.is_app_admin() is
  'Internal RLS helper. Grants admin access only to authenticated non-anonymous owner/editor accounts.';
