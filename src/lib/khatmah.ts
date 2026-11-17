import type {
  KhatmahDailyScheduleRow,
  KhatmahDurationDays,
  KhatmahPlan,
  KhatmahReadingLog,
  QuranSurah,
} from './supabase';

export const TOTAL_QURAN_VERSES = 6236;
export const MOGADISHU_TIMEZONE = 'Africa/Mogadishu';

export function getMogadishuDateString(date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: MOGADISHU_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return dateStr;
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  return utc.toISOString().slice(0, 10);
}

export function calculateTargetEndDate(startDate: string, durationDays: number): string {
  return addDaysToDateString(startDate, Math.max(0, durationDays - 1));
}

export function formatShortDate(dateStr: string, lang: 'so' | 'en'): string {
  const [y, m, d] = dateStr.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return dateStr;
  const utc = new Date(Date.UTC(y, m - 1, d));
  try {
    return new Intl.DateTimeFormat(lang === 'so' ? 'so-SO' : 'en-US', {
      timeZone: 'UTC',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(utc);
  } catch {
    return dateStr;
  }
}

export function buildOfflineKhatmahSchedule(plan: KhatmahPlan): KhatmahDailyScheduleRow[] {
  const duration = Math.max(1, plan.duration_days);
  const rows: KhatmahDailyScheduleRow[] = [];
  let prevEnd = 0;

  for (let day = 1; day <= duration; day += 1) {
    const endVerseId =
      day === duration
        ? TOTAL_QURAN_VERSES
        : Math.floor((TOTAL_QURAN_VERSES * day) / duration);
    const startVerseId = prevEnd + 1;
    const targetVerses = Math.max(0, endVerseId - startVerseId + 1);
    prevEnd = endVerseId;

    rows.push({
      plan_id: plan.id,
      user_id: plan.user_id,
      plan_name: plan.name,
      status: plan.status,
      day_number: day,
      scheduled_date: addDaysToDateString(plan.start_date, day - 1),
      start_verse_id: startVerseId,
      end_verse_id: endVerseId,
      target_verses: targetVerses,
    });
  }

  return rows;
}

export function makeRangeKey(startVerseId: number, endVerseId: number): string {
  return `${startVerseId}-${endVerseId}`;
}

export interface KhatmahProgressStats {
  totalDays: number;
  completedDaysCount: number;
  remainingDaysCount: number;
  completedVersesCount: number;
  remainingVersesCount: number;
  completionPercentage: number;
  isFullyCompleted: boolean;
  completedRangeKeys: Set<string>;
  logByRangeKey: Map<string, KhatmahReadingLog>;
  currentDay: KhatmahDailyScheduleRow | null;
}

/**
 * Calculates accurate Khatmah completion strictly by matching each scheduled day's
 * (start_verse_id, end_verse_id) against the user's recorded reading logs.
 */
export function computeKhatmahProgress(
  schedule: KhatmahDailyScheduleRow[],
  logs: KhatmahReadingLog[],
  todayMogadishu: string = getMogadishuDateString()
): KhatmahProgressStats {
  const completedRangeKeys = new Set<string>();
  const logByRangeKey = new Map<string, KhatmahReadingLog>();

  for (const log of logs) {
    const key = makeRangeKey(log.start_verse_id, log.end_verse_id);
    completedRangeKeys.add(key);
    if (!logByRangeKey.has(key)) {
      logByRangeKey.set(key, log);
    }
  }

  let completedDaysCount = 0;
  let completedVersesCount = 0;

  const sortedSchedule = [...schedule].sort((a, b) => a.day_number - b.day_number);

  for (const day of sortedSchedule) {
    const key = makeRangeKey(day.start_verse_id, day.end_verse_id);
    if (completedRangeKeys.has(key)) {
      completedDaysCount += 1;
      completedVersesCount += day.target_verses || day.end_verse_id - day.start_verse_id + 1;
    }
  }

  const totalDays = sortedSchedule.length;
  const remainingDaysCount = Math.max(0, totalDays - completedDaysCount);
  const remainingVersesCount = Math.max(0, TOTAL_QURAN_VERSES - completedVersesCount);
  const isFullyCompleted =
    totalDays > 0 &&
    completedDaysCount === totalDays &&
    completedVersesCount >= TOTAL_QURAN_VERSES;

  const rawPct =
    totalDays > 0
      ? isFullyCompleted
        ? 100
        : Math.min(99.9, Number(((completedVersesCount / TOTAL_QURAN_VERSES) * 100).toFixed(1)))
      : 0;

  const uncompleted = sortedSchedule.filter(
    (day) => !completedRangeKeys.has(makeRangeKey(day.start_verse_id, day.end_verse_id))
  );

  // Prefer today's scheduled uncompleted day, otherwise the earliest uncompleted day
  const todayUncompleted = uncompleted.find((d) => d.scheduled_date === todayMogadishu);
  const currentDay = todayUncompleted ?? uncompleted[0] ?? null;

  return {
    totalDays,
    completedDaysCount,
    remainingDaysCount,
    completedVersesCount,
    remainingVersesCount,
    completionPercentage: rawPct,
    isFullyCompleted,
    completedRangeKeys,
    logByRangeKey,
    currentDay,
  };
}

export interface VerseRef {
  surahId: number;
  verseNumber: number;
}

export function resolveVerseRefFromSurahs(
  verseId: number,
  surahs: QuranSurah[]
): VerseRef | null {
  if (!surahs || surahs.length === 0 || verseId < 1) return null;
  const ordered = [...surahs].sort((a, b) => a.id - b.id);
  let cumulative = 0;
  for (const surah of ordered) {
    if (verseId <= cumulative + surah.verse_count) {
      return {
        surahId: surah.id,
        verseNumber: verseId - cumulative,
      };
    }
    cumulative += surah.verse_count;
  }
  return null;
}

export function formatVerseRefLabel(
  verseId: number,
  surahs: QuranSurah[],
  lang: 'so' | 'en'
): string {
  const ref = resolveVerseRefFromSurahs(verseId, surahs);
  if (!ref) {
    return lang === 'so' ? `Aayadda #${verseId}` : `Verse #${verseId}`;
  }
  const surah = surahs.find((s) => s.id === ref.surahId);
  const surahName = surah ? (lang === 'so' ? surah.name_so : surah.name_en) : `${ref.surahId}`;
  return `${surahName} ${ref.surahId}:${ref.verseNumber}`;
}

export function getSupabaseErrorCode(err: unknown): string | null {
  if (!err || typeof err !== 'object') return null;
  const maybe = err as { code?: unknown };
  return typeof maybe.code === 'string' ? maybe.code : null;
}

export function isNetworkLikeError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  if (err instanceof TypeError) {
    const msg = err.message.toLowerCase();
    return msg.includes('fetch') || msg.includes('network') || msg.includes('load failed');
  }
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = String((err as { message?: unknown }).message ?? '').toLowerCase();
    return (
      msg.includes('failed to fetch') ||
      msg.includes('networkerror') ||
      msg.includes('network request failed') ||
      msg.includes('load failed')
    );
  }
  return false;
}

export function getDefaultPlanName(durationDays: KhatmahDurationDays, lang: 'so' | 'en'): string {
  return lang === 'so'
    ? `Khatmadda ${durationDays}-ka Maalmood`
    : `${durationDays}-Day Quran Khatmah`;
}
