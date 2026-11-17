-- NUUR Phase 2: Remote app settings seed
-- Safe defaults: maintenance mode stays disabled until an Owner enables it.
insert into public.app_settings (setting_key, setting_value, is_public, description)
values
  ('maintenance_mode', 'false'::jsonb, true, 'Turns the NUUR app maintenance screen on or off.'),
  ('maintenance_message', '"NUUR si ku-meel-gaar ah ayuu u xiran yahay. Fadlan dib u soo noqo."'::jsonb, true, 'Message shown to users while maintenance mode is enabled.'),
  ('maintenance_end_at', 'null'::jsonb, true, 'Optional ISO-8601 timestamp for the expected end of maintenance.')
on conflict (setting_key) do nothing;
