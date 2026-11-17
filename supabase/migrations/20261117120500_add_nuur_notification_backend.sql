-- NUUR notification backend: private inbox, device registrations, and per-user preferences.
create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  push_enabled boolean not null default true,
  daily_verse_enabled boolean not null default true,
  daily_hadith_enabled boolean not null default true,
  morning_adhkar_enabled boolean not null default true,
  evening_adhkar_enabled boolean not null default true,
  reminder_notifications_enabled boolean not null default true,
  timezone text not null default 'Africa/Mogadishu',
  quiet_hours_start time,
  quiet_hours_end time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_quiet_hours_pair check (
    (quiet_hours_start is null and quiet_hours_end is null)
    or (quiet_hours_start is not null and quiet_hours_end is not null)
  )
);

create table if not exists public.notification_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('android','ios','web')),
  provider text not null default 'fcm' check (provider in ('fcm','apns','web_push')),
  device_token text not null unique,
  device_label text,
  is_enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notification_devices_user_enabled_idx
  on public.notification_devices(user_id, is_enabled);

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null check (notification_type in (
    'daily_verse','daily_hadith','morning_adhkar','evening_adhkar',
    'reminder','announcement','system'
  )),
  title text not null check (length(title) between 1 and 160),
  body text not null check (length(body) between 1 and 2000),
  data jsonb not null default '{}'::jsonb,
  scheduled_for timestamptz,
  sent_at timestamptz,
  read_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists user_notifications_inbox_idx
  on public.user_notifications(user_id, created_at desc);
create index if not exists user_notifications_unread_idx
  on public.user_notifications(user_id, created_at desc)
  where read_at is null;

alter table public.notification_preferences enable row level security;
alter table public.notification_devices enable row level security;
alter table public.user_notifications enable row level security;

revoke all on public.notification_preferences from anon, authenticated;
revoke all on public.notification_devices from anon, authenticated;
revoke all on public.user_notifications from anon, authenticated;

grant select, insert, update, delete on public.notification_preferences to authenticated;
grant select, insert, update, delete on public.notification_devices to authenticated;
grant select on public.user_notifications to authenticated;
grant update (read_at) on public.user_notifications to authenticated;

grant all on public.notification_preferences to service_role;
grant all on public.notification_devices to service_role;
grant all on public.user_notifications to service_role;

drop policy if exists notification_preferences_owner_all on public.notification_preferences;
create policy notification_preferences_owner_all
on public.notification_preferences for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists notification_devices_owner_all on public.notification_devices;
create policy notification_devices_owner_all
on public.notification_devices for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists user_notifications_owner_read on public.user_notifications;
create policy user_notifications_owner_read
on public.user_notifications for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists user_notifications_owner_mark_read on public.user_notifications;
create policy user_notifications_owner_mark_read
on public.user_notifications for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

comment on table public.notification_preferences is 'Per-user notification opt-in and content preferences for NUUR.';
comment on table public.notification_devices is 'Push notification device registrations. Device tokens are private to their owner.';
comment on table public.user_notifications is 'Private per-user notification inbox; only trusted server processes may create notifications.';
