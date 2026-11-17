create table public.quran_khatmah_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Khatmadda Qur’aanka'
    check (char_length(name) between 1 and 80),
  duration_days smallint not null
    check (duration_days in (30, 60, 90)),
  start_date date not null
    default ((now() at time zone 'Africa/Mogadishu')::date),
  status text not null default 'active'
    check (status in ('active', 'paused', 'completed', 'cancelled')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quran_khatmah_plans_id_user_key unique (id, user_id)
);

create unique index quran_khatmah_one_active_plan_per_user
  on public.quran_khatmah_plans(user_id)
  where status = 'active';

create index quran_khatmah_plans_user_status_idx
  on public.quran_khatmah_plans(user_id, status);

create table public.quran_khatmah_reading_logs (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  reading_date date not null
    default ((now() at time zone 'Africa/Mogadishu')::date),
  start_verse_id bigint not null references public.quran_verses(id),
  end_verse_id bigint not null references public.quran_verses(id),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  constraint quran_khatmah_logs_verse_range_check
    check (end_verse_id >= start_verse_id),
  constraint quran_khatmah_logs_plan_owner_fkey
    foreign key (plan_id, user_id)
    references public.quran_khatmah_plans(id, user_id)
    on delete cascade,
  constraint quran_khatmah_logs_unique_range
    unique (plan_id, reading_date, start_verse_id, end_verse_id)
);

create index quran_khatmah_logs_user_date_idx
  on public.quran_khatmah_reading_logs(user_id, reading_date desc);

create index quran_khatmah_logs_plan_date_idx
  on public.quran_khatmah_reading_logs(plan_id, reading_date desc);

create index quran_khatmah_logs_plan_owner_idx
  on public.quran_khatmah_reading_logs(plan_id, user_id);

create index quran_khatmah_logs_start_verse_idx
  on public.quran_khatmah_reading_logs(start_verse_id);

create index quran_khatmah_logs_end_verse_idx
  on public.quran_khatmah_reading_logs(end_verse_id);

alter table public.quran_khatmah_plans enable row level security;
alter table public.quran_khatmah_reading_logs enable row level security;

revoke all on public.quran_khatmah_plans from public, anon;
revoke all on public.quran_khatmah_reading_logs from public, anon;

grant select, insert, update, delete
  on public.quran_khatmah_plans to authenticated;
grant select, insert, update, delete
  on public.quran_khatmah_reading_logs to authenticated;

grant all on public.quran_khatmah_plans to service_role;
grant all on public.quran_khatmah_reading_logs to service_role;

create policy "Users manage their own Khatmah plans"
  on public.quran_khatmah_plans
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users manage their own Khatmah reading logs"
  on public.quran_khatmah_reading_logs
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace view public.quran_khatmah_daily_schedule
with (security_invoker = true)
as
with verse_total as (
  select count(*)::bigint as total_verses
  from public.quran_verses
),
plan_days as (
  select
    p.id as plan_id,
    p.user_id,
    p.name as plan_name,
    p.duration_days,
    p.start_date,
    p.status,
    gs.day_number::smallint as day_number,
    vt.total_verses,
    (
      floor(((gs.day_number - 1)::numeric * vt.total_verses) / p.duration_days)::bigint + 1
    ) as start_verse_id,
    floor((gs.day_number::numeric * vt.total_verses) / p.duration_days)::bigint
      as end_verse_id
  from public.quran_khatmah_plans p
  cross join verse_total vt
  cross join lateral generate_series(1, p.duration_days) as gs(day_number)
  where p.status <> 'cancelled'
)
select
  plan_id,
  user_id,
  plan_name,
  status,
  day_number,
  start_date + (day_number - 1) as scheduled_date,
  start_verse_id,
  end_verse_id,
  (end_verse_id - start_verse_id + 1)::integer as target_verses
from plan_days;

create or replace view public.quran_khatmah_plan_summary
with (security_invoker = true)
as
with verse_total as (
  select count(*)::bigint as total_verses
  from public.quran_verses
),
activity as (
  select
    plan_id,
    user_id,
    max(end_verse_id)::bigint as last_read_verse_id,
    count(distinct reading_date)::integer as reading_days,
    count(*)::bigint as reading_sessions
  from public.quran_khatmah_reading_logs
  group by plan_id, user_id
)
select
  p.id as plan_id,
  p.user_id,
  p.name,
  p.duration_days,
  p.start_date,
  (p.start_date + p.duration_days - 1) as target_end_date,
  p.status,
  p.completed_at,
  vt.total_verses,
  coalesce(a.last_read_verse_id, 0)::bigint as last_read_verse_id,
  round(
    (coalesce(a.last_read_verse_id, 0)::numeric * 100)
      / nullif(vt.total_verses, 0),
    2
  ) as progress_percentage,
  coalesce(a.reading_days, 0)::integer as reading_days,
  coalesce(a.reading_sessions, 0)::bigint as reading_sessions,
  p.created_at,
  p.updated_at
from public.quran_khatmah_plans p
cross join verse_total vt
left join activity a
  on a.plan_id = p.id
 and a.user_id = p.user_id;

revoke all on public.quran_khatmah_daily_schedule from public, anon;
revoke all on public.quran_khatmah_plan_summary from public, anon;
grant select on public.quran_khatmah_daily_schedule to authenticated;
grant select on public.quran_khatmah_plan_summary to authenticated;
