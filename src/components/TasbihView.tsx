import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { supabase, type TasbihCounter, type TasbihSession } from '../lib/supabase';
import { getTodayDateString } from '../lib/i18n';

const DEFAULT_PRESETS = [
  { title: 'SubhanAllah (سُبْحَانَ اللَّهِ)', target_count: 33, is_default: true },
  { title: 'Alhamdulillah (الْحَمْدُ لِلَّهِ)', target_count: 33, is_default: false },
  { title: 'Allahu Akbar (اللَّهُ أَكْبَرُ)', target_count: 33, is_default: false },
  { title: 'Astaghfirullah (أَسْتَغْفِرُ اللَّهَ)', target_count: 100, is_default: false },
];

export function TasbihView() {
  const { user, profile, t, setActiveTab, showToast } = useApp();

  const [counters, setCounters] = useState<TasbihCounter[]>([]);
  const [sessions, setSessions] = useState<TasbihSession[]>([]);
  const [loading, setLoading] = useState(false);

  const [activeCounterId, setActiveCounterId] = useState<string>('guest-default');
  const [guestCount, setGuestCount] = useState(0);
  const [guestTotal, setGuestTotal] = useState(0);
  const [guestTarget, setGuestTarget] = useState(33);
  const [guestTitle, setGuestTitle] = useState('SubhanAllah (سُبْحَانَ اللَّهِ)');

  const [showNewForm, setShowNewForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTarget, setNewTarget] = useState('33');
  const [creating, setCreating] = useState(false);
  const [savingSession, setSavingSession] = useState(false);

  const tz = profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const todayStr = getTodayDateString(tz);

  const syncTimerRef = useRef<number | null>(null);

  const fetchTasbihData = useCallback(async () => {
    if (!user) {
      setCounters([]);
      setSessions([]);
      return;
    }
    setLoading(true);
    try {
      const [cntRes, sesRes] = await Promise.all([
        supabase
          .from('tasbih_counters')
          .select('*')
          .eq('user_id', user.id)
          .order('is_default', { ascending: false })
          .order('created_at', { ascending: true }),
        supabase
          .from('tasbih_sessions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      if (!cntRes.error && cntRes.data) {
        setCounters(cntRes.data);
        if (cntRes.data.length > 0) {
          setActiveCounterId((prev) =>
            cntRes.data!.some((c) => c.id === prev) ? prev : cntRes.data![0].id
          );
        }
      }
      if (!sesRes.error && sesRes.data) {
        setSessions(sesRes.data);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTasbihData();
  }, [fetchTasbihData]);

  const activeCounter = useMemo(
    () => counters.find((c) => c.id === activeCounterId) ?? null,
    [counters, activeCounterId]
  );

  const currentCount = user ? activeCounter?.count ?? 0 : guestCount;
  const currentTarget = user ? Math.max(1, activeCounter?.target_count ?? 33) : Math.max(1, guestTarget);
  const currentTotal = user ? activeCounter?.total_count ?? 0 : guestTotal;
  const currentTitle = user ? activeCounter?.title ?? '' : guestTitle;

  const progressFraction = Math.min(1, currentCount / currentTarget);
  const ringRadius = 96;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const strokeDashoffset = ringCircumference * (1 - progressFraction);
  const targetReached = currentCount >= currentTarget;

  const queueCounterUpdate = (counterId: string, count: number, totalCount: number) => {
    if (!user) return;
    if (syncTimerRef.current) {
      window.clearTimeout(syncTimerRef.current);
    }
    syncTimerRef.current = window.setTimeout(async () => {
      await supabase
        .from('tasbih_counters')
        .update({
          count,
          total_count: totalCount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', counterId)
        .eq('user_id', user.id);
    }, 350);
  };

  const handleIncrement = () => {
    if (!user) {
      setGuestCount((c) => c + 1);
      setGuestTotal((tot) => tot + 1);
      return;
    }
    if (!activeCounter) return;
    const nextCount = activeCounter.count + 1;
    const nextTotal = activeCounter.total_count + 1;
    setCounters((prev) =>
      prev.map((c) =>
        c.id === activeCounter.id ? { ...c, count: nextCount, total_count: nextTotal } : c
      )
    );
    queueCounterUpdate(activeCounter.id, nextCount, nextTotal);
  };

  const handleResetRound = async () => {
    if (!user) {
      setGuestCount(0);
      return;
    }
    if (!activeCounter) return;
    setCounters((prev) =>
      prev.map((c) => (c.id === activeCounter.id ? { ...c, count: 0 } : c))
    );
    await supabase
      .from('tasbih_counters')
      .update({ count: 0, updated_at: new Date().toISOString() })
      .eq('id', activeCounter.id)
      .eq('user_id', user.id);
  };

  const handleSaveSession = async () => {
    if (!user) {
      showToast(t.common.signInRequiredTitle, 'info');
      setActiveTab('account');
      return;
    }
    if (!activeCounter || activeCounter.count <= 0) return;

    setSavingSession(true);
    const sessionCount = activeCounter.count;
    try {
      const { data: inserted, error } = await supabase
        .from('tasbih_sessions')
        .insert({
          user_id: user.id,
          counter_id: activeCounter.id,
          count: sessionCount,
          session_date: todayStr,
        })
        .select('*')
        .single();
      if (error) throw error;

      // Reset current round after logging session
      await supabase
        .from('tasbih_counters')
        .update({ count: 0, updated_at: new Date().toISOString() })
        .eq('id', activeCounter.id)
        .eq('user_id', user.id);

      setCounters((prev) =>
        prev.map((c) => (c.id === activeCounter.id ? { ...c, count: 0 } : c))
      );
      if (inserted) {
        setSessions((prev) => [inserted, ...prev].slice(0, 20));
      }
      showToast(t.tasbih.sessionSaved, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error saving session', 'error');
    } finally {
      setSavingSession(false);
    }
  };

  const handleLoadPresets = async () => {
    if (!user) return;
    setCreating(true);
    try {
      const payload = DEFAULT_PRESETS.map((p) => ({
        user_id: user.id,
        title: p.title,
        count: 0,
        target_count: p.target_count,
        total_count: 0,
        is_default: p.is_default,
      }));
      const { data, error } = await supabase.from('tasbih_counters').insert(payload).select('*');
      if (error) throw error;
      if (data && data.length > 0) {
        setCounters(data);
        setActiveCounterId(data[0].id);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error creating presets', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleCreateCounter = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    const target = Math.max(1, Math.min(100000, parseInt(newTarget, 10) || 33));
    if (!title) return;

    if (!user) {
      setGuestTitle(title);
      setGuestTarget(target);
      setGuestCount(0);
      setShowNewForm(false);
      setNewTitle('');
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('tasbih_counters')
        .insert({
          user_id: user.id,
          title,
          count: 0,
          target_count: target,
          total_count: 0,
          is_default: counters.length === 0,
        })
        .select('*')
        .single();
      if (error) throw error;
      if (data) {
        setCounters((prev) => [...prev, data]);
        setActiveCounterId(data.id);
      }
      setNewTitle('');
      setNewTarget('33');
      setShowNewForm(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error creating counter', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteCounter = async (counterId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('tasbih_counters')
        .delete()
        .eq('id', counterId)
        .eq('user_id', user.id);
      if (error) throw error;
      const remaining = counters.filter((c) => c.id !== counterId);
      setCounters(remaining);
      if (activeCounterId === counterId) {
        setActiveCounterId(remaining[0]?.id ?? '');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error deleting counter', 'error');
    }
  };

  const counterTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    counters.forEach((c) => map.set(c.id, c.title));
    return map;
  }, [counters]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#14241E] dark:text-[#F2EFE9]">
            {t.tasbih.title}
          </h1>
          <p className="mt-1 text-sm text-[#52635C] dark:text-[#A3B8AF]">{t.tasbih.subtitle}</p>
        </div>

        <button
          type="button"
          onClick={() => setShowNewForm((v) => !v)}
          className="self-start sm:self-auto px-4 py-2 rounded-xl bg-[#064E3B] text-white dark:bg-[#10B981] dark:text-[#071410] text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>{t.tasbih.newCounter}</span>
        </button>
      </div>

      {!user && (
        <div className="rounded-xl border border-[#D8CEB8] dark:border-[#244A3C] bg-[#F5F1E6] dark:bg-[#0C1F19] px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs sm:text-sm text-[#52635C] dark:text-[#A3B8AF]">{t.tasbih.guestNotice}</p>
          <button
            type="button"
            onClick={() => setActiveTab('account')}
            className="text-xs font-semibold text-[#064E3B] dark:text-[#34D399] hover:underline whitespace-nowrap"
          >
            {t.common.signIn}
          </button>
        </div>
      )}

      {/* New Counter Form */}
      {showNewForm && (
        <form
          onSubmit={handleCreateCounter}
          className="rounded-2xl border border-[#E5DFD3] dark:border-[#1B3A2F] bg-white dark:bg-[#0C1F19] p-5 flex flex-col sm:flex-row items-stretch sm:items-end gap-4"
        >
          <div className="flex-1 space-y-1.5">
            <label className="block text-xs font-medium text-[#52635C] dark:text-[#A3B8AF]">
              {t.tasbih.newCounter}
            </label>
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={t.tasbih.counterTitlePlaceholder}
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-[#E5DFD3] dark:border-[#1B3A2F] bg-[#FAF8F3] dark:bg-[#071410]"
            />
          </div>
          <div className="w-full sm:w-36 space-y-1.5">
            <label className="block text-xs font-medium text-[#52635C] dark:text-[#A3B8AF]">
              {t.tasbih.targetLabel}
            </label>
            <input
              type="number"
              min={1}
              max={100000}
              required
              value={newTarget}
              onChange={(e) => setNewTarget(e.target.value)}
              className="w-full px-3.5 py-2 text-sm tabular-nums rounded-xl border border-[#E5DFD3] dark:border-[#1B3A2F] bg-[#FAF8F3] dark:bg-[#071410]"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2.5 rounded-xl bg-[#064E3B] text-white dark:bg-[#10B981] dark:text-[#071410] text-xs font-semibold whitespace-nowrap"
            >
              {t.tasbih.createCounter}
            </button>
            <button
              type="button"
              onClick={() => setShowNewForm(false)}
              className="px-3 py-2.5 text-xs font-medium text-[#52635C] dark:text-[#8FA89E]"
            >
              {t.common.cancel}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left/Main Counter Dial */}
        <section className="lg:col-span-7 rounded-2xl border border-[#E5DFD3] dark:border-[#1B3A2F] bg-white dark:bg-[#0C1F19] p-6 sm:p-8 flex flex-col items-center gap-6">
          {/* Counter Selector Chips (Signed in) */}
          {user && (
            <div className="w-full">
              {loading ? (
                <div className="h-10 rounded-xl bg-[#EFECE4] dark:bg-[#112921] animate-pulse" />
              ) : counters.length === 0 ? (
                <div className="text-center py-4 space-y-3 border-b border-[#EFECE4] dark:border-[#18352B]">
                  <p className="text-sm text-[#52635C] dark:text-[#A3B8AF]">{t.tasbih.noCounters}</p>
                  <button
                    type="button"
                    disabled={creating}
                    onClick={handleLoadPresets}
                    className="px-4 py-2 rounded-xl bg-[#064E3B] text-white dark:bg-[#10B981] dark:text-[#071410] text-xs font-semibold"
                  >
                    {t.tasbih.loadPresets}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                  {counters.map((c) => {
                    const active = c.id === activeCounter?.id;
                    return (
                      <div key={c.id} className="inline-flex items-center shrink-0">
                        <button
                          type="button"
                          onClick={() => setActiveCounterId(c.id)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition-colors whitespace-nowrap ${
                            active
                              ? 'bg-[#064E3B] text-white border-[#064E3B] dark:bg-[#10B981] dark:text-[#071410] dark:border-[#10B981]'
                              : 'bg-[#FAF8F3] dark:bg-[#071410] text-[#52635C] dark:text-[#A3B8AF] border-[#E5DFD3] dark:border-[#1B3A2F]'
                          }`}
                        >
                          {c.title} · <span className="tabular-nums">{c.target_count}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Active Dhikr Label */}
          <div className="text-center space-y-1">
            <h2 className="font-display text-xl sm:text-2xl font-semibold text-[#14241E] dark:text-[#F2EFE9]">
              {currentTitle || 'SubhanAllah'}
            </h2>
            <p className="text-xs text-[#52635C] dark:text-[#8FA89E] tabular-nums">
              {t.tasbih.targetLabel}: {currentTarget} · {t.tasbih.totalCount}: {currentTotal}
            </p>
          </div>

          {/* Interactive Circular Tasbih Tap Dial */}
          <button
            type="button"
            disabled={user ? !activeCounter : false}
            onClick={handleIncrement}
            className="relative w-56 h-56 rounded-full flex items-center justify-center focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#B48A3E]/40 transition-transform active:scale-[0.97] disabled:opacity-50 select-none"
            aria-label={t.tasbih.tapToIncrement}
          >
            <svg className="w-full h-full -rotate-90" viewBox="0 0 220 220">
              <circle
                cx="110"
                cy="110"
                r={ringRadius}
                fill="none"
                stroke="currentColor"
                strokeWidth="10"
                className="text-[#EFECE4] dark:text-[#143328]"
              />
              <circle
                cx="110"
                cy="110"
                r={ringRadius}
                fill="none"
                stroke="currentColor"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={ringCircumference}
                strokeDashoffset={strokeDashoffset}
                className={`transition-all duration-150 ${
                  targetReached ? 'text-[#B48A3E] dark:text-[#D4AF6A]' : 'text-[#064E3B] dark:text-[#10B981]'
                }`}
              />
            </svg>

            <div className="absolute inset-4 rounded-full bg-[#FAF8F3] dark:bg-[#091A14] border border-[#E5DFD3] dark:border-[#1B3A2F] flex flex-col items-center justify-center gap-1 shadow-inner">
              <span className="text-5xl font-bold tabular-nums text-[#064E3B] dark:text-[#34D399]">
                {currentCount}
              </span>
              <span className="text-xs font-medium text-[#52635C] dark:text-[#8FA89E] tabular-nums">
                / {currentTarget}
              </span>
              <span className="mt-1 text-[11px] font-medium text-[#B48A3E] dark:text-[#D4AF6A] inline-flex items-center gap-1">
                {targetReached ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>{t.tasbih.targetReached}</span>
                  </>
                ) : (
                  <span>{t.tasbih.tapToIncrement}</span>
                )}
              </span>
            </div>
          </button>

          {/* Controls */}
          <div className="w-full max-w-sm flex items-center gap-3">
            <button
              type="button"
              onClick={handleResetRound}
              disabled={currentCount === 0}
              className="min-h-[44px] px-4 py-2.5 rounded-xl border border-[#E5DFD3] dark:border-[#1B3A2F] text-xs font-semibold text-[#52635C] dark:text-[#A3B8AF] disabled:opacity-40 inline-flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{t.tasbih.resetRound}</span>
            </button>

            <button
              type="button"
              onClick={handleSaveSession}
              disabled={savingSession || currentCount === 0}
              className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#064E3B] text-white dark:bg-[#10B981] dark:text-[#071410] text-xs font-semibold disabled:opacity-40 inline-flex items-center justify-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>{t.tasbih.saveSession}</span>
            </button>

            {user && activeCounter && (
              <button
                type="button"
                onClick={() => handleDeleteCounter(activeCounter.id)}
                aria-label={t.tasbih.deleteCounter}
                title={t.tasbih.deleteCounter}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-[#E5DFD3] dark:border-[#1B3A2F] text-[#52635C] hover:text-[#991B1B] dark:text-[#8FA89E] dark:hover:text-[#FCA5A5]"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </section>

        {/* Right Panel: Session History */}
        <section className="lg:col-span-5 rounded-2xl border border-[#E5DFD3] dark:border-[#1B3A2F] bg-white dark:bg-[#0C1F19] p-6 space-y-4">
          <h2 className="font-display text-lg font-semibold text-[#14241E] dark:text-[#F2EFE9]">
            {t.tasbih.historyTitle}
          </h2>

          {!user ? (
            <p className="text-sm text-[#52635C] dark:text-[#A3B8AF]">{t.common.signInRequiredDesc}</p>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-[#52635C] dark:text-[#A3B8AF]">{t.tasbih.noHistory}</p>
          ) : (
            <div className="divide-y divide-[#EFECE4] dark:divide-[#18352B] max-h-[420px] overflow-y-auto">
              {sessions.map((ses) => (
                <div key={ses.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#14241E] dark:text-[#F2EFE9] truncate">
                      {counterTitleMap.get(ses.counter_id) ?? 'Tasbih'}
                    </p>
                    <p className="text-xs text-[#52635C] dark:text-[#8FA89E] tabular-nums">
                      {ses.session_date}
                    </p>
                  </div>
                  <span className="text-base font-bold tabular-nums text-[#064E3B] dark:text-[#34D399]">
                    +{ses.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
