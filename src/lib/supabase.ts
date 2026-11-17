import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://krhuhunxxogrvhohjljh.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_XeoENrHAvhVUUob87baq7g_Y7C_Jzgk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export interface QuranSurah {
  id: number;
  name_ar: string;
  name_so: string;
  name_en: string;
  transliteration: string;
  revelation_place: 'meccan' | 'medinan' | string;
  verse_count: number;
  sort_order: number;
}

export interface QuranTranslation {
  id: number;
  verse_id: number;
  language_code: string;
  translator: string | null;
  translation_text: string;
  source_name: string | null;
  source_url: string | null;
  license: string | null;
  is_reviewed: boolean | null;
  edition_key: string | null;
  edition_version: string | null;
  footnotes: string | null;
  text_direction: string | null;
}

export interface QuranVerse {
  id: number;
  surah_id: number;
  verse_number: number;
  text_uthmani: string;
  text_simple: string | null;
  juz_number: number | null;
  hizb_number: number | null;
  page_number: number | null;
  sajda: boolean | null;
  quran_translations?: QuranTranslation[];
}

export interface AdhkarCategory {
  id: string;
  slug: string;
  name_ar: string;
  name_so: string;
  name_en: string;
  description_so: string | null;
  description_en: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface AdhkarItem {
  id: string;
  category_id: string;
  content_ar: string;
  transliteration: string | null;
  translation_so: string | null;
  translation_en: string | null;
  reference_text: string | null;
  virtue_so: string | null;
  virtue_en: string | null;
  repeat_count: number;
  sort_order: number;
  is_active: boolean;
  source_url: string | null;
  source_grade: string | null;
}

export interface Profile {
  id: string;
  display_name: string | null;
  locale: string | null;
  timezone: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface UserProgress {
  id: string;
  user_id: string;
  adhkar_item_id: string;
  progress_date: string;
  count: number;
  updated_at: string;
}

export interface DailyGoal {
  id: string;
  user_id: string;
  goal_date: string;
  target_count: number;
  created_at: string;
  updated_at: string;
}

export interface FavoriteAdhkar {
  user_id: string;
  adhkar_item_id: string;
  created_at: string;
}

export interface Reminder {
  id: string;
  user_id: string;
  reminder_type: string;
  reminder_time: string;
  timezone: string;
  weekdays: number[];
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface QuranBookmark {
  user_id: string;
  verse_id: number;
  note: string | null;
  created_at: string;
  quran_verses?: QuranVerse;
}

export interface QuranReadingProgress {
  user_id: string;
  last_surah_id: number;
  last_verse_number: number;
  last_read_at: string;
  completed_khatm_count?: number;
}

export interface TasbihCounter {
  id: string;
  user_id: string;
  title: string;
  dhikr_text_ar: string | null;
  target_count: number;
  total_count: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface TasbihSession {
  id: string;
  user_id: string;
  counter_id: string;
  dhikr_label: string;
  count: number;
  session_date: string;
  created_at: string;
}

export type LocalizedJsonb =
  | {
      so?: string;
      en?: string;
      ar?: string;
    }
  | string
  | null
  | undefined;

export function pickLocalizedText(val: LocalizedJsonb, lang: 'so' | 'en'): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (lang === 'en') {
    return val.en || val.so || val.ar || '';
  }
  return val.so || val.en || val.ar || '';
}

export interface AppSetting {
  setting_key: string;
  setting_value: unknown;
  is_public: boolean;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface AppVersion {
  id: string;
  platform: string;
  version_code: number;
  version_name: string;
  release_notes: LocalizedJsonb;
  apk_url: string | null;
  is_mandatory: boolean;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
}

export interface AppAnnouncement {
  id: string;
  title: LocalizedJsonb;
  body: LocalizedJsonb;
  announcement_type: 'info' | 'warning' | 'update' | 'maintenance' | string;
  priority: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  created_by: string | null;
}

export interface ContentSource {
  source_slug: string;
  source_name: string;
  source_url: string | null;
  license: string | null;
  attribution_notice: string | null;
  data_version: string | null;
  checked_at: string | null;
}

export type KhatmahDurationDays = 30 | 60 | 90;
export type KhatmahPlanStatus = 'active' | 'paused' | 'completed' | 'cancelled';

export interface KhatmahPlan {
  id: string;
  user_id: string;
  name: string;
  duration_days: KhatmahDurationDays | number;
  start_date: string;
  status: KhatmahPlanStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface KhatmahReadingLog {
  id: string;
  plan_id: string;
  user_id: string;
  reading_date: string;
  start_verse_id: number;
  end_verse_id: number;
  note: string | null;
  created_at: string;
}

export interface KhatmahDailyScheduleRow {
  plan_id: string;
  user_id: string;
  plan_name: string;
  status: KhatmahPlanStatus;
  day_number: number;
  scheduled_date: string;
  start_verse_id: number;
  end_verse_id: number;
  target_verses: number;
}

export interface KhatmahPlanSummary {
  plan_id: string;
  user_id: string;
  name: string;
  duration_days: number;
  start_date: string;
  target_end_date: string;
  status: KhatmahPlanStatus;
  completed_at: string | null;
  total_verses: number;
  last_read_verse_id: number | null;
  progress_percentage: number | null;
  reading_days: number;
  reading_sessions: number;
  created_at: string;
  updated_at: string;
}
