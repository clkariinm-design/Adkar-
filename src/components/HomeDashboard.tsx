import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  Bell,
  BookOpen,
  Compass,
  HeartHandshake,
  Moon,
  Sun,
  Target,
  Check,
  Edit3,
  Megaphone,
  Download,
  AlertTriangle,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useApp } from '../contexts/AppContext';
import {
  pickLocalizedText,
  supabase,
  type DailyGoal,
  type KhatmahDailyScheduleRow,
  type KhatmahPlan,
  type KhatmahReadingLog,
  type QuranReadingProgress,
  type QuranSurah,
  type QuranVerse,
  type Reminder,
} from '../lib/supabase';
import { getCurrentTimePartsInTimezone, getTodayDateString, WEEKDAY_LABELS } from '../lib/i18n';
import { enqueueSyncOp, getCachedValue, getQueuedOps, setCachedValue } from '../lib/offlineStore';
import {
  buildOfflineKhatmahSchedule,
  calculateTargetEndDate,
  computeKhatmahProgress,
  formatShortDate,
  getMogadishuDateString,
  makeRangeKey,
  type KhatmahProgressStats,
} from '../lib/khatmah';

interface DashboardData {
  surahsCount: number;
  progress: QuranReadingProgress | null;
  progressSurah: QuranSurah | null;
  progressVerse: QuranVerse | null;
  dailyGoal: DailyGoal | null;
  adhkarTodayCount: number;
  tasbihTodayCount: number;
  reminders: Reminder[];
  activeKhatmahPlan: KhatmahPlan | null;
  khatmahProgress: KhatmahProgressStats | null;
}

export function HomeDashboard() {
  const {
    user,
    profile,
    lang,
    setLang,
    theme,
    toggleTheme,
    t,
    setActiveTab,
    openQuranAt,
    openKhatmah,
    showToast,
    isOnline,
    activeAnnouncements,
    latestAndroidVersion,
    updateStatus,
    setUpdateModalOpen,
  } = useApp();

  const [data, setData] = useState<DashboardData>({
    surahsCount: 114,
    progress: null,
    progressSurah: null,
    progressVerse: null,
    dailyGoal: null,
    adhkarTodayCount: 0,
    tasbihTodayCount: 0,
    reminders: [],
    activeKhatmahPlan: null,
    khatmahProgress: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState('33');
  const [savingGoal, setSavingGoal] = useState(false);

  const tz = profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const todayStr = getTodayDateString(tz);

  const loadDashboard = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const cacheKey = `dashboard:${user.id}:${todayStr}`;
    try {
      const [surahCountRes, progRes, goalRes, adhkarRes, tasbihRes, remRes, khatmahPlansRes, khatmahLogsRes] =
        await Promise.all([
          supabase.from('quran_surahs').select('id', { count: 'exact', head: true }),
          supabase
            .from('quran_reading_progress')
            .select('user_id, last_surah_id, last_verse_number, last_read_at')
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('daily_goals')
            .select('id, user_id, goal_date, target_count, created_at, updated_at')
            .eq('user_id', user.id)
            .eq('goal_date', todayStr)
            .maybeSingle(),
          supabase
            .from('user_progress')
            .select('count')
            .eq('user_id', user.id)
            .eq('progress_date', todayStr),
          supabase
            .from('tasbih_sessions')
            .select('count')
            .eq('user_id', user.id)
            .eq('session_date', todayStr),
          supabase
            .from('reminders')
            .select('id, user_id, reminder_type, reminder_time, timezone, weekdays, is_enabled, created_at, updated_at')
            .eq('user_id', user.id)
            .eq('is_enabled', true)
            .order('reminder_time', { ascending: true }),
          supabase
            .from('quran_khatmah_plans')
            .select('id, user_id, name, duration_days, start_date, status, completed_at, created_at, updated_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false }),
          supabase
            .from('quran_khatmah_reading_logs')
            .select('id, plan_id, user_id, reading_date, start_verse_id, end_verse_id, note, created_at')
            .eq('user_id', user.id),
        ]);

      if (surahCountRes.error) throw surahCountRes.error;
      if (progRes.error) throw progRes.error;
      if (goalRes.error) throw goalRes.error;
      if (adhkarRes.error) throw adhkarRes.error;
      if (tasbihRes.error) throw tasbihRes.error;
      if (remRes.error) throw remRes.error;

      let progressSurah: QuranSurah | null = null;
      let progressVerse: QuranVerse | null = null;

      if (progRes.data) {
        const [surahRes, verseRes] = await Promise.all([
          supabase.from('quran_surahs').select('*').eq('id', progRes.data.last_surah_id).maybeSingle(),
          supabase
            .from('quran_verses')
            .select(
              'id, surah_id, verse_number, text_uthmani, sajda, quran_translations(id, verse_id, language_code, translator, translation_text, edition_version)'
            )
            .eq('surah_id', progRes.data.last_surah_id)
            .eq('verse_number', progRes.data.last_verse_number)
            .maybeSingle(),
        ]);
        progressSurah = surahRes.data ?? null;
        progressVerse = (verseRes.data as QuranVerse | null) ?? null;
      }

      // Compute accurate Khatmah progress (overlaying any queued offline ops)
      const serverPlans = (khatmahPlansRes.data as KhatmahPlan[] | null) ?? [];
      const serverLogs = (khatmahLogsRes.data as KhatmahReadingLog[] | null) ?? [];
      const ops = await getQueuedOps(user.id);
      const planMap = new Map<string, KhatmahPlan>(serverPlans.map((p) => [p.id, p]));
      const mergedLogs = [...serverLogs];
      const seenLogKeys = new Set(
        serverLogs.map((l) => `${l.plan_id}:${makeRangeKey(l.start_verse_id, l.end_verse_id)}`)
      );

      for (const op of ops) {
        if (op.type === 'khatmah_plan_create') {
          const p = op.payload as unknown as KhatmahPlan;
          if (!planMap.has(p.id)) planMap.set(p.id, { ...p, user_id: user.id, completed_at: null });
        } else if (op.type === 'khatmah_plan_status') {
          const { plan_id, status, completed_at, updated_at } = op.payload as {
            plan_id: string;
            status: KhatmahPlan['status'];
            completed_at: string | null;
            updated_at: string;
          };
          const existing = planMap.get(plan_id);
          if (existing) {
            planMap.set(plan_id, { ...existing, status, completed_at, updated_at });
          }
        } else if (op.type === 'khatmah_reading_log') {
          const l = op.payload as unknown as KhatmahReadingLog;
          const k = `${l.plan_id}:${makeRangeKey(l.start_verse_id, l.end_verse_id)}`;
          if (!seenLogKeys.has(k)) {
            seenLogKeys.add(k);
            mergedLogs.push({ ...l, user_id: user.id });
          }
        }
      }

      const allPlans = Array.from(planMap.values());
      const activeKhatmahPlan = allPlans.find((p) => p.status === 'active') ?? null;
      let khatmahProgress: KhatmahProgressStats | null = null;

      if (activeKhatmahPlan) {
        const { data: schedData } = await supabase
          .from('quran_khatmah_daily_schedule')
          .select('plan_id, user_id, plan_name, status, day_number, scheduled_date, start_verse_id, end_verse_id, target_verses')
          .eq('plan_id', activeKhatmahPlan.id)
          .eq('user_id', user.id)
          .order('day_number', { ascending: true });
        const sched =
          schedData && schedData.length > 0
            ? (schedData as KhatmahDailyScheduleRow[])
            : buildOfflineKhatmahSchedule(activeKhatmahPlan);
        const planLogs = mergedLogs.filter((l) => l.plan_id === activeKhatmahPlan.id);
        khatmahProgress = computeKhatmahProgress(sched, planLogs, getMogadishuDateString());
      }

      const adhkarSum = (adhkarRes.data ?? []).reduce((acc, row) => acc + (row.count || 0), 0);
      const tasbihSum = (tasbihRes.data ?? []).reduce((acc, row) => acc + (row.count || 0), 0);

      if (goalRes.data) {
        setGoalInput(String(goalRes.data.target_count));
      }

      const nextData: DashboardData = {
        surahsCount: surahCountRes.count ?? 114,
        progress: progRes.data ?? null,
        progressSurah,
        progressVerse,
        dailyGoal: goalRes.data ?? null,
        adhkarTodayCount: adhkarSum,
        tasbihTodayCount: tasbihSum,
        reminders: remRes.data ?? [],
        activeKhatmahPlan,
        khatmahProgress,
      };
      setData(nextData);
      await setCachedValue(cacheKey, nextData);
    } catch (err) {
      const [cached, cachedKPlans, cachedKLogs, ops] = await Promise.all([
        getCachedValue<DashboardData>(cacheKey),
        getCachedValue<KhatmahPlan[]>(`khatmah:plans:${user.id}`),
        getCachedValue<KhatmahReadingLog[]>(`khatmah:logs:${user.id}`),
        getQueuedOps(user.id),
      ]);

      const planMap = new Map<string, KhatmahPlan>((cachedKPlans ?? []).map((p) => [p.id, p]));
      const mergedLogs = [...(cachedKLogs ?? [])];
      const seenLogKeys = new Set(
        mergedLogs.map((l) => `${l.plan_id}:${makeRangeKey(l.start_verse_id, l.end_verse_id)}`)
      );

      for (const op of ops) {
        if (op.type === 'khatmah_plan_create') {
          const p = op.payload as unknown as KhatmahPlan;
          if (!planMap.has(p.id)) planMap.set(p.id, { ...p, user_id: user.id, completed_at: null });
        } else if (op.type === 'khatmah_plan_status') {
          const { plan_id, status, completed_at, updated_at } = op.payload as {
            plan_id: string;
            status: KhatmahPlan['status'];
            completed_at: string | null;
            updated_at: string;
          };
          const existing = planMap.get(plan_id);
          if (existing) {
            planMap.set(plan_id, { ...existing, status, completed_at, updated_at });
          }
        } else if (op.type === 'khatmah_reading_log') {
          const l = op.payload as unknown as KhatmahReadingLog;
          const k = `${l.plan_id}:${makeRangeKey(l.start_verse_id, l.end_verse_id)}`;
          if (!seenLogKeys.has(k)) {
            seenLogKeys.add(k);
            mergedLogs.push({ ...l, user_id: user.id });
          }
        }
      }

      const activeKhatmahPlan =
        Array.from(planMap.values()).find((p) => p.status === 'active') ??
        cached?.activeKhatmahPlan ??
        null;
      let khatmahProgress = cached?.khatmahProgress ?? null;
      if (activeKhatmahPlan) {
        const cachedSched = await getCachedValue<KhatmahDailyScheduleRow[]>(
          `khatmah:schedule:${user.id}:${activeKhatmahPlan.id}`
        );
        const sched =
          cachedSched && cachedSched.length > 0
            ? cachedSched
            : buildOfflineKhatmahSchedule(activeKhatmahPlan);
        const planLogs = mergedLogs.filter((l) => l.plan_id === activeKhatmahPlan.id);
        khatmahProgress = computeKhatmahProgress(sched, planLogs, getMogadishuDateString());
      }

      if (cached) {
        setData({ ...cached, activeKhatmahPlan, khatmahProgress });
        if (cached.dailyGoal) {
          setGoalInput(String(cached.dailyGoal.target_count));
        }
      } else if (activeKhatmahPlan) {
        setData((prev) => ({ ...prev, activeKhatmahPlan, khatmahProgress }));
      } else if (!isOnline) {
        setError(t.offline.offlineBadge);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      }
    } finally {
      setLoading(false);
    }
  }, [user, todayStr, isOnline, t.offline.offlineBadge]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = Math.max(1, Math.min(10000, parseInt(goalInput, 10) || 33));
    const nowIso = new Date().toISOString();
    setSavingGoal(true);

    const optimisticGoal: DailyGoal = {
      id: data.dailyGoal?.id ?? `local_${todayStr}`,
      user_id: user.id,
      goal_date: todayStr,
      target_count: parsed,
      created_at: data.dailyGoal?.created_at ?? nowIso,
      updated_at: nowIso,
    };

    const queueLocally = async () => {
      await enqueueSyncOp(user.id, 'daily_goal', `daily_goal:${user.id}:${todayStr}`, {
        goal_date: todayStr,
        target_count: parsed,
        updated_at: nowIso,
      });
      setData((prev) => {
        const next = { ...prev, dailyGoal: optimisticGoal };
        void setCachedValue(`dashboard:${user.id}:${todayStr}`, next);
        return next;
      });
      setEditingGoal(false);
      showToast(t.account.dailyGoalSaved, 'info');
    };

    try {
      if (!isOnline) {
        await queueLocally();
        return;
      }
      const { data: saved, error: upsertErr } = await supabase
        .from('daily_goals')
        .upsert(
          {
            user_id: user.id,
            goal_date: todayStr,
            target_count: parsed,
            updated_at: nowIso,
          },
          { onConflict: 'user_id,goal_date' }
        )
        .select('*')
        .single();
      if (upsertErr) throw upsertErr;
      setData((prev) => {
        const next = { ...prev, dailyGoal: saved };
        void setCachedValue(`dashboard:${user.id}:${todayStr}`, next);
        return next;
      });
      setEditingGoal(false);
      showToast(t.account.dailyGoalSaved, 'success');
    } catch (err) {
      if (!isOnline || (err instanceof TypeError && err.message.toLowerCase().includes('fetch'))) {
        await queueLocally();
      } else {
        showToast(err instanceof Error ? err.message : 'Error saving goal', 'error');
      }
    } finally {
      setSavingGoal(false);
    }
  };

  const totalTodayDhikr = data.adhkarTodayCount + data.tasbihTodayCount;
  const targetCount = data.dailyGoal?.target_count ?? 100;
  const goalPct = Math.min(100, Math.round((totalTodayDhikr / Math.max(1, targetCount)) * 100));

  const isReminderDueSoon = (rem: Reminder) => {
    const nowParts = getCurrentTimePartsInTimezone(rem.timezone || tz);
    if (Array.isArray(rem.weekdays) && rem.weekdays.length > 0 && !rem.weekdays.includes(nowParts.weekday)) {
      return false;
    }
    const [hh, mm] = (rem.reminder_time || '00:00').split(':').map((n) => parseInt(n, 10) || 0);
    const remMins = hh * 60 + mm;
    const diff = remMins - nowParts.minutesSinceMidnight;
    return diff >= -30 && diff <= 90;
  };

  const reminderTypeLabel = (type: string) => {
    if (type === 'morning') return t.account.types.morning;
    if (type === 'evening') return t.account.types.evening;
    if (type === 'quran') return t.account.types.quran;
    return t.account.types.custom;
  };

  return (
    <div className="space-y-8">
      {/* Workspace Utility Strip: Greeting + Language/Theme Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-[#14241E] dark:text-[#F2EFE9]">
            {t.home.salam}
            {profile?.display_name ? `, ${profile.display_name}` : ''}
          </h1>
          <p className="mt-1 text-sm text-[#52635C] dark:text-[#A3B8AF]">
            {t.home.subtitleSignedIn}
          </p>
        </div>

        <div className="hidden md:flex items-center gap-2 shrink-0">
          <div className="flex items-center p-1 rounded-lg bg-[#EFECE4] dark:bg-[#0C1F19] border border-[#E5DFD3] dark:border-[#1B3A2F]">
            <button
              type="button"
              onClick={() => setLang('so')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                lang === 'so'
                  ? 'bg-white dark:bg-[#143328] text-[#064E3B] dark:text-[#F2EFE9] shadow-xs'
                  : 'text-[#52635C] dark:text-[#8FA89E] hover:text-[#14241E] dark:hover:text-[#F2EFE9]'
              }`}
            >
              {t.common.somali}
            </button>
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                lang === 'en'
                  ? 'bg-white dark:bg-[#143328] text-[#064E3B] dark:text-[#F2EFE9] shadow-xs'
                  : 'text-[#52635C] dark:text-[#8FA89E] hover:text-[#14241E] dark:hover:text-[#F2EFE9]'
              }`}
            >
              {t.common.english}
            </button>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-white dark:bg-[#0C1F19] border border-[#E5DFD3] dark:border-[#1B3A2F] text-[#14241E] dark:text-[#F2EFE9] hover:border-[#064E3B] dark:hover:border-[#34D399] transition-colors whitespace-nowrap"
          >
            {theme === 'light' ? (
              <>
                <Moon className="w-3.5 h-3.5 text-[#52635C]" />
                <span>{t.common.darkMode}</span>
              </>
            ) : (
              <>
                <Sun className="w-3.5 h-3.5 text-[#D4AF6A]" />
                <span>{t.common.lightMode}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Android App Update Banner */}
      {updateStatus !== 'none' && latestAndroidVersion && (
        <div
          className={`rounded-2xl border p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            updateStatus === 'mandatory'
              ? 'border-[#FECACA] dark:border-[#7F1D1D] bg-[#FEF2F2] dark:bg-[#2A1215]'
              : 'border-[#D8CEB8] dark:border-[#244A3C] bg-[#F5F1E6] dark:bg-[#0C1F19]'
          }`}
        >
          <div className="flex items-start gap-3">
            {updateStatus === 'mandatory' ? (
              <AlertTriangle className="w-5 h-5 text-[#991B1B] dark:text-[#FCA5A5] shrink-0 mt-0.5" />
            ) : (
              <Download className="w-5 h-5 text-[#064E3B] dark:text-[#34D399] shrink-0 mt-0.5" />
            )}
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-[#14241E] dark:text-[#F2EFE9]">
                {t.updates.title} · v{latestAndroidVersion.version_name}
              </p>
              {pickLocalizedText(latestAndroidVersion.release_notes, lang) && (
                <p className="text-xs text-[#52635C] dark:text-[#A3B8AF] line-clamp-2">
                  {pickLocalizedText(latestAndroidVersion.release_notes, lang)}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setUpdateModalOpen(true)}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-[#064E3B] text-white dark:bg-[#10B981] dark:text-[#071410] text-xs font-semibold whitespace-nowrap self-start sm:self-auto"
          >
            {t.updates.downloadApk}
          </button>
        </div>
      )}

      {/* Active Remote Announcements */}
      {activeAnnouncements.length > 0 && (
        <section className="space-y-2.5" aria-label="Announcements">
          {activeAnnouncements.map((ann) => {
            const titleText = pickLocalizedText(ann.title, lang);
            const bodyText = pickLocalizedText(ann.body, lang);
            const isWarning = ann.announcement_type === 'warning' || ann.announcement_type === 'maintenance';
            return (
              <div
                key={ann.id}
                className={`rounded-2xl border p-4 sm:px-5 flex items-start gap-3 ${
                  isWarning
                    ? 'border-[#E6CFA0] dark:border-[#5C4820] bg-[#FDF6E7] dark:bg-[#231D11]'
                    : 'border-[#E5DFD3] dark:border-[#1B3A2F] bg-white dark:bg-[#0C1F19]'
                }`}
              >
                <Megaphone className="w-4 h-4 text-[#B48A3E] dark:text-[#D4AF6A] shrink-0 mt-1" />
                <div className="space-y-1 min-w-0">
                  {titleText && (
                    <h2 className="text-sm font-semibold text-[#14241E] dark:text-[#F2EFE9]">
                      {titleText}
                    </h2>
                  )}
                  {bodyText && (
                    <p className="text-xs sm:text-sm text-[#52635C] dark:text-[#A3B8AF] leading-relaxed">
                      {bodyText}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Primary Hero Anchor: Sanctuary Backdrop + Recently Read Verse */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch"
      >
        <div className="lg:col-span-8 relative overflow-hidden rounded-2xl border border-[#E5DFD3] dark:border-[#1B3A2F] bg-[#064E3B] text-[#FAF8F3] min-h-[260px] flex flex-col justify-end">
          {!heroImgFailed ? (
            <img
              src="/src/assets/images/nuur_sanctuary_hero_1794894602769.jpg"
              alt="NUUR Islamic sanctuary courtyard"
              referrerPolicy="no-referrer"
              onError={() => setHeroImgFailed(true)}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 islamic-lattice-bg bg-gradient-to-br from-[#064E3B] to-[#042F24]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#04241B]/95 via-[#04241B]/70 to-[#04241B]/30" />

          <div className="relative z-10 p-6 sm:p-8 flex flex-col justify-between gap-6">
            {loading ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-4 w-36 bg-white/20 rounded" />
                <div className="h-8 w-3/4 bg-white/20 rounded" />
                <div className="h-10 w-44 bg-white/20 rounded-lg" />
              </div>
            ) : data.progress && data.progressSurah ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#E6CFA0]">
                  <span>{t.home.recentlyRead}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {lang === 'so' ? data.progressSurah.name_so : data.progressSurah.name_en} ({data.progressSurah.id}:
                    {data.progress.last_verse_number})
                  </span>
                </div>

                {data.progressVerse && (() => {
                  const translation =
                    data.progressVerse.quran_translations?.find((tr) => tr.language_code === 'so') ??
                    data.progressVerse.quran_translations?.[0];
                  return (
                    <div className="space-y-2">
                      <p
                        dir="rtl"
                        lang="ar"
                        className="font-arabic text-2xl sm:text-3xl leading-[2] text-white line-clamp-2"
                      >
                        {data.progressVerse.text_uthmani}
                      </p>
                      {translation?.translation_text && (
                        <p className="text-sm text-[#E2ECE8] line-clamp-2 max-w-2xl">
                          {translation.translation_text}
                        </p>
                      )}
                    </div>
                  );
                })()}

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => openQuranAt(data.progress!.last_surah_id, data.progress!.last_verse_number)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#D4AF6A] text-[#071410] font-semibold text-sm hover:bg-[#E0BE7D] transition-colors whitespace-nowrap"
                  >
                    <span>{t.home.resumeReading}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-medium text-[#E6CFA0]">
                  <span>{t.appName}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {data.surahsCount} {t.home.surahsCountLabel}
                  </span>
                </div>
                <h2 className="font-display text-2xl sm:text-3xl font-semibold text-white max-w-xl text-balance">
                  {t.home.noProgressYet}
                </h2>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => openQuranAt(1, 1)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#D4AF6A] text-[#071410] font-semibold text-sm hover:bg-[#E0BE7D] transition-colors whitespace-nowrap"
                  >
                    <span>{t.home.startQuran}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Card: Daily Goal Progress */}
        <div className="lg:col-span-4 rounded-2xl border border-[#E5DFD3] dark:border-[#1B3A2F] bg-white dark:bg-[#0C1F19] p-6 flex flex-col justify-between gap-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-[#52635C] dark:text-[#8FA89E]">{t.common.today}</p>
              <h2 className="mt-1 font-display text-xl font-semibold text-[#14241E] dark:text-[#F2EFE9]">
                {t.home.dailyGoalsTitle}
              </h2>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#ECFDF5] dark:bg-[#112E24] flex items-center justify-center text-[#064E3B] dark:text-[#34D399]">
              <Target className="w-5 h-5" />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold tabular-nums text-[#064E3B] dark:text-[#34D399]">
                {totalTodayDhikr}
              </span>
              <span className="text-sm tabular-nums text-[#52635C] dark:text-[#A3B8AF]">
                {t.common.of} {targetCount}
              </span>
            </div>

            <div className="h-2.5 w-full rounded-full bg-[#EFECE4] dark:bg-[#143328] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#064E3B] dark:bg-[#10B981] transition-all duration-300"
                style={{ width: `${goalPct}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-[#52635C] dark:text-[#8FA89E] tabular-nums">
              <span>
                {t.home.adhkarTodayLabel}: {data.adhkarTodayCount}
              </span>
              <span>
                {t.home.tasbihTodayLabel}: {data.tasbihTodayCount}
              </span>
            </div>
          </div>

          {editingGoal ? (
            <form
              onSubmit={handleSaveGoal}
              className="flex items-center gap-2 pt-2 border-t border-[#EFECE4] dark:border-[#18352B]"
            >
              <input
                type="number"
                min={1}
                max={10000}
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                aria-label={t.home.dailyTargetLabel}
                className="w-24 px-3 py-2 text-sm tabular-nums rounded-lg border border-[#D8D0C0] dark:border-[#244A3C] bg-[#FAF8F3] dark:bg-[#071410] text-[#14241E] dark:text-[#F2EFE9]"
              />
              <button
                type="submit"
                disabled={savingGoal}
                className="px-3 py-2 rounded-lg bg-[#064E3B] text-white text-xs font-medium hover:bg-[#053F30] dark:bg-[#10B981] dark:text-[#071410] inline-flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{t.common.save}</span>
              </button>
              <button
                type="button"
                onClick={() => setEditingGoal(false)}
                className="px-2.5 py-2 text-xs text-[#52635C] dark:text-[#8FA89E] hover:text-[#14241E]"
              >
                {t.common.cancel}
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setEditingGoal(true)}
              className="w-full py-2.5 px-4 rounded-xl border border-[#E5DFD3] dark:border-[#1B3A2F] text-sm font-medium text-[#14241E] dark:text-[#F2EFE9] hover:bg-[#FAF8F3] dark:hover:bg-[#112921] transition-colors inline-flex items-center justify-center gap-2"
            >
              <Edit3 className="w-4 h-4 text-[#B48A3E] dark:text-[#D4AF6A]" />
              <span>{t.home.editGoal}</span>
            </button>
          )}
        </div>
      </motion.section>

      {error && (
        <div className="p-4 rounded-xl border border-[#FECACA] dark:border-[#7F1D1D] bg-[#FEF2F2] dark:bg-[#2A1215] flex items-center justify-between gap-4">
          <p className="text-sm text-[#991B1B] dark:text-[#FCA5A5]">{error}</p>
          <button
            type="button"
            onClick={loadDashboard}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#991B1B] text-white whitespace-nowrap"
          >
            {t.common.retry}
          </button>
        </div>
      )}

      {/* Khatmadda Qur'aanka Entry Card */}
      <section className="rounded-2xl border border-[#E5DFD3] dark:border-[#1B3A2F] bg-white dark:bg-[#0C1F19] p-6">
        {data.activeKhatmahPlan && data.khatmahProgress ? (
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="space-y-3 flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#52635C] dark:text-[#8FA89E] tabular-nums">
                <span className="font-semibold text-[#064E3B] dark:text-[#34D399]">
                  {t.khatmah.title}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {data.activeKhatmahPlan.duration_days} {t.khatmah.daysUnit}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {formatShortDate(
                    calculateTargetEndDate(
                      data.activeKhatmahPlan.start_date,
                      data.activeKhatmahPlan.duration_days
                    ),
                    lang
                  )}
                </span>
              </div>

              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-lg sm:text-xl font-semibold text-[#14241E] dark:text-[#F2EFE9] truncate">
                  {data.activeKhatmahPlan.name}
                </h2>
                <span className="text-xl font-bold tabular-nums text-[#064E3B] dark:text-[#34D399] shrink-0">
                  {data.khatmahProgress.completionPercentage}%
                </span>
              </div>

              <div className="h-2.5 w-full rounded-full bg-[#EFECE4] dark:bg-[#143328] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#064E3B] dark:bg-[#10B981] transition-all duration-300"
                  style={{ width: `${Math.min(100, data.khatmahProgress.completionPercentage)}%` }}
                />
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-[#52635C] dark:text-[#A3B8AF] tabular-nums">
                <span>
                  {t.khatmah.completedDaysLabel}: {data.khatmahProgress.completedDaysCount}/
                  {data.khatmahProgress.totalDays}
                </span>
                <span>
                  {t.khatmah.remainingDaysLabel}: {data.khatmahProgress.remainingDaysCount}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={openKhatmah}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#064E3B] text-white dark:bg-[#10B981] dark:text-[#071410] text-sm font-semibold inline-flex items-center justify-center gap-2 hover:opacity-95 shrink-0 whitespace-nowrap"
            >
              <span>{t.khatmah.openTracker}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="font-display text-lg font-semibold text-[#14241E] dark:text-[#F2EFE9]">
                {t.khatmah.title}
              </h2>
              <p className="text-sm text-[#52635C] dark:text-[#A3B8AF]">
                {t.khatmah.homeCardEmptyDesc}
              </p>
            </div>
            <button
              type="button"
              onClick={openKhatmah}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#064E3B] text-white dark:bg-[#10B981] dark:text-[#071410] text-sm font-semibold inline-flex items-center justify-center gap-2 hover:opacity-95 shrink-0 whitespace-nowrap"
            >
              <span>{t.khatmah.homeCardCtaEmpty}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </section>

      {/* Quick Access Trio */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-[#14241E] dark:text-[#F2EFE9]">
          {t.home.quickAccess}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <button
            type="button"
            onClick={() => setActiveTab('quran')}
            className="group text-left p-6 rounded-2xl border border-[#E5DFD3] dark:border-[#1B3A2F] bg-white dark:bg-[#0C1F19] hover:border-[#064E3B] dark:hover:border-[#34D399] transition-colors flex flex-col justify-between gap-4"
          >
            <div className="flex items-center justify-between">
              <div className="w-11 h-11 rounded-xl bg-[#ECFDF5] dark:bg-[#112E24] flex items-center justify-center text-[#064E3B] dark:text-[#34D399]">
                <BookOpen className="w-5 h-5" />
              </div>
              <span className="text-xs font-medium tabular-nums text-[#B48A3E] dark:text-[#D4AF6A]">
                {data.surahsCount} {t.quran.modeSurahs}
              </span>
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-[#14241E] dark:text-[#F2EFE9] group-hover:text-[#064E3B] dark:group-hover:text-[#34D399] transition-colors">
                {t.nav.quran}
              </h3>
              <p className="mt-1 text-sm text-[#52635C] dark:text-[#A3B8AF] leading-relaxed">
                {t.home.quranCardDesc}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('adhkar')}
            className="group text-left p-6 rounded-2xl border border-[#E5DFD3] dark:border-[#1B3A2F] bg-white dark:bg-[#0C1F19] hover:border-[#064E3B] dark:hover:border-[#34D399] transition-colors flex flex-col justify-between gap-4"
          >
            <div className="flex items-center justify-between">
              <div className="w-11 h-11 rounded-xl bg-[#FDF6E7] dark:bg-[#231D11] flex items-center justify-center text-[#B48A3E] dark:text-[#D4AF6A]">
                <HeartHandshake className="w-5 h-5" />
              </div>
              <span className="text-xs font-medium text-[#52635C] dark:text-[#8FA89E]">
                {t.adhkar.title}
              </span>
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-[#14241E] dark:text-[#F2EFE9] group-hover:text-[#064E3B] dark:group-hover:text-[#34D399] transition-colors">
                {t.nav.adhkar}
              </h3>
              <p className="mt-1 text-sm text-[#52635C] dark:text-[#A3B8AF] leading-relaxed">
                {t.home.adhkarCardDesc}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tasbih')}
            className="group text-left p-6 rounded-2xl border border-[#E5DFD3] dark:border-[#1B3A2F] bg-white dark:bg-[#0C1F19] hover:border-[#064E3B] dark:hover:border-[#34D399] transition-colors flex flex-col justify-between gap-4"
          >
            <div className="flex items-center justify-between">
              <div className="w-11 h-11 rounded-xl bg-[#ECFDF5] dark:bg-[#112E24] flex items-center justify-center text-[#064E3B] dark:text-[#34D399]">
                <Compass className="w-5 h-5" />
              </div>
              <span className="text-xs font-medium tabular-nums text-[#52635C] dark:text-[#8FA89E]">
                {data.tasbihTodayCount} {t.common.today}
              </span>
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-[#14241E] dark:text-[#F2EFE9] group-hover:text-[#064E3B] dark:group-hover:text-[#34D399] transition-colors">
                {t.nav.tasbih}
              </h3>
              <p className="mt-1 text-sm text-[#52635C] dark:text-[#A3B8AF] leading-relaxed">
                {t.home.tasbihCardDesc}
              </p>
            </div>
          </button>
        </div>
      </section>

      {/* Active Reminders Overview */}
      <section className="rounded-2xl border border-[#E5DFD3] dark:border-[#1B3A2F] bg-white dark:bg-[#0C1F19] p-6">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#EFECE4] dark:border-[#18352B]">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-[#B48A3E] dark:text-[#D4AF6A]" />
            <h2 className="font-display text-lg font-semibold text-[#14241E] dark:text-[#F2EFE9]">
              {t.home.remindersCardTitle}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('account')}
            className="text-sm font-medium text-[#064E3B] dark:text-[#34D399] hover:underline whitespace-nowrap"
          >
            {t.home.manageReminders}
          </button>
        </div>

        {data.reminders.length === 0 ? (
          <p className="pt-4 text-sm text-[#52635C] dark:text-[#A3B8AF]">{t.home.noReminders}</p>
        ) : (
          <div className="divide-y divide-[#EFECE4] dark:divide-[#18352B]">
            {data.reminders.slice(0, 4).map((rem) => {
              const due = isReminderDueSoon(rem);
              const daysText = (rem.weekdays || [])
                .map((d) => WEEKDAY_LABELS[lang][d] ?? '')
                .filter(Boolean)
                .join(' · ');
              return (
                <div key={rem.id} className="py-3.5 flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#14241E] dark:text-[#F2EFE9]">
                        {reminderTypeLabel(rem.reminder_type)}
                      </span>
                      {due && (
                        <span className="text-xs font-medium text-[#B48A3E] dark:text-[#D4AF6A]">
                          · {t.home.dueNowLabel}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#52635C] dark:text-[#8FA89E] mt-0.5">
                      {daysText || t.common.all} · {rem.timezone}
                    </p>
                  </div>
                  <span className="text-base font-semibold tabular-nums text-[#064E3B] dark:text-[#34D399]">
                    {(rem.reminder_time || '').slice(0, 5)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
