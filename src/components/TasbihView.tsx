import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { supabase, type TasbihCounter, type TasbihSession } from '../lib/supabase';
import { getTodayDateString } from '../lib/i18n';
import { enqueueSyncOp, getCachedValue, setCachedValue } from '../lib/offlineStore';

const DEFAULT_PRESETS = [
  { title: 'SubhanAllah', dhikr_text_ar: 'سُبْحَانَ اللَّهِ', target_count: 33, is_default: true },
  { title: 'Alhamdulillah', dhikr_text_ar: 'الْحَمْدُ لِلَّهِ', target_count: 33, is_default: false },
  { title: 'Allahu Akbar', dhikr_text_ar: 'اللَّهُ أَكْبَرُ', target_count: 33, is_default: false },
  { title: 'Astaghfirullah', dhikr_text_ar: 'أَسْتَغْفِرُ اللَّهَ', target_count: 100, is_default: false },
];

export function TasbihView() {
  const { user, profile, t, showToast, isOnline } = useApp();

  const [counters, setCounters] = useState<TasbihCounter[]>([]);
  const [sessions, setSessions] = useState<TasbihSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCounterId, setActiveCounterId] = useState<string>('');

  // Current round count per counter (persisted in localStorage per user so active round survives refresh;
  // cumulative total_count & saved sessions are persisted in Supabase)
  const [roundCounts, setRoundCounts] = useState<Record<string, number>>({});

  const [showNewForm, setShowNewForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newArabic, setNewArabic] = useState('');
  const [newTarget, setNewTarget] = useState('33');
  const [creating, setCreating] = useState(false);
  const [savingSession, setSavingSession] = useState(false);

  const tz = profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const todayStr = getTodayDateString(tz);

  const roundStorageKey = user ? `nuur_tasbih_rounds_${user.id}` : null;

  useEffect(() => {
    if (!roundStorageKey) return;
    try {
      const saved = localStorage.getItem(roundStorageKey);
      if (saved) {
        setRoundCounts(JSON.parse(saved));
      }
    } catch {
      // Ignore storage error
    }
  }, [roundStorageKey]);

  const persistRoundLocally = useCallback(
    (next: Record<string, number>) => {
      if (!roundStorageKey) return;
      try {
        localStorage.setItem(roundStorageKey, JSON.stringify(next));
      } catch {
        // Ignore storage error
      }
    },
    [roundStorageKey]
  );

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const syncTimersRef = useRef<Record<string, number>>({});
  const pendingTotalsRef = useRef<Record<string, number>>({});
  const totalCountsRef = useRef<Record<string, number>>({});

  const flushCounterTotal = useCallback(
    async (counterId: string, nextTotal: number) => {
      if (!user) return;
      delete pendingTotalsRef.current[counterId];
      const nowIso = new Date().toISOString();
      const queueOffline = async () => {
        await enqueueSyncOp(
          user.id,
          'tasbih_total',
          `tasbih_total:${user.id}:${counterId}`,
          {
            counter_id: counterId,
            total_count: nextTotal,
            updated_at: nowIso,
          }
        );
      };

      if (!isOnline) {
        await queueOffline();
        return;
      }

      try {
        const { error: updErr } = await supabase
          .from('tasbih_counters')
          .update({
            total_count: nextTotal,
            updated_at: nowIso,
          })
          .eq('id', counterId)
          .eq('user_id', user.id);
        if (updErr) throw updErr;
      } catch (err) {
        if (!isOnline || (err instanceof TypeError && err.message.toLowerCase().includes('fetch'))) {
          await queueOffline();
        } else if (isMountedRef.current) {
          showToast(err instanceof Error ? err.message : 'Sync failed', 'error');
        }
      }
    },
    [user, isOnline, showToast]
  );

  useEffect(() => {
    return () => {
      Object.entries(syncTimersRef.current).forEach(([counterId, timerId]) => {
        window.clearTimeout(timerId);
        delete syncTimersRef.current[counterId];
      });
      Object.entries(pendingTotalsRef.current).forEach(([counterId, total]) => {
        void flushCounterTotal(counterId, total);
      });
    };
  }, [flushCounterTotal]);

  const fetchTasbihData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const cntCacheKey = `tasbih:counters:${user.id}`;
    const sesCacheKey = `tasbih:sessions:${user.id}`;
    try {
      const [cntRes, sesRes] = await Promise.all([
        supabase
          .from('tasbih_counters')
          .select('id, user_id, title, dhikr_text_ar, target_count, total_count, is_default, created_at, updated_at')
          .eq('user_id', user.id)
          .order('is_default', { ascending: false })
          .order('created_at', { ascending: true }),
        supabase
          .from('tasbih_sessions')
          .select('id, user_id, counter_id, dhikr_label, count, session_date, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      if (cntRes.error) throw cntRes.error;
      if (sesRes.error) throw sesRes.error;

      if (!isMountedRef.current) return;
      const loadedCounters = cntRes.data ?? [];
      const loadedSessions = sesRes.data ?? [];
      const totalsMap: Record<string, number> = {};
      loadedCounters.forEach((c) => {
        totalsMap[c.id] = c.total_count;
      });
      totalCountsRef.current = totalsMap;

      setCounters(loadedCounters);
      if (loadedCounters.length > 0) {
        setActiveCounterId((prev) =>
          loadedCounters.some((c) => c.id === prev) ? prev : loadedCounters[0].id
        );
      }
      setSessions(loadedSessions);
      await Promise.all([
        setCachedValue(cntCacheKey, loadedCounters),
        setCachedValue(sesCacheKey, loadedSessions),
      ]);
    } catch (err) {
      const [cachedCnt, cachedSes] = await Promise.all([
        getCachedValue<TasbihCounter[]>(cntCacheKey),
        getCachedValue<TasbihSession[]>(sesCacheKey),
      ]);
      if (!isMountedRef.current) return;
      if (cachedCnt) {
        const totalsMap: Record<string, number> = {};
        cachedCnt.forEach((c) => {
          totalsMap[c.id] = c.total_count;
        });
        totalCountsRef.current = totalsMap;
        setCounters(cachedCnt);
        if (cachedCnt.length > 0) {
          setActiveCounterId((prev) =>
            cachedCnt.some((c) => c.id === prev) ? prev : cachedCnt[0].id
          );
        }
        setSessions(cachedSes ?? []);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load Tasbih data');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [user]);

  useEffect(() => {
    fetchTasbihData();
  }, [fetchTasbihData]);

  const activeCounter = useMemo(
    () => counters.find((c) => c.id === activeCounterId) ?? null,
    [counters, activeCounterId]
  );

  const currentCount = activeCounter ? roundCounts[activeCounter.id] ?? 0 : 0;
  const currentTarget = Math.max(1, activeCounter?.target_count ?? 33);
  const currentTotal = activeCounter?.total_count ?? 0;

  const progressFraction = Math.min(1, currentCount / currentTarget);
  const ringRadius = 96;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const strokeDashoffset = ringCircumference * (1 - progressFraction);
  const targetReached = activeCounter ? currentCount >= currentTarget : false;

  const queueTotalUpdate = (counterId: string, nextTotal: number) => {
    if (!user) return;
    pendingTotalsRef.current[counterId] = nextTotal;
    if (syncTimersRef.current[counterId]) {
      window.clearTimeout(syncTimersRef.current[counterId]);
    }
    syncTimersRef.current[counterId] = window.setTimeout(() => {
      delete syncTimersRef.current[counterId];
      void flushCounterTotal(counterId, nextTotal);
    }, 350);
  };

  const handleIncrement = () => {
    if (!user || !activeCounter) return;
    const nextTotal = (totalCountsRef.current[activeCounter.id] ?? activeCounter.total_count) + 1;
    totalCountsRef.current[activeCounter.id] = nextTotal;

    setRoundCounts((prev) => {
      const next = { ...prev, [activeCounter.id]: (prev[activeCounter.id] ?? 0) + 1 };
      persistRoundLocally(next);
      return next;
    });
    setCounters((prev) => {
      const updated = prev.map((c) =>
        c.id === activeCounter.id ? { ...c, total_count: nextTotal } : c
      );
      void setCachedValue(`tasbih:counters:${user.id}`, updated);
      return updated;
    });
    queueTotalUpdate(activeCounter.id, nextTotal);
  };

  const handleResetRound = () => {
    if (!activeCounter) return;
    setRoundCounts((prev) => {
      const next = { ...prev, [activeCounter.id]: 0 };
      persistRoundLocally(next);
      return next;
    });
  };

  const handleSaveSession = async () => {
    if (!user || !activeCounter || currentCount <= 0) return;

    setSavingSession(true);
    const sessionCount = currentCount;
    const latestTotal = totalCountsRef.current[activeCounter.id] ?? activeCounter.total_count;
    if (syncTimersRef.current[activeCounter.id]) {
      window.clearTimeout(syncTimersRef.current[activeCounter.id]);
      delete syncTimersRef.current[activeCounter.id];
    }
    delete pendingTotalsRef.current[activeCounter.id];

    const clientSessionId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const nowIso = new Date().toISOString();

    const queueSessionOffline = async () => {
      const offlineSession: TasbihSession = {
        id: clientSessionId,
        user_id: user.id,
        counter_id: activeCounter.id,
        dhikr_label: activeCounter.title,
        count: sessionCount,
        session_date: todayStr,
        created_at: nowIso,
      };
      await Promise.all([
        enqueueSyncOp(
          user.id,
          'tasbih_total',
          `tasbih_total:${user.id}:${activeCounter.id}`,
          {
            counter_id: activeCounter.id,
            total_count: latestTotal,
            updated_at: nowIso,
          }
        ),
        enqueueSyncOp(user.id, 'tasbih_session', `tasbih_session:${clientSessionId}`, {
          id: clientSessionId,
          counter_id: activeCounter.id,
          dhikr_label: activeCounter.title,
          count: sessionCount,
          session_date: todayStr,
        }),
      ]);

      setRoundCounts((prev) => {
        const next = { ...prev, [activeCounter.id]: 0 };
        persistRoundLocally(next);
        return next;
      });
      setSessions((prev) => {
        const updated = [offlineSession, ...prev].slice(0, 20);
        void setCachedValue(`tasbih:sessions:${user.id}`, updated);
        return updated;
      });
      showToast(t.tasbih.sessionSaved, 'info');
    };

    try {
      if (!isOnline) {
        await queueSessionOffline();
        return;
      }

      const [sesRes, cntRes] = await Promise.all([
        supabase
          .from('tasbih_sessions')
          .insert({
            id: clientSessionId,
            user_id: user.id,
            counter_id: activeCounter.id,
            dhikr_label: activeCounter.title,
            count: sessionCount,
            session_date: todayStr,
          })
          .select('id, user_id, counter_id, dhikr_label, count, session_date, created_at')
          .single(),
        supabase
          .from('tasbih_counters')
          .update({
            total_count: latestTotal,
            updated_at: nowIso,
          })
          .eq('id', activeCounter.id)
          .eq('user_id', user.id),
      ]);

      if (sesRes.error) throw sesRes.error;
      if (cntRes.error) throw cntRes.error;

      setRoundCounts((prev) => {
        const next = { ...prev, [activeCounter.id]: 0 };
        persistRoundLocally(next);
        return next;
      });
      if (sesRes.data) {
        setSessions((prev) => {
          const updated = [sesRes.data, ...prev].slice(0, 20);
          void setCachedValue(`tasbih:sessions:${user.id}`, updated);
          return updated;
        });
      }
      showToast(t.tasbih.sessionSaved, 'success');
    } catch (err) {
      if (!isOnline || (err instanceof TypeError && err.message.toLowerCase().includes('fetch'))) {
        await queueSessionOffline();
      } else {
        showToast(err instanceof Error ? err.message : 'Error saving session', 'error');
      }
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
        dhikr_text_ar: p.dhikr_text_ar,
        target_count: p.target_count,
        total_count: 0,
        is_default: p.is_default,
      }));
      const { data, error: insErr } = await supabase
        .from('tasbih_counters')
        .insert(payload)
        .select('id, user_id, title, dhikr_text_ar, target_count, total_count, is_default, created_at, updated_at');
      if (insErr) throw insErr;
      if (data && data.length > 0) {
        data.forEach((c) => {
          totalCountsRef.current[c.id] = c.total_count;
        });
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
    if (!user) return;
    const title = newTitle.trim();
    const target = Math.max(1, Math.min(100000, parseInt(newTarget, 10) || 33));
    if (!title) return;

    setCreating(true);
    try {
      const { data, error: insErr } = await supabase
        .from('tasbih_counters')
        .insert({
          user_id: user.id,
          title,
          dhikr_text_ar: newArabic.trim() || null,
          target_count: target,
          total_count: 0,
          is_default: counters.length === 0,
        })
        .select('id, user_id, title, dhikr_text_ar, target_count, total_count, is_default, created_at, updated_at')
        .single();
      if (insErr) throw insErr;
      if (data) {
        totalCountsRef.current[data.id] = data.total_count;
        setCounters((prev) => [...prev, data]);
        setActiveCounterId(data.id);
      }
      setNewTitle('');
      setNewArabic('');
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
    if (syncTimersRef.current[counterId]) {
      window.clearTimeout(syncTimersRef.current[counterId]);
      delete syncTimersRef.current[counterId];
    }
    delete pendingTotalsRef.current[counterId];
    delete totalCountsRef.current[counterId];
    try {
      const { error: delErr } = await supabase
        .from('tasbih_counters')
        .delete()
        .eq('id', counterId)
        .eq('user_id', user.id);
      if (delErr) throw delErr;
      const remaining = counters.filter((c) => c.id !== counterId);
      setCounters(remaining);
      if (activeCounterId === counterId) {
        setActiveCounterId(remaining[0]?.id ?? '');
      }
      setRoundCounts((prev) => {
        const next = { ...prev };
        delete next[counterId];
        persistRoundLocally(next);
        return next;
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error deleting counter', 'error');
    }
  };

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

      {showNewForm && (
        <form
          onSubmit={handleCreateCounter}
          className="rounded-2xl border border-[#E5DFD3] dark:border-[#1B3A2F] bg-white dark:bg-[#0C1F19] p-5 grid grid-cols-1 sm:grid-cols-12 items-end gap-4"
        >
          <div className="sm:col-span-4 space-y-1.5">
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
          <div className="sm:col-span-4 space-y-1.5">
            <label className="block text-xs font-medium text-[#52635C] dark:text-[#A3B8AF]">
              {t.tasbih.arabicOptionalLabel}
            </label>
            <input
              type="text"
              dir="rtl"
              value={newArabic}
              onChange={(e) => setNewArabic(e.target.value)}
              placeholder={t.tasbih.arabicPlaceholder}
              className="w-full px-3.5 py-2 text-sm font-arabic rounded-xl border border-[#E5DFD3] dark:border-[#1B3A2F] bg-[#FAF8F3] dark:bg-[#071410]"
            />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
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
          <div className="sm:col-span-2 flex items-center gap-2">
            <button
              type="submit"
              disabled={creating}
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#064E3B] text-white dark:bg-[#10B981] dark:text-[#071410] text-xs font-semibold whitespace-nowrap"
            >
              {t.tasbih.createCounter}
            </button>
            <button
              type="button"
              onClick={() => setShowNewForm(false)}
              className="px-2.5 py-2.5 text-xs font-medium text-[#52635C] dark:text-[#8FA89E]"
            >
              {t.common.cancel}
            </button>
          </div>
        </form>
      )}

      {error && (
        <div className="p-4 rounded-xl border border-[#FECACA] dark:border-[#7F1D1D] bg-[#FEF2F2] dark:bg-[#2A1215] flex items-center justify-between gap-4">
          <p className="text-sm text-[#991B1B] dark:text-[#FCA5A5]">{error}</p>
          <button
            type="button"
            onClick={fetchTasbihData}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#991B1B] text-white whitespace-nowrap"
          >
            {t.common.retry}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-7 rounded-2xl border border-[#E5DFD3] dark:border-[#1B3A2F] bg-white dark:bg-[#0C1F19] p-6 sm:p-8 flex flex-col items-center gap-6">
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
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setActiveCounterId(c.id)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-[#064E3B] text-white border-[#064E3B] dark:bg-[#10B981] dark:text-[#071410] dark:border-[#10B981]'
                          : 'bg-[#FAF8F3] dark:bg-[#071410] text-[#52635C] dark:text-[#A3B8AF] border-[#E5DFD3] dark:border-[#1B3A2F]'
                      }`}
                    >
                      {c.title} · <span className="tabular-nums">{c.target_count}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="text-center space-y-1.5">
            {activeCounter?.dhikr_text_ar && (
              <p
                dir="rtl"
                lang="ar"
                className="font-arabic text-3xl sm:text-4xl text-[#064E3B] dark:text-[#D4AF6A]"
              >
                {activeCounter.dhikr_text_ar}
              </p>
            )}
            <h2 className="font-display text-xl sm:text-2xl font-semibold text-[#14241E] dark:text-[#F2EFE9]">
              {activeCounter?.title || 'Tasbih'}
            </h2>
            <p className="text-xs text-[#52635C] dark:text-[#8FA89E] tabular-nums">
              {t.tasbih.targetLabel}: {currentTarget} · {t.tasbih.totalCount}: {currentTotal}
            </p>
          </div>

          <button
            type="button"
            disabled={!activeCounter}
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

          <div className="w-full max-w-sm flex items-center gap-3">
            <button
              type="button"
              onClick={handleResetRound}
              disabled={!activeCounter || currentCount === 0}
              className="min-h-[44px] px-4 py-2.5 rounded-xl border border-[#E5DFD3] dark:border-[#1B3A2F] text-xs font-semibold text-[#52635C] dark:text-[#A3B8AF] disabled:opacity-40 inline-flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{t.tasbih.resetRound}</span>
            </button>

            <button
              type="button"
              onClick={handleSaveSession}
              disabled={!activeCounter || savingSession || currentCount === 0}
              className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#064E3B] text-white dark:bg-[#10B981] dark:text-[#071410] text-xs font-semibold disabled:opacity-40 inline-flex items-center justify-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>{t.tasbih.saveSession}</span>
            </button>

            {activeCounter && (
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

        <section className="lg:col-span-5 rounded-2xl border border-[#E5DFD3] dark:border-[#1B3A2F] bg-white dark:bg-[#0C1F19] p-6 space-y-4">
          <h2 className="font-display text-lg font-semibold text-[#14241E] dark:text-[#F2EFE9]">
            {t.tasbih.historyTitle}
          </h2>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="h-12 rounded-xl bg-[#EFECE4] dark:bg-[#112921] animate-pulse" />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-[#52635C] dark:text-[#A3B8AF]">{t.tasbih.noHistory}</p>
          ) : (
            <div className="divide-y divide-[#EFECE4] dark:divide-[#18352B] max-h-[420px] overflow-y-auto">
              {sessions.map((ses) => (
                <div key={ses.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#14241E] dark:text-[#F2EFE9] truncate">
                      {ses.dhikr_label}
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
