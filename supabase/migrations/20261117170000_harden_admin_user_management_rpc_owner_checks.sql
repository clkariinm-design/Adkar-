-- Harden admin user-management RPC authorization.
-- Authorization is checked before reading or validating target-user data.
-- Anonymous Supabase sessions are rejected by get_my_admin_role().

create or replace function private.admin_list_users_impl(
  p_limit integer default 25,
  p_offset integer default 0,
  p_search text default null
)
returns table(
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
  if public.get_my_admin_role() is distinct from 'owner' then
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

create or replace function private.admin_set_admin_role_impl(
  p_user_id uuid,
  p_role text
)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_current_role text;
begin
  if public.get_my_admin_role() is distinct from 'owner' then
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

revoke all on function public.admin_list_users(integer, integer, text) from public, anon;
grant execute on function public.admin_list_users(integer, integer, text) to authenticated;
revoke all on function public.admin_set_admin_role(uuid, text) from public, anon;
grant execute on function public.admin_set_admin_role(uuid, text) to authenticated;

revoke all on function private.admin_list_users_impl(integer, integer, text) from public, anon, authenticated;
revoke all on function private.admin_set_admin_role_impl(uuid, text) from public, anon, authenticated;
grant execute on function private.admin_list_users_impl(integer, integer, text) to authenticated;
grant execute on function private.admin_set_admin_role_impl(uuid, text) to authenticated;
