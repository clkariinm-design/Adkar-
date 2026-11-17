# NUUR Read-only Health Monitor

A small Node.js cron job for the NUUR project. It reads public Quran/Adhkar data from Supabase, checks structural completeness, and tests that user-specific endpoints do not return rows to anonymous requests.

## What it checks

- Supabase REST API availability.
- 114 surah records and 6,236 Quran verses.
- Contiguous global verse IDs and per-surah verse numbering against the surah metadata.
- One Somali translation row for each of the 6,236 verses.
- The count of Somali translations marked `is_reviewed=true` (this flag is reported, not treated as proof of linguistic or religious correctness).
- Active Adhkar category and item counts.
- Anonymous visibility of user-specific tables and Khatmah views.

The monitor is strictly read-only. It does not write to Supabase, does not use a service-role key, and does not use Firebase, FCM, or push notifications. It checks database structure and access behavior; it cannot certify the scholarly correctness of Quran text or translations.

## Environment variables

Set these on the Railway service:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

Use only the Supabase publishable key. Never add a service-role key to this service.

## Run locally

```bash
npm test
npm start
```

## Railway schedule

Configured as a cron job at `0 3 * * *` UTC (06:00 Africa/Mogadishu / Hargeysa). Results are written to Railway deployment logs. A failed integrity or privacy check exits with a non-zero status.
