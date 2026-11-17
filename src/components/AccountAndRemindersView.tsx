import React, { useCallback, useEffect, useState } from 'react';
import {
  Bell,
  Bookmark,
  Globe,
  Heart,
  Plus,
  SlidersHorizontal,
  Target,
  Trash2,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { supabase, type DailyGoal, type Reminder } from '../lib/supabase';
import { getTodayDateString, WEEKDAY_LABELS } from '../lib/i18n';

const COMMON_TIMEZONES = [
  'Africa/Mogadishu',
  'Africa/Nairobi',
  'Africa/Addis_Ababa',
  'Africa/Djibouti',
  'Europe/London',
  'Europe/Stockholm',
  'Europe/Oslo',
  'America/Toronto',
  'America/Chicago',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Riyadh',
  'Asia/Dubai',
  'UTC',
];

export function AccountAndRemindersView() {
  const { user, profile, refreshProfile, lang, setLang, theme, toggleTheme, t, showToast } = useApp();

  const [subTab, setSubTab] = useState<'profile' | 'reminders'>('profile');

  const [displayName, setDisplayName] = useState('');
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Mogadishu'
  );
  const [savingProfile, setSavingProfile] = useState(false);

  const [dailyGoal, setDailyGoal] = useState<DailyGoal | null>(null);
  const [goalTarget, setGoalTarget] = useState('100');
  const [savingGoal, setSavingGoal] = useState(false);

  const [stats, setStats] = useState({ bookmarks: 0, favorites: 0, tasbihSessions: 0 });

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [remindersLoading, setRemindersLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [newRemType, setNewRemType] = useState<'morning' | 'evening' | 'quran' | 'custom'>('morning');
  const [newRemTime, setNewRemTime] = useState('06:00');
  const [newRemDays, setNewRemDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [savingRem, setSavingRem] = useState(false);

  const tz = profile?.timezone || timezone || 'UTC';
  const todayStr = getTodayDateString(tz);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? '');
      if (profile.timezone) {
        setTimezone(profile.timezone);
      }
    }
  }, [profile]);

  const loadAccountData = useCallback(async () => {
    if (!user) return;
    setRemindersLoading(true);
    setLoadError(null);
    try {
      const [goalRes, bmRes, favRes, sesRes, remRes] = await Promise.all([
        supabase
          .from('daily_goals')
          .select('*')
          .eq('user_id', user.id)
          .eq('goal_date', todayStr)
          .maybeSingle(),
        supabase.from('quran_bookmarks').select('verse_id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('favorites').select('adhkar_item_id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('tasbih_sessions').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase
          .from('reminders')
          .select('*')
          .eq('user_id', user.id)
          .order('reminder_time', { ascending: true }),
      ]);

      if (goalRes.error) throw goalRes.error;
      if (bmRes.error) throw bmRes.error;
      if (favRes.error) throw favRes.error;
      if (sesRes.error) throw sesRes.error;
      if (remRes.error) throw remRes.error;

      if (goalRes.data) {
        setDailyGoal(goalRes.data);
        setGoalTarget(String(goalRes.data.target_count));
      } else {
        setDailyGoal(null);
      }

      setStats({
        bookmarks: bmRes.count ?? 0,
        favorites: favRes.count ?? 0,
        tasbihSessions: sesRes.count ?? 0,
      });

      setReminders(remRes.data ?? []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setRemindersLoading(false);
    }
  }, [user, todayStr]);

  useEffect(() => {
    loadAccountData();
  }, [loadAccountData]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim() || null,
          locale: lang,
          timezone,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
      showToast(t.account.profileSaved, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error updating preferences', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = Math.max(1, Math.min(10000, parseInt(goalTarget, 10) || 100));
    setSavingGoal(true);
    try {
      const { data, error } = await supabase
        .from('daily_goals')
        .upsert(
          {
            user_id: user.id,
            goal_date: todayStr,
            target_count: parsed,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,goal_date' }
        )
        .select('*')
        .single();
      if (error) throw error;
      setDailyGoal(data);
      showToast(t.account.dailyGoalSaved, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error saving daily goal', 'error');
    } finally {
      setSavingGoal(false);
    }
  };

  const toggleWeekday = (dayIdx: number) => {
    setNewRemDays((prev) =>
      prev.includes(dayIdx) ? prev.filter((d) => d !== dayIdx) : [...prev, dayIdx].sort((a, b) => a - b)
    );
  };

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingRem(true);
    try {
      const normalizedTime = `${newRemTime.slice(0, 5)}:00`;
      const { data, error } = await supabase
        .from('reminders')
        .insert({
          user_id: user.id,
          reminder_type: newRemType,
          reminder_time: normalizedTime,
          timezone,
          weekdays: newRemDays.length > 0 ? newRemDays : [0, 1, 2, 3, 4, 5, 6],
          is_enabled: true,
        })
        .select('*')
        .single();
      if (error) throw error;
      if (data) {
        setReminders((prev) =>
          [...prev, data].sort((a, b) => a.reminder_time.localeCompare(b.reminder_time))
        );
      }
      showToast(t.account.reminderSaved, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error adding reminder', 'error');
    } finally {
      setSavingRem(false);
    }
  };

  const handleToggleReminder = async (rem: Reminder) => {
    if (!user) return;
    const nextVal = !rem.is_enabled;
    setReminders((prev) => prev.map((r) => (r.id === rem.id ? { ...r, is_enabled: nextVal } : r)));
    try {
      const { error } = await supabase
        .from('reminders')
        .update({ is_enabled: nextVal, updated_at: new Date().toISOString() })
        .eq('id', rem.id)
        .eq('user_id', user.id);
      if (error) throw error;
    } catch (err) {
      setReminders((prev) => prev.map((r) => (r.id === rem.id ? { ...r, is_enabled: !nextVal } : r)));
      showToast(err instanceof Error ? err.message : 'Error updating reminder', 'error');
    }
  };

  const handleDeleteReminder = async (id: string) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('reminders').delete().eq('id', id).eq('user_id', user.id);
      if (error) throw error;
      setReminders((prev) => prev.filter((r) => r.id !== id));
      showToast(t.account.reminderDeleted, 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error deleting reminder', 'error');
    }
  };

  const timezoneOptions = Array.from(
    new Set([timezone, Intl.DateTimeFormat().resolvedOptions().timeZone, ...COMMON_TIMEZONES].filter(Boolean))
  );

  const reminderTypeLabel = (type: string) => {
    if (type === 'morning') return t.account.types.morning;
    if (type === 'evening') return t.account.types.evening;
    if (type === 'quran') return t.account.types.quran;
    return t.account.types.custom;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#14241E] dark:text-[#F2EFE9]">
            {t.account.title}
          </h1>
          <p className="mt-1 text-sm text-[#52635C] dark:text-[#A3B8AF]">{t.account.subtitle}</p>
        </div>

        <div className="flex items-center p-1 rounded-xl bg-[#EFECE4] dark:bg-[#0C1F19] border border-[#E5DFD3] dark:border-[#1B3A2F] self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setSubTab('profile')}
            className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              subTab === 'profile'
                ? 'bg-white dark:bg-[#143328] text-[#064E3B] dark:text-[#F2EFE9] shadow-xs'
                : 'text-[#52635C] dark:text-[#8FA89E]'
            }`}
          >
            {t.account.tabProfile}
          </button>
          <button
            type="button"
            onClick={() => setSubTab('reminders')}
            className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              subTab === 'reminders'
                ? 'bg-white dark:bg-[#143328] text-[#064E3B] dark:text-[#F2EFE9] shadow-xs'
                : 'text-[#52635C] dark:text-[#8FA89E]'
            }`}
          >
            {t.account.tabReminders}
          </button>
        </div>
      </div>

      {loadError && (
        <div className="p-4 rounded-xl border border-[#FECACA] dark:border-[#7F1D1D] bg-[#FEF2F2] dark:bg-[#2A1215] flex items-center justify-between gap-4">
          <p className="text-sm text-[#991B1B] dark:text-[#FCA5A5]">{loadError}</p>
          <button
            type="button"
            onClick={loadAccountData}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#991B1B] text-white whitespace-nowrap"
          >
            {t.common.retry}
          </button>
        </div>
      )}

      {/* Personal Activity Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-[#E5DFD3] dark:border-[#1B3A2F] bg-white dark:bg-[#0C1F19] p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs text-[#52635C] dark:text-[#8FA89E]">
            <span>{t.account.statsBookmarks}</span>
            <Bookmark className="w-4 h-4 text-[#B48A3E] dark:text-[#D4AF6A]" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-[#14241E] dark:text-[#F2EFE9]">
            {stats.bookmarks}
          </p>
        </div>
        <div className="rounded-2xl border border-[#E5DFD3] dark:border-[#1B3A2F] bg-white dark:bg-[#0C1F19] p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs text-[#52635C] dark:text-[#8FA89E]">
            <span>{t.account.statsFavorites}</span>
            <Heart className="w-4 h-4 text-[#B48A3E] dark:text-[#D4AF6A]" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-[#14241E] dark:text-[#F2EFE9]">
            {stats.favorites}
          </p>
        </div>
        <div className="rounded-2xl border border-[#E5DFD3] dark:border-[#1B3A2F] bg-white dark:bg-[#0C1F19] p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs text-[#52635C] dark:text-[#8FA89E]">
            <span>{t.account.statsTasbih}</span>
            <Target className="w-4 h-4 text-[#064E3B] dark:text-[#34D399]" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-[#14241E] dark:text-[#F2EFE9]">
            {stats.tasbihSessions}
          </p>
        </div>
      </div>

      {subTab === 'profile' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <form
            onSubmit={handleSaveProfile}
            className="rounded-2xl border border-[#E5DFD3] dark:border-[#1B3A2F] bg-white dark:bg-[#0C1F19] p-6 space-y-5"
          >
            <div className="flex items-center gap-2.5">
              <SlidersHorizontal className="w-5 h-5 text-[#064E3B] dark:text-[#34D399]" />
              <h2 className="font-display text-lg font-semibold text-[#14241E] dark:text-[#F2EFE9]">
                {t.account.profileSectionTitle}
              </h2>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[#52635C] dark:text-[#A3B8AF]">
                {t.account.displayNameLabel}
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t.account.displayNamePlaceholder}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#E5DFD3] dark:border-[#1B3A2F] bg-[#FAF8F3] dark:bg-[#071410]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#52635C] dark:text-[#A3B8AF]">
                  {t.account.languageLabel}
                </label>
                <div className="flex items-center p-1 rounded-xl bg-[#FAF8F3] dark:bg-[#071410] border border-[#E5DFD3] dark:border-[#1B3A2F]">
                  <button
                    type="button"
                    onClick={() => setLang('so')}
                    className={`flex-1 py-2 text-xs font-medium rounded-lg ${
                      lang === 'so'
                        ? 'bg-[#064E3B] text-white dark:bg-[#10B981] dark:text-[#071410]'
                        : 'text-[#52635C] dark:text-[#8FA89E]'
                    }`}
                  >
                    {t.common.somali}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLang('en')}
                    className={`flex-1 py-2 text-xs font-medium rounded-lg ${
                      lang === 'en'
                        ? 'bg-[#064E3B] text-white dark:bg-[#10B981] dark:text-[#071410]'
                        : 'text-[#52635C] dark:text-[#8FA89E]'
                    }`}
                  >
                    {t.common.english}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#52635C] dark:text-[#A3B8AF]">
                  {t.common.lightMode} / {t.common.darkMode}
                </label>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="w-full py-2.5 px-3.5 rounded-xl border border-[#E5DFD3] dark:border-[#1B3A2F] bg-[#FAF8F3] dark:bg-[#071410] text-xs font-medium text-left"
                >
                  {theme === 'light' ? t.common.lightMode : t.common.darkMode}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-[#52635C] dark:text-[#A3B8AF] inline-flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" />
                  <span>{t.account.timezoneLabel}</span>
                </label>
                <button
                  type="button"
                  onClick={() => setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')}
                  className="text-xs font-medium text-[#064E3B] dark:text-[#34D399] hover:underline"
                >
                  {t.account.useDeviceTimezone}
                </button>
              </div>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#E5DFD3] dark:border-[#1B3A2F] bg-[#FAF8F3] dark:bg-[#071410]"
              >
                {timezoneOptions.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="px-5 py-2.5 rounded-xl bg-[#064E3B] text-white dark:bg-[#10B981] dark:text-[#071410] text-xs font-semibold"
            >
              {savingProfile ? t.common.loading : t.common.save}
            </button>
          </form>

          <form
            onSubmit={handleSaveGoal}
            className="rounded-2xl border border-[#E5DFD3] dark:border-[#1B3A2F] bg-white dark:bg-[#0C1F19] p-6 space-y-5"
          >
            <div className="flex items-center gap-2.5">
              <Target className="w-5 h-5 text-[#B48A3E] dark:text-[#D4AF6A]" />
              <h2 className="font-display text-lg font-semibold text-[#14241E] dark:text-[#F2EFE9]">
                {t.account.dailyGoalTitle}
              </h2>
            </div>

            <p className="text-sm text-[#52635C] dark:text-[#A3B8AF]">{t.account.dailyGoalDesc}</p>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[#52635C] dark:text-[#A3B8AF]">
                {t.home.dailyTargetLabel} ({todayStr})
              </label>
              <input
                type="number"
                min={1}
                max={10000}
                required
                value={goalTarget}
                onChange={(e) => setGoalTarget(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm tabular-nums rounded-xl border border-[#E5DFD3] dark:border-[#1B3A2F] bg-[#FAF8F3] dark:bg-[#071410]"
              />
            </div>

            <button
              type="submit"
              disabled={savingGoal}
              className="px-5 py-2.5 rounded-xl bg-[#064E3B] text-white dark:bg-[#10B981] dark:text-[#071410] text-xs font-semibold"
            >
              {savingGoal ? t.common.loading : t.common.save}
            </button>
          </form>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleAddReminder}
            className="lg:col-span-5 rounded-2xl border border-[#E5DFD3] dark:border-[#1B3A2F] bg-white dark:bg-[#0C1F19] p-6 space-y-5"
          >
            <div className="flex items-center gap-2.5">
              <Bell className="w-5 h-5 text-[#B48A3E] dark:text-[#D4AF6A]" />
              <h2 className="font-display text-lg font-semibold text-[#14241E] dark:text-[#F2EFE9]">
                {t.account.addReminder}
              </h2>
            </div>

            <p className="text-xs leading-relaxed text-[#52635C] dark:text-[#A3B8AF]">
              {t.account.remindersHonestNote}
            </p>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[#52635C] dark:text-[#A3B8AF]">
                {t.account.reminderTypeLabel}
              </label>
              <select
                value={newRemType}
                onChange={(e) =>
                  setNewRemType(e.target.value as 'morning' | 'evening' | 'quran' | 'custom')
                }
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#E5DFD3] dark:border-[#1B3A2F] bg-[#FAF8F3] dark:bg-[#071410]"
              >
                <option value="morning">{t.account.types.morning}</option>
                <option value="evening">{t.account.types.evening}</option>
                <option value="quran">{t.account.types.quran}</option>
                <option value="custom">{t.account.types.custom}</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#52635C] dark:text-[#A3B8AF]">
                  {t.account.reminderTimeLabel}
                </label>
                <input
                  type="time"
                  required
                  value={newRemTime}
                  onChange={(e) => setNewRemTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm tabular-nums rounded-xl border border-[#E5DFD3] dark:border-[#1B3A2F] bg-[#FAF8F3] dark:bg-[#071410]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#52635C] dark:text-[#A3B8AF]">
                  {t.account.timezoneLabel}
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-[#E5DFD3] dark:border-[#1B3A2F] bg-[#FAF8F3] dark:bg-[#071410]"
                >
                  {timezoneOptions.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-[#52635C] dark:text-[#A3B8AF]">
                {t.account.weekdaysLabel}
              </label>
              <div className="grid grid-cols-7 gap-1.5">
                {WEEKDAY_LABELS[lang].map((label, idx) => {
                  const selected = newRemDays.includes(idx);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => toggleWeekday(idx)}
                      className={`py-2 rounded-lg text-xs font-semibold border transition-colors ${
                        selected
                          ? 'bg-[#064E3B] text-white border-[#064E3B] dark:bg-[#10B981] dark:text-[#071410] dark:border-[#10B981]'
                          : 'bg-[#FAF8F3] dark:bg-[#071410] text-[#52635C] dark:text-[#8FA89E] border-[#E5DFD3] dark:border-[#1B3A2F]'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={savingRem}
              className="w-full py-2.5 rounded-xl bg-[#064E3B] text-white dark:bg-[#10B981] dark:text-[#071410] text-xs font-semibold inline-flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>{t.account.addReminder}</span>
            </button>
          </form>

          <section className="lg:col-span-7 rounded-2xl border border-[#E5DFD3] dark:border-[#1B3A2F] bg-white dark:bg-[#0C1F19] p-6 space-y-4">
            <h2 className="font-display text-lg font-semibold text-[#14241E] dark:text-[#F2EFE9]">
              {t.account.remindersTitle}
            </h2>

            {remindersLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div key={idx} className="h-16 rounded-xl bg-[#EFECE4] dark:bg-[#112921] animate-pulse" />
                ))}
              </div>
            ) : reminders.length === 0 ? (
              <p className="text-sm text-[#52635C] dark:text-[#A3B8AF]">{t.account.noRemindersYet}</p>
            ) : (
              <div className="divide-y divide-[#EFECE4] dark:divide-[#18352B]">
                {reminders.map((rem) => {
                  const daysStr = (rem.weekdays || [])
                    .map((d) => WEEKDAY_LABELS[lang][d] ?? '')
                    .filter(Boolean)
                    .join(' · ');

                  return (
                    <div key={rem.id} className="py-4 flex items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold tabular-nums text-[#064E3B] dark:text-[#34D399]">
                            {(rem.reminder_time || '').slice(0, 5)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="text-sm font-semibold text-[#14241E] dark:text-[#F2EFE9]">
                            {reminderTypeLabel(rem.reminder_type)}
                          </span>
                        </div>
                        <p className="text-xs text-[#52635C] dark:text-[#8FA89E] mt-0.5">
                          {daysStr || t.common.all} · {rem.timezone}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleReminder(rem)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                            rem.is_enabled
                              ? 'bg-[#ECFDF5] dark:bg-[#112E24] border-[#A7F3D0] dark:border-[#065F46] text-[#065F46] dark:text-[#34D399]'
                              : 'bg-[#FAF8F3] dark:bg-[#071410] border-[#E5DFD3] dark:border-[#1B3A2F] text-[#52635C] dark:text-[#8FA89E]'
                          }`}
                        >
                          {rem.is_enabled ? t.account.enabledLabel : 'Off'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteReminder(rem.id)}
                          aria-label={t.common.delete}
                          className="p-2 rounded-lg text-[#52635C] hover:text-[#991B1B] dark:text-[#8FA89E] dark:hover:text-[#FCA5A5]"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
