# NUUR Admin Backend API

These endpoints are implemented in the NUUR Supabase project. They are backend contracts for the admin frontend; no frontend UI is included in this repository change.

## Authentication

- Use a real signed-in Supabase user. Anonymous sessions are never treated as administrators.
- After login, call `get_my_admin_role`. It returns `owner`, `editor`, `viewer`, or `null`.
- Do not trust a role supplied by the frontend or user metadata. Role checks are performed against `public.app_admins` in the database.
- Do not put a Supabase service-role/secret key in the app.

## RPC endpoints

### `get_my_admin_role()`

Returns the authenticated user's database-backed admin role, or `null`.

Example:

```ts
const { data: role, error } = await supabase.rpc("get_my_admin_role");
```

### `get_admin_dashboard_summary()`

Available to Owner, Editor, and Viewer. Returns aggregate counts without exposing personal user records.

Response shape:

```json
{
  "generated_at": "timestamp",
  "users": {
    "total_accounts": 0,
    "registered_users": 0,
    "anonymous_sessions": 0,
    "new_registered_users_7d": 0,
    "profiles": 0
  },
  "content": {
    "adhkar_categories": 0,
    "active_adhkar_categories": 0,
    "adhkar_items": 0,
    "active_adhkar_items": 0,
    "quran_surahs": 0,
    "quran_verses": 0,
    "quran_translations": 0,
    "reviewed_quran_translations": 0
  },
  "admins": {
    "owners": 0,
    "editors": 0,
    "viewers": 0
  },
  "announcements": {
    "total": 0,
    "active_now": 0
  },
  "app_versions": {
    "active_android_releases": 0
  }
}
```

Example:

```ts
const { data, error } = await supabase.rpc("get_admin_dashboard_summary");
```

### `admin_list_users(p_limit, p_offset, p_search)`

Owner only. Returns user directory rows from Supabase Auth joined to profiles and admin roles. Page size is capped at 100. Search matches email or display name. Anonymous accounts are returned with `is_anonymous: true` so the UI can distinguish guest sessions from registered users.

Fields: `user_id`, `email`, `display_name`, `created_at`, `last_sign_in_at`, `is_anonymous`, `admin_role`, `total_count`.

Example:

```ts
const { data, error } = await supabase.rpc("admin_list_users", {
  p_limit: 25,
  p_offset: 0,
  p_search: null
});
```

### `admin_set_admin_role(p_user_id, p_role)`

Owner only. Assigns `owner`, `editor`, or `viewer` to an existing Auth user. Pass `null` as `p_role` to remove that user's admin access. The current Owner cannot change their own role through this RPC, and the last Owner cannot be demoted or removed.

Example:

```ts
const { data, error } = await supabase.rpc("admin_set_admin_role", {
  p_user_id: existingAuthUserId,
  p_role: "editor"
});
```

This RPC does not invite new Auth users, ban users, or delete accounts. Those operations require a trusted Auth Admin API/Edge Function and must never use a service-role key in the Android client.

## Role matrix

| Area | Viewer | Editor | Owner |
|---|---:|---:|---:|
| Read admin dashboard summary | Yes | Yes | Yes |
| Read all adhkar categories/items | Yes | Yes | Yes |
| Create/update/delete adhkar categories/items | No | Yes | Yes |
| Read all announcements | Yes | Yes | Yes |
| Create/update/delete announcements | No | Yes | Yes |
| Read internal app settings/releases | Yes | Yes | Yes |
| Change maintenance/app settings | No | No | Yes |
| Create/manage Android release rows | No | No | Yes |
| Edit Quran surahs/verses/translations | No | No | Yes |
| Manage content source metadata | No | No | Yes |
| Read user directory (email and account timestamps) | No | No | Yes |
| Assign/remove admin roles | No | No | Yes |
| Read admin activity log | No | No | Yes |

The public app continues to read active adhkar, Quran content, current announcements, public settings, and active app-version rows according to existing RLS policies.

## Audit log

Changes to admin settings, app versions, announcements, admin roles, adhkar categories/items, Quran surahs/verses/translations, and content source metadata are written to `public.admin_activity_logs`. Only the Owner can read the audit log. Test changes used to verify the trigger were rolled back and were not kept as production data.

## Current backend data snapshot

At the last verification:
- 16 Auth accounts total: 2 registered accounts and 14 anonymous accounts.
- 6 adhkar categories and 8 adhkar items.
- 114 Quran surahs, 6,236 verses, and 6,236 Somali translation rows marked reviewed.
- 1 Owner; no Editor or Viewer accounts yet.
- No announcement rows and no active Android release row.

The `is_reviewed` flag is a database status field; it is not independent proof that every translation has been linguistically or religiously validated.

## Still requires app-side integration or release material

1. Build the admin dashboard and role-aware screens in Google AI Studio using the RPC names above.
2. Connect the maintenance settings, announcements, and version-check UI to their existing tables/RPC/data policies.
3. Add a real signed Android release and a stable HTTPS APK URL before creating an active `app_versions` row. The backend deliberately has no fake release URL or version record.
4. Complete and source-check the adhkar content. The current database contains only 8 adhkar items; missing content should be added with traceable references, not generated without verification.
5. Test the final Android app online/offline behavior after the frontend integration. Backend readiness alone does not make the app offline-capable.
