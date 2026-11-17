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
      select 1 from public.app_admins a
      where a.user_id = (select auth.uid())
        and a.role in ('owner','editor')
    );
$$;
revoke all on function private.is_app_admin() from public, anon;
grant execute on function private.is_app_admin() to authenticated;
