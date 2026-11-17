create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','editor','viewer')),
  created_at timestamptz not null default now()
);

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.app_admins a
    where a.user_id = (select auth.uid())
      and a.role in ('owner','editor','viewer')
  );
$$;

revoke all on function public.is_app_admin() from public;
grant execute on function public.is_app_admin() to authenticated;

create table if not exists public.app_settings (
  setting_key text primary key check (setting_key ~ '^[a-z][a-z0-9_.-]{1,99}$'),
  setting_value jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.app_versions (
  id uuid primary key default gen_random_uuid(),
  platform text not null default 'android' check (platform in ('android')),
  version_name text not null,
  version_code integer not null check (version_code > 0),
  apk_url text not null,
  release_notes jsonb not null default '{}'::jsonb,
  is_mandatory boolean not null default false,
  minimum_supported_version_code integer not null default 1 check (minimum_supported_version_code > 0),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (platform, version_code)
);

create index if not exists app_versions_active_idx
  on public.app_versions (platform, version_code desc)
  where is_active = true;

create table if not exists public.app_announcements (
  id uuid primary key default gen_random_uuid(),
  title jsonb not null default '{}'::jsonb,
  body jsonb not null default '{}'::jsonb,
  announcement_type text not null default 'info'
    check (announcement_type in ('info','warning','update','maintenance')),
  priority integer not null default 0,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  check (ends_at is null or ends_at > starts_at)
);

create index if not exists app_announcements_live_idx
  on public.app_announcements (priority desc, starts_at desc)
  where is_active = true;

alter table public.app_admins enable row level security;
alter table public.app_settings enable row level security;
alter table public.app_versions enable row level security;
alter table public.app_announcements enable row level security;

create policy "Admins read admin roster"
  on public.app_admins for select to authenticated
  using (user_id = (select auth.uid()) or public.is_app_admin());

create policy "Public reads visible app settings"
  on public.app_settings for select to anon, authenticated
  using (is_public or public.is_app_admin());
create policy "Admins manage app settings"
  on public.app_settings for all to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

create policy "Public reads active app versions"
  on public.app_versions for select to anon, authenticated
  using (is_active or public.is_app_admin());
create policy "Admins manage app versions"
  on public.app_versions for all to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

create policy "Public reads current announcements"
  on public.app_announcements for select to anon, authenticated
  using (
    (is_active = true and starts_at <= now() and (ends_at is null or ends_at > now()))
    or public.is_app_admin()
  );
create policy "Admins manage announcements"
  on public.app_announcements for all to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

revoke all on public.app_admins from anon, authenticated;
grant select on public.app_admins to authenticated;
revoke all on public.app_settings from anon, authenticated;
grant select, insert, update, delete on public.app_settings to anon, authenticated;
revoke all on public.app_versions from anon, authenticated;
grant select, insert, update, delete on public.app_versions to anon, authenticated;
revoke all on public.app_announcements from anon, authenticated;
grant select, insert, update, delete on public.app_announcements to anon, authenticated;
