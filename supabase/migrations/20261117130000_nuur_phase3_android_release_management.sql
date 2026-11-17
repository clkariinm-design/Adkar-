-- NUUR Phase 3: strengthen Android release metadata invariants.
-- No release row is seeded: the actual APK URL and version must come from a real signed build.
alter table public.app_versions
  add constraint app_versions_minimum_not_above_release_check
  check (minimum_supported_version_code <= version_code);

alter table public.app_versions
  add constraint app_versions_apk_url_https_check
  check (apk_url ~ '^https://[^[:space:]]+$');

create unique index app_versions_one_active_per_platform_idx
  on public.app_versions (platform)
  where is_active = true;

create index app_versions_active_version_lookup_idx
  on public.app_versions (platform, version_code desc)
  where is_active = true;
