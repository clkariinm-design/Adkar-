-- NUUR Phase 4: validate multilingual announcement payloads and priorities.
-- Existing announcement RLS policies remain unchanged: public users can only read active,
-- date-valid announcements; app admins can manage all announcements.
alter table public.app_announcements
  add constraint app_announcements_priority_range_check
  check (priority between 0 and 100);

alter table public.app_announcements
  add constraint app_announcements_title_object_check
  check (jsonb_typeof(title) = 'object');

alter table public.app_announcements
  add constraint app_announcements_body_object_check
  check (jsonb_typeof(body) = 'object');

create index app_announcements_public_feed_idx
  on public.app_announcements (priority desc, starts_at desc)
  where is_active = true;

create index app_announcements_admin_schedule_idx
  on public.app_announcements (starts_at desc, ends_at)
  where is_active = true;
