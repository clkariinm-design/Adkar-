import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  History,
  Layers,
  Pause,
  Play,
  Plus,
  Trophy,
  WifiOff,
  X,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import {
  supabase,
  type KhatmahDailyScheduleRow,
  type KhatmahDurationDays,
  type KhatmahPlan,
  type KhatmahReadingLog,
  type QuranSurah,
} from '../lib/supabase';
import {
  buildOfflineKhatmahSchedule,
  calculateTargetEndDate,
  computeKhatmahProgress,
  formatShortDate,
  formatVerseRefLabel,
  getDefaultPlanName,
  getMogadishuDateString,
  getSupabaseErrorCode,
  isNetworkLikeError,
  makeRangeKey,
  resolveVerseRefFromSurahs,
} from '../lib/khatmah';
import {
  enqueueSyncOp,
  getCachedValue,
  getQueuedOps,
  setCachedValue,
  subscribeSyncQueue,
} from '../lib/offlineStore';

type KhatmahSubTab = 'overview' | 'plans' | 'history';
type ScheduleFilter = 'all' | 'remaining' | 'completed';

interface KhatmahViewProps {
  surahs: QuranSurah[];
}

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function KhatmahView({ surahs }: KhatmahViewProps) {
  const { user, lang, t, isOnline, openQuranAt, showToast, registerBackHandler } = useApp();

  const [subTab, setSubTab] = useState<KhatmahSubTab>('overview');
  const [scheduleFilter, setScheduleFilter] = useState<ScheduleFilter>('all');

  const [plans, setPlans] = useState<KhatmahPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<KhatmahDailyScheduleRow[]>([]);
  const [allLogs, setAllLogs] = useState<KhatmahReadingLog[]>([]);
  const [queuedLogIds, setQueuedLogIds] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(true);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create plan modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [durationDays, setDurationDays] = useState<KhatmahDurationDays>(30);
  const [planNameInput, setPlanNameInput] = useState('');
  const [creatingPlan, setCreatingPlan] = useState(false);

  // Action confirmations & busy flags
  const [confirmCompleteDay, setConfirmCompleteDay] = useState<KhatmahDailyScheduleRow | null>(null);
  const [loggingDay, setLoggingDay] = useState(false);
  const [confirmPausePlan, setConfirmPausePlan] = useState<KhatmahPlan | null>(null);
  const [updatingStatusPlanId, setUpdatingStatusPlanId] = useState<string | null>(null);
  const [openingReaderDay, setOpeningReaderDay] = useState<number | null>(null);

  const todayMogadishu = getMogadishuDateString();

  // Hardware back button support for modals/sub-tabs
  useEffect(() => {
    return registerBackHandler(() => {
      if (confirmCompleteDay) {
        setConfirmCompleteDay(null);
        return true;
      }
      if (confirmPausePlan) {
        setConfirmPausePlan(null);
        return true;
      }
      if (createOpen) {
        setCreateOpen(false);
        return true;
      }
      if (subTab !== 'overview') {
        setSubTab('overview');
        return true;
      }
      return false;
    });
  }, [registerBackHandler, confirmCompleteDay, confirmPausePlan, createOpen, subTab]);

  // Overlay any pending offline queue items onto plans/logs so offline edits are never hidden
  const applyQueuedOverlay = useCallback(
    async (
      uid: string,
      basePlans: KhatmahPlan[],
      baseLogs: KhatmahReadingLog[]
    ): Promise<{ plans: KhatmahPlan[]; logs: KhatmahReadingLog[]; pendingLogIds: Set<string> }> => {
      const ops = await getQueuedOps(uid);
      const planMap = new Map<string, KhatmahPlan>();
      basePlans.forEach((p) => planMap.set(p.id, p));

      const logList = [...baseLogs];
      const logKeySet = new Set<string>(
        baseLogs.map((l) => `${l.plan_id}:${makeRangeKey(l.start_verse_id, l.end_verse_id)}`)
      );
      const pendingLogIds = new Set<string>();

      for (const op of ops) {
        if (op.type === 'khatmah_plan_create') {
          const payload = op.payload as unknown as KhatmahPlan;
          if (!planMap.has(payload.id)) {
            planMap.set(payload.id, {
              ...payload,
              user_id: uid,
              completed_at: payload.completed_at ?? null,
            });
          }
        } else if (op.type === 'khatmah_plan_status') {
          const { plan_id, status, completed_at, updated_at } = op.payload as {
            plan_id: string;
            status: KhatmahPlan['status'];
            completed_at: string | null;
            updated_at: string;
          };
          const existing = planMap.get(plan_id);
          if (existing) {
            planMap.set(plan_id, {
              ...existing,
              status,
              completed_at: status === 'completed' ? completed_at ?? updated_at : null,
              updated_at,
            });
          }
        } else if (op.type === 'khatmah_reading_log') {
          const payload = op.payload as {
            id: string;
            plan_id: string;
            reading_date: string;
            start_verse_id: number;
            end_verse_id: number;
            note?: string | null;
            created_at?: string;
          };
          const composite = `${payload.plan_id}:${makeRangeKey(
            payload.start_verse_id,
            payload.end_verse_id
          )}`;
          pendingLogIds.add(payload.id);
          if (!logKeySet.has(composite)) {
            logKeySet.add(composite);
            logList.unshift({
              id: payload.id,
              plan_id: payload.plan_id,
              user_id: uid,
              reading_date: payload.reading_date,
              start_verse_id: payload.start_verse_id,
              end_verse_id: payload.end_verse_id,
              note: payload.note ?? null,
              created_at: payload.created_at ?? op.updatedAt,
            });
          }
        }
      }

      const mergedPlans = Array.from(planMap.values()).sort((a, b) =>
        b.created_at.localeCompare(a.created_at)
      );
      const mergedLogs = logList.sort((a, b) => {
        const d = b.reading_date.localeCompare(a.reading_date);
        return d !== 0 ? d : b.created_at.localeCompare(a.created_at);
      });

      return { plans: mergedPlans, logs: mergedLogs, pendingLogIds };
    },
    []
  );

  const fetchScheduleForPlan = useCallback(
    async (plan: KhatmahPlan | null) => {
      if (!user || !plan) {
        setSchedule([]);
        return;
      }
      const cacheKey = `khatmah:schedule:${user.id}:${plan.id}`;
      setScheduleLoading(true);
      try {
        if (!isOnline) {
          const cached = await getCachedValue<KhatmahDailyScheduleRow[]>(cacheKey);
          if (cached && cached.length > 0) {
            setSchedule(cached);
          } else {
            const offlineSched = buildOfflineKhatmahSchedule(plan);
            setSchedule(offlineSched);
            await setCachedValue(cacheKey, offlineSched);
          }
          return;
        }

        const { data, error: schedErr } = await supabase
          .from('quran_khatmah_daily_schedule')
          .select(
            'plan_id, user_id, plan_name, status, day_number, scheduled_date, start_verse_id, end_verse_id, target_verses'
          )
          .eq('plan_id', plan.id)
          .eq('user_id', user.id)
          .order('day_number', { ascending: true });

        if (schedErr) throw schedErr;
        if (data && data.length > 0) {
          setSchedule(data as KhatmahDailyScheduleRow[]);
          await setCachedValue(cacheKey, data);
        } else {
          // If plan was created offline and hasn't synced yet, use deterministic schedule
          const cached = await getCachedValue<KhatmahDailyScheduleRow[]>(cacheKey);
          const fallback = cached && cached.length > 0 ? cached : buildOfflineKhatmahSchedule(plan);
          setSchedule(fallback);
          await setCachedValue(cacheKey, fallback);
        }
      } catch {
        const cached = await getCachedValue<KhatmahDailyScheduleRow[]>(cacheKey);
        const fallback = cached && cached.length > 0 ? cached : buildOfflineKhatmahSchedule(plan);
        setSchedule(fallback);
      } finally {
        setScheduleLoading(false);
      }
    },
    [user, isOnline]
  );

  const loadKhatmahData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const plansCacheKey = `khatmah:plans:${user.id}`;
    const logsCacheKey = `khatmah:logs:${user.id}`;

    try {
      let basePlans: KhatmahPlan[] = [];
      let baseLogs: KhatmahReadingLog[] = [];

      if (isOnline) {
        const [plansRes, logsRes] = await Promise.all([
          supabase
            .from('quran_khatmah_plans')
            .select(
              'id, user_id, name, duration_days, start_date, status, completed_at, created_at, updated_at'
            )
            .eq('user_id', user.id)
            .order('created_at', { ascending: false }),
          supabase
            .from('quran_khatmah_reading_logs')
            .select(
              'id, plan_id, user_id, reading_date, start_verse_id, end_verse_id, note, created_at'
            )
            .eq('user_id', user.id)
            .order('reading_date', { ascending: false })
            .order('created_at', { ascending: false }),
        ]);

        if (plansRes.error) throw plansRes.error;
        if (logsRes.error) throw logsRes.error;

        basePlans = (plansRes.data as KhatmahPlan[]) ?? [];
        baseLogs = (logsRes.data as KhatmahReadingLog[]) ?? [];
      } else {
        basePlans = (await getCachedValue<KhatmahPlan[]>(plansCacheKey)) ?? [];
        baseLogs = (await getCachedValue<KhatmahReadingLog[]>(logsCacheKey)) ?? [];
      }

      const merged = await applyQueuedOverlay(user.id, basePlans, baseLogs);
      setPlans(merged.plans);
      setAllLogs(merged.logs);
      setQueuedLogIds(merged.pendingLogIds);

      await Promise.all([
        setCachedValue(plansCacheKey, merged.plans),
        setCachedValue(logsCacheKey, merged.logs),
      ]);

      const active = merged.plans.find((p) => p.status === 'active') ?? null;
      const defaultSelected =
        merged.plans.find((p) => p.id === selectedPlanId) ?? active ?? merged.plans[0] ?? null;

      if (defaultSelected) {
        setSelectedPlanId(defaultSelected.id);
        await fetchScheduleForPlan(defaultSelected);
      } else {
        setSelectedPlanId(null);
        setSchedule([]);
      }
    } catch (err) {
      const [cachedPlans, cachedLogs] = await Promise.all([
        getCachedValue<KhatmahPlan[]>(plansCacheKey),
        getCachedValue<KhatmahReadingLog[]>(logsCacheKey),
      ]);
      if (cachedPlans || cachedLogs) {
        const merged = await applyQueuedOverlay(user.id, cachedPlans ?? [], cachedLogs ?? []);
        setPlans(merged.plans);
        setAllLogs(merged.logs);
        setQueuedLogIds(merged.pendingLogIds);

        const active = merged.plans.find((p) => p.status === 'active') ?? null;
        const defaultSelected =
          merged.plans.find((p) => p.id === selectedPlanId) ?? active ?? merged.plans[0] ?? null;
        if (defaultSelected) {
          setSelectedPlanId(defaultSelected.id);
          await fetchScheduleForPlan(defaultSelected);
        }
      } else {
        setError(
          isNetworkLikeError(err)
            ? t.offline.offlineBadge
            : err instanceof Error
            ? err.message
            : 'Unable to load Khatmah data'
        );
      }
    } finally {
      setLoading(false);
    }
  }, [user, isOnline, applyQueuedOverlay, fetchScheduleForPlan, selectedPlanId, t.offline.offlineBadge]);

  useEffect(() => {
    void loadKhatmahData();
  }, [loadKhatmahData]);

  // Refresh queued badge / server state whenever sync queue flushes
  useEffect(() => {
    if (!user) return;
    return subscribeSyncQueue(() => {
      void getQueuedOps(user.id).then((ops) => {
        const ids = new Set<string>();
        ops.forEach((op) => {
          if (op.type === 'khatmah_reading_log' && typeof op.payload.id === 'string') {
            ids.add(op.payload.id);
          }
        });
        setQueuedLogIds(ids);
      });
    });
  }, [user]);

  const activePlan = useMemo(
    () => plans.find((p) => p.status === 'active') ?? null,
    [plans]
  );

  const displayedPlan = useMemo(() => {
    if (selectedPlanId) {
      const found = plans.find((p) => p.id === selectedPlanId);
      if (found) return found;
    }
    return activePlan ?? plans[0] ?? null;
  }, [plans, selectedPlanId, activePlan]);

  const displayedPlanLogs = useMemo(() => {
    if (!displayedPlan) return [];
    return allLogs.filter((l) => l.plan_id === displayedPlan.id);
  }, [allLogs, displayedPlan]);

  const progress = useMemo(
    () => computeKhatmahProgress(schedule, displayedPlanLogs, todayMogadishu),
    [schedule, displayedPlanLogs, todayMogadishu]
  );

  const filteredSchedule = useMemo(() => {
    if (scheduleFilter === 'all') return schedule;
    return schedule.filter((day) => {
      const isDone = progress.completedRangeKeys.has(
        makeRangeKey(day.start_verse_id, day.end_verse_id)
      );
      return scheduleFilter === 'completed' ? isDone : !isDone;
    });
  }, [schedule, scheduleFilter, progress.completedRangeKeys]);

  const planById = useMemo(() => {
    const map = new Map<string, KhatmahPlan>();
    plans.forEach((p) => map.set(p.id, p));
    return map;
  }, [plans]);

  const handleSelectPlan = async (plan: KhatmahPlan) => {
    setSelectedPlanId(plan.id);
    setSubTab('overview');
    await fetchScheduleForPlan(plan);
  };

  // Create Khatmah Plan (online or queued offline)
  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || creatingPlan) return;

    if (activePlan) {
      showToast(t.khatmah.activePlanExistsErr, 'error');
      return;
    }

    setCreatingPlan(true);
    const nowIso = new Date().toISOString();
    const newId = generateUuid();
    const resolvedName =
      planNameInput.trim() || getDefaultPlanName(durationDays, lang);

    const newPlan: KhatmahPlan = {
      id: newId,
      user_id: user.id,
      name: resolvedName,
      duration_days: durationDays,
      start_date: todayMogadishu,
      status: 'active',
      completed_at: null,
      created_at: nowIso,
      updated_at: nowIso,
    };

    const queuePlanOffline = async () => {
      const offlineSchedule = buildOfflineKhatmahSchedule(newPlan);
      await enqueueSyncOp(user.id, 'khatmah_plan_create', `khatmah_plan_create:${user.id}:${newId}`, {
        id: newId,
        name: resolvedName,
        duration_days: durationDays,
        start_date: todayMogadishu,
        status: 'active',
        created_at: nowIso,
        updated_at: nowIso,
      });

      const nextPlans = [newPlan, ...plans];
      setPlans(nextPlans);
      setSelectedPlanId(newId);
      setSchedule(offlineSchedule);
      await Promise.all([
        setCachedValue(`khatmah:plans:${user.id}`, nextPlans),
        setCachedValue(`khatmah:schedule:${user.id}:${newId}`, offlineSchedule),
      ]);
      setCreateOpen(false);
      setPlanNameInput('');
      setSubTab('overview');
      showToast(t.khatmah.queuedOfflineSuccess, 'info');
    };

    try {
      if (!isOnline) {
        await queuePlanOffline();
        return;
      }

      const { data: created, error: insertErr } = await supabase
        .from('quran_khatmah_plans')
        .insert({
          id: newId,
          user_id: user.id,
          name: resolvedName,
          duration_days: durationDays,
          start_date: todayMogadishu,
          status: 'active',
        })
        .select('*')
        .single();

      if (insertErr) {
        if (getSupabaseErrorCode(insertErr) === '23505') {
          showToast(t.khatmah.activePlanExistsErr, 'error');
          await loadKhatmahData();
          return;
        }
        throw insertErr;
      }

      const savedPlan = created as KhatmahPlan;
      const nextPlans = [savedPlan, ...plans.filter((p) => p.id !== savedPlan.id)];
      setPlans(nextPlans);
      setSelectedPlanId(savedPlan.id);
      await setCachedValue(`khatmah:plans:${user.id}`, nextPlans);
      await fetchScheduleForPlan(savedPlan);
      setCreateOpen(false);
      setPlanNameInput('');
      setSubTab('overview');
      showToast(t.khatmah.planCreated, 'success');
    } catch (err) {
      if (isNetworkLikeError(err)) {
        await queuePlanOffline();
      } else {
        showToast(
          getSupabaseErrorCode(err) === '23505'
            ? t.khatmah.activePlanExistsErr
            : t.common.retry,
          'error'
        );
      }
    } finally {
      setCreatingPlan(false);
    }
  };

  // Continue Reading: fetch matching record from quran_verses and jump to existing Quran reader
  const handleContinueReading = async (day: KhatmahDailyScheduleRow) => {
    if (openingReaderDay === day.day_number) return;
    setOpeningReaderDay(day.day_number);
    const cacheKey = `quran:verse_ref:${day.start_verse_id}`;

    try {
      if (isOnline) {
        const { data, error: verseErr } = await supabase
          .from('quran_verses')
          .select('id, surah_id, verse_number')
          .eq('id', day.start_verse_id)
          .maybeSingle();

        if (!verseErr && data) {
          await setCachedValue(cacheKey, {
            surahId: data.surah_id,
            verseNumber: data.verse_number,
          });
          openQuranAt(data.surah_id, data.verse_number);
          return;
        }
      }

      const cachedRef = await getCachedValue<{ surahId: number; verseNumber: number }>(cacheKey);
      if (cachedRef) {
        openQuranAt(cachedRef.surahId, cachedRef.verseNumber);
        return;
      }

      const fallbackRef = resolveVerseRefFromSurahs(day.start_verse_id, surahs);
      if (fallbackRef) {
        openQuranAt(fallbackRef.surahId, fallbackRef.verseNumber);
        return;
      }

      showToast(t.offline.offlineBadge, 'error');
    } catch {
      const cachedRef = await getCachedValue<{ surahId: number; verseNumber: number }>(cacheKey);
      const fallbackRef = cachedRef ?? resolveVerseRefFromSurahs(day.start_verse_id, surahs);
      if (fallbackRef) {
        openQuranAt(fallbackRef.surahId, fallbackRef.verseNumber);
      } else {
        showToast(t.offline.offlineBadge, 'error');
      }
    } finally {
      setOpeningReaderDay(null);
    }
  };

  // Update plan status (pause, resume, or complete after all 6,236 verses are done)
  const updatePlanStatus = async (
    plan: KhatmahPlan,
    nextStatus: 'active' | 'paused' | 'completed',
    silentToast = false
  ) => {
    if (!user) return;
    if (nextStatus === 'active' && activePlan && activePlan.id !== plan.id) {
      showToast(t.khatmah.activePlanExistsErr, 'error');
      return;
    }

    setUpdatingStatusPlanId(plan.id);
    const nowIso = new Date().toISOString();
    const completedAt = nextStatus === 'completed' ? nowIso : null;

    const applyLocalStatus = async (queued: boolean) => {
      const updatedPlan: KhatmahPlan = {
        ...plan,
        status: nextStatus,
        completed_at: completedAt,
        updated_at: nowIso,
      };
      const nextPlans = plans.map((p) => (p.id === plan.id ? updatedPlan : p));
      setPlans(nextPlans);
      await setCachedValue(`khatmah:plans:${user.id}`, nextPlans);

      if (queued) {
        await enqueueSyncOp(
          user.id,
          'khatmah_plan_status',
          `khatmah_plan_status:${user.id}:${plan.id}`,
          {
            plan_id: plan.id,
            status: nextStatus,
            completed_at: completedAt,
            updated_at: nowIso,
          }
        );
      }

      if (!silentToast) {
        if (nextStatus === 'paused') showToast(t.khatmah.planPaused, queued ? 'info' : 'success');
        if (nextStatus === 'active') showToast(t.khatmah.planResumed, queued ? 'info' : 'success');
        if (nextStatus === 'completed') showToast(t.khatmah.planCompletedToast, 'success');
      }
    };

    try {
      if (!isOnline) {
        await applyLocalStatus(true);
        return;
      }

      const { data: updated, error: updErr } = await supabase
        .from('quran_khatmah_plans')
        .update({
          status: nextStatus,
          completed_at: completedAt,
          updated_at: nowIso,
        })
        .eq('id', plan.id)
        .eq('user_id', user.id)
        .select('*')
        .single();

      if (updErr) {
        if (getSupabaseErrorCode(updErr) === '23505') {
          showToast(t.khatmah.activePlanExistsErr, 'error');
          await loadKhatmahData();
          return;
        }
        throw updErr;
      }

      const savedPlan = updated as KhatmahPlan;
      const nextPlans = plans.map((p) => (p.id === savedPlan.id ? savedPlan : p));
      setPlans(nextPlans);
      await setCachedValue(`khatmah:plans:${user.id}`, nextPlans);

      if (!silentToast) {
        if (nextStatus === 'paused') showToast(t.khatmah.planPaused, 'success');
        if (nextStatus === 'active') showToast(t.khatmah.planResumed, 'success');
        if (nextStatus === 'completed') showToast(t.khatmah.planCompletedToast, 'success');
      }
    } catch (err) {
      if (isNetworkLikeError(err)) {
        await applyLocalStatus(true);
      } else {
        showToast(
          getSupabaseErrorCode(err) === '23505'
            ? t.khatmah.activePlanExistsErr
            : t.common.retry,
          'error'
        );
      }
    } finally {
      setUpdatingStatusPlanId(null);
      setConfirmPausePlan(null);
    }
  };

  // Mark daily target completed
  const handleConfirmDayComplete = async () => {
    if (!user || !displayedPlan || !confirmCompleteDay || loggingDay) return;

    const rangeKey = makeRangeKey(
      confirmCompleteDay.start_verse_id,
      confirmCompleteDay.end_verse_id
    );
    if (progress.completedRangeKeys.has(rangeKey)) {
      setConfirmCompleteDay(null);
      showToast(t.khatmah.alreadyCompleted, 'info');
      return;
    }

    setLoggingDay(true);
    const nowIso = new Date().toISOString();
    const logId = generateUuid();
    const readingDate = getMogadishuDateString();

    const newLog: KhatmahReadingLog = {
      id: logId,
      plan_id: displayedPlan.id,
      user_id: user.id,
      reading_date: readingDate,
      start_verse_id: confirmCompleteDay.start_verse_id,
      end_verse_id: confirmCompleteDay.end_verse_id,
      note: null,
      created_at: nowIso,
    };

    const finalizeLocalUpdate = async (savedLog: KhatmahReadingLog, queuedOffline: boolean) => {
      const nextLogs = [savedLog, ...allLogs];
      setAllLogs(nextLogs);
      await setCachedValue(`khatmah:logs:${user.id}`, nextLogs);

      if (queuedOffline) {
        setQueuedLogIds((prev) => new Set(prev).add(savedLog.id));
      }

      const planLogsAfter = nextLogs.filter((l) => l.plan_id === displayedPlan.id);
      const nextProgress = computeKhatmahProgress(schedule, planLogsAfter, todayMogadishu);

      setConfirmCompleteDay(null);

      // Only mark plan completed when ALL 6,236 verses in the schedule have been completed
      if (nextProgress.isFullyCompleted && displayedPlan.status !== 'completed') {
        await updatePlanStatus(displayedPlan, 'completed', true);
        showToast(t.khatmah.planCompletedToast, 'success');
      } else {
        showToast(
          queuedOffline ? t.khatmah.queuedOfflineSuccess : t.khatmah.completedSuccess,
          queuedOffline ? 'info' : 'success'
        );
      }
    };

    const queueLogOffline = async () => {
      const dedupeKey = `khatmah_log:${user.id}:${displayedPlan.id}:${confirmCompleteDay.start_verse_id}:${confirmCompleteDay.end_verse_id}`;
      await enqueueSyncOp(user.id, 'khatmah_reading_log', dedupeKey, {
        id: logId,
        plan_id: displayedPlan.id,
        reading_date: readingDate,
        start_verse_id: confirmCompleteDay.start_verse_id,
        end_verse_id: confirmCompleteDay.end_verse_id,
        note: null,
        created_at: nowIso,
      });
      await finalizeLocalUpdate(newLog, true);
    };

    try {
      if (!isOnline) {
        await queueLogOffline();
        return;
      }

      const { data: inserted, error: logErr } = await supabase
        .from('quran_khatmah_reading_logs')
        .insert({
          id: logId,
          plan_id: displayedPlan.id,
          user_id: user.id,
          reading_date: readingDate,
          start_verse_id: confirmCompleteDay.start_verse_id,
          end_verse_id: confirmCompleteDay.end_verse_id,
        })
        .select('*')
        .single();

      if (logErr) {
        if (getSupabaseErrorCode(logErr) === '23505') {
          setConfirmCompleteDay(null);
          showToast(t.khatmah.duplicateLogError, 'info');
          await loadKhatmahData();
          return;
        }
        throw logErr;
      }

      await finalizeLocalUpdate(inserted as KhatmahReadingLog, false);
    } catch (err) {
      if (isNetworkLikeError(err)) {
        await queueLogOffline();
      } else {
        showToast(
          getSupabaseErrorCode(err) === '23505'
            ? t.khatmah.duplicateLogError
            : t.common.retry,
          'error'
        );
      }
    } finally {
      setLoggingDay(false);
    }
  };

  const planStatusText = (status: KhatmahPlan['status']) => {
    if (status === 'active') return t.khatmah.statusActive;
    if (status === 'paused') return t.khatmah.statusPaused;
    if (status === 'completed') return t.khatmah.statusDone;
    return t.khatmah.statusCancelled;
  };

  const previewTargetEndDate = useMemo(
    () => calculateTargetEndDate(todayMogadishu, durationDays),
    [todayMogadishu, durationDays]
  );

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-48 rounded-2xl bg-[#EFECE4] dark:bg-[#112921] animate-pulse" />
        <div className="h-72 rounded-2xl bg-[#EFECE4] dark:bg-[#112921] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Sub-Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl sm:text-2xl font-semibold text-[#14241E] dark:text-[#F2EFE9]">
            {t.khatmah.title}
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-[#52635C] dark:text-[#A3B8AF]">
            {t.khatmah.subtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center p-1 rounded-xl bg-[#EFECE4] dark:bg-[#0C1F19] border border-[#E5DFD3] dark:border-[#1B3A2F]">
            <button
              type="button"
              onClick={() => setSubTab('overview')}
              className={`min-h-[38px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                subTab === 'overview'
                  ? 'bg-white dark:bg-[#143328] text-[#064E3B] dark:text-[#F2EFE9] shadow-xs'
                  : 'text-[#52635C] dark:text-[#8FA89E] hover:text-[#14241E]'
              }`}
            >
              {t.khatmah.todayPlanTitle}
            </button>
            <button
              type="button"
              onClick={() => setSubTab('plans')}
              className={`min-h-[38px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap ${
                subTab === 'plans'
                  ? 'bg-white dark:bg-[#143328] text-[#064E3B] dark:text-[#F2EFE9] shadow-xs'
                  : 'text-[#52635C] dark:text-[#8FA89E] hover:text-[#14241E]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>
                {t.khatmah.plansTitle}
                {plans.length > 0 ? ` (${plans.length})` : ''}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('history')}
              className={`min-h-[38px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap ${
                subTab === 'history'
                  ? 'bg-white dark:bg-[#143328] text-[#064E3B] dark:text-[#F2EFE9] shadow-xs'
                  : 'text-[#52635C] dark:text-[#8FA89E] hover:text-[#14241E]'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>{t.khatmah.historyTitle}</span>
            </button>
          </div>

          {!activePlan && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-[#064E3B] text-white dark:bg-[#10B981] dark:text-[#071410] text-xs font-semibold inline-flex items-center gap-1.5 hover:opacity-95 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>{t.khatmah.startBtn}</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-[#FECACA] dark:border-[#7F1D1D] bg-[#FEF2F2] dark:bg-[#2A1215] flex items-center justify-between gap-4">
          <p className="text-sm text-[#991B1B] dark:text-[#FCA5A5]">{error}</p>
          <button
            type="button"
            onClick={() => void loadKhatmahData()}
            className="min-h-[38px] px-3 py-1.5 text-xs font-medium rounded-lg bg-[#991B1B] text-white whitespace-nowrap"
          >
            {t.common.retry}
          </button>
        </div>
      )}

      {/* OVERVIEW TAB */}
      {subTab === 'overview' && (
        <>
          {!displayedPlan ? (
            /* Empty State Welcome Intro */
            <section className="rounded-2xl border border-[#E5DFD3] dark:border-[#1B3A2F] bg-white dark:bg-[#0C1F19] p-6 sm:p-10">
              <div className="max-w-2xl space-y-5">
                <div className="w-12 h-12 rounded-2xl bg-[#ECFDF5] dark:bg-[#112E24] flex items-center justify-center text-[#064E3B] dark:text-[#34D399]">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-display text-2xl font-semibold text-[#14241E] dark:text-[#F2EFE9] text-balance">
                    {t.khatmah.introTitle}
                  </h3>
                  <p className="text-sm sm:text-base text-[#52635C] dark:text-[#A3B8AF] leading-relaxed">
                    {t.khatmah.introBody}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-1">
                  {([30, 60, 90] as KhatmahDurationDays[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        setDurationDays(d);
                        setCreateOpen(true);
                      }}
                      className="min-h-[68px] p-3.5 rounded-xl border border-[#E5DFD3] dark:border-[#1B3A2F] bg-[#FAF8F3] dark:bg-[#071410] hover:border-[#064E3B] dark:hover:border-[#34D399] text-left transition-colors"
                    >
                      <p className="text-lg font-bold tabular-nums text-[#064E3B] dark:text-[#34D399]">
                        {d} {t.khatmah.daysUnit}
                      </p>
                      <p className="text-xs text-[#52635C] dark:text-[#8FA89E] tabular-nums mt-0.5">
                        ~{Math.round(6236 / d)} {t.khatmah.versesCountUnit}
                      </p>
                    </button>
                  ))}
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    className="min-h-[48px] px-6 py-3 rounded-xl bg-[#064E3B] text-white dark:bg-[#10B981] dark:text-[#071410] text-sm font-semibold inline-flex items-center gap-2 hover:opacity-95"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{t.khatmah.startBtn}</span>
                  </button>
                </div>
              </div>
            </section>
          ) : (
            <div className="space-y-6">
              {/* Plan Summary & Progress Card */}
              <section className="rounded-2xl border border-[#E5DFD3] dark:border-[#1B3A2F] bg-white dark:bg-[#0C1F19] p-5 sm:p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#52635C] dark:text-[#8FA89E]">
                      <span className="font-semibold text-[#064E3B] dark:text-[#34D399]">
                        {planStatusText(displayedPlan.status)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        {displayedPlan.duration_days} {t.khatmah.daysUnit}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        {t.khatmah.targetEndDateLabel}:{' '}
                        {formatShortDate(
                          calculateTargetEndDate(
                            displayedPlan.start_date,
                            displayedPlan.duration_days
                          ),
                          lang
                        )}
                      </span>
                    </div>
                    <h3 className="font-display text-xl sm:text-2xl font-semibold text-[#14241E] dark:text-[#F2EFE9]">
                      {displayedPlan.name}
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {displayedPlan.status === 'active' && (
                      <button
                        type="button"
                        disabled={updatingStatusPlanId === displayedPlan.id}
                        onClick={() => setConfirmPausePlan(displayedPlan)}
                        className="min-h-[44px] px-4 py-2 rounded-xl border border-[#E5DFD3] dark:border-[#1B3A2F] text-xs font-semibold text-[#14241E] dark:text-[#F2EFE9] hover:bg-[#FAF8F3] dark:hover:bg-[#112921] inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <Pause className="w-3.5 h-3.5 text-[#B48A3E] dark:text-[#D4AF6A]" />
                        <span>{t.khatmah.pauseBtn}</span>
                      </button>
                    )}

                    {displayedPlan.status === 'paused' && (
                      <button
                        type="button"
                        disabled={updatingStatusPlanId === displayedPlan.id}
                        onClick={() => void updatePlanStatus(displayedPlan, 'active')}
                        className="min-h-[44px] px-4 py-2 rounded-xl bg-[#064E3B] text-white dark:bg-[#10B981] dark:text-[#071410] text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>{t.khatmah.resumeBtn}</span>
                      </button>
                    )}

                    {displayedPlan.status !== 'active' && !activePlan && (
                      <button
                        type="button"
                        onClick={() => setCreateOpen(true)}
                        className="min-h-[44px] px-4 py-2 rounded-xl border border-[#E5DFD3] dark:border-[#1B3A2F] text-xs font-semibold text-[#064E3B] dark:text-[#34D399] hover:bg-[#FAF8F3] dark:hover:bg-[#112921] inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{t.khatmah.startBtn}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-medium text-[#52635C] dark:text-[#A3B8AF]">
                      {t.khatmah.progressTitle}
                    </span>
                    <span className="text-2xl font-bold tabular-nums text-[#064E3B] dark:text-[#34D399]">
                      {progress.completionPercentage}%
                    </span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-[#EFECE4] dark:bg-[#143328] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#064E3B] dark:bg-[#10B981] transition-all duration-300"
                      style={{ width: `${Math.min(100, progress.completionPercentage)}%` }}
                    />
                  </div>
                </div>

                {/* Metric Summary Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-[#EFECE4] dark:border-[#18352B]">
                  <div>
                    <p className="text-xs text-[#52635C] dark:text-[#8FA89E]">
                      {t.khatmah.completedDaysLabel}
                    </p>
                    <p className="mt-1 text-xl font-bold tabular-nums text-[#14241E] dark:text-[#F2EFE9]">
                      {progress.completedDaysCount} / {progress.totalDays}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#52635C] dark:text-[#8FA89E]">
                      {t.khatmah.remainingDaysLabel}
                    </p>
                    <p className="mt-1 text-xl font-bold tabular-nums text-[#14241E] dark:text-[#F2EFE9]">
                      {progress.remainingDaysCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#52635C] dark:text-[#8FA89E]">
                      {t.khatmah.versesCompletedLabel}
                    </p>
                    <p className="mt-1 text-xl font-bold tabular-nums text-[#14241E] dark:text-[#F2EFE9]">
                      {progress.completedVersesCount.toLocaleString()} / 6,236
                    </p>
                  </div>
                </div>

                {/* Paused / Completed State Callout or Today's Spotlight */}
                {displayedPlan.status === 'paused' && (
                  <div className="p-4 rounded-xl border border-[#E6CFA0] dark:border-[#5C4820] bg-[#FDF6E7] dark:bg-[#231D11] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <p className="text-sm text-[#7A6334] dark:text-[#E6CFA0]">
                      {t.khatmah.pausedNotice}
                    </p>
                    {!activePlan && (
                      <button
                        type="button"
                        disabled={updatingStatusPlanId === displayedPlan.id}
                        onClick={() => void updatePlanStatus(displayedPlan, 'active')}
                        className="min-h-[42px] px-4 py-2 rounded-xl bg-[#064E3B] text-white dark:bg-[#10B981] dark:text-[#071410] text-xs font-semibold whitespace-nowrap self-start sm:self-auto"
                      >
                        {t.khatmah.resumeBtn}
                      </button>
                    )}
                  </div>
                )}

                {progress.isFullyCompleted ? (
                  <div className="p-5 rounded-xl border border-[#A7F3D0] dark:border-[#065F46] bg-[#ECFDF5] dark:bg-[#0B2E22] flex items-start gap-3">
                    <Trophy className="w-5 h-5 text-[#064E3B] dark:text-[#34D399] shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold text-[#064E3B] dark:text-[#6EE7B7]">
                        {t.khatmah.completedBannerTitle}
                      </h4>
                      <p className="text-xs sm:text-sm text-[#14532D] dark:text-[#A7F3D0]">
                        {t.khatmah.completedBannerBody}
                      </p>
                    </div>
                  </div>
                ) : (
                  progress.currentDay &&
                  displayedPlan.status === 'active' && (
                    <div className="p-5 rounded-xl border border-[#D8CEB8] dark:border-[#244A3C] bg-[#FAF8F3] dark:bg-[#071410] space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs font-medium text-[#B48A3E] dark:text-[#D4AF6A]">
                          <span>{t.khatmah.todayPlanTitle}</span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">
                            {t.khatmah.dayPrefix} {progress.currentDay.day_number}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">
                            {formatShortDate(progress.currentDay.scheduled_date, lang)}
                          </span>
                        </div>
                        <span className="text-xs font-semibold tabular-nums text-[#064E3B] dark:text-[#34D399]">
                          {progress.currentDay.target_verses} {t.khatmah.versesCountUnit}
                        </span>
                      </div>

                      <p className="font-display text-lg font-semibold text-[#14241E] dark:text-[#F2EFE9] tabular-nums">
                        {formatVerseRefLabel(progress.currentDay.start_verse_id, surahs, lang)} —{' '}
                        {formatVerseRefLabel(progress.currentDay.end_verse_id, surahs, lang)}
                      </p>

                      <div className="flex flex-col sm:flex-row gap-3 pt-1">
                        <button
                          type="button"
                          disabled={openingReaderDay === progress.currentDay.day_number}
                          onClick={() => void handleContinueReading(progress.currentDay!)}
                          className="min-h-[46px] flex-1 px-5 py-2.5 rounded-xl bg-[#064E3B] text-white dark:bg-[#10B981] dark:text-[#071410] text-sm font-semibold inline-flex items-center justify-center gap-2 hover:opacity-95 whitespace-nowrap"
                        >
                          <BookOpen className="w-4 h-4" />
                          <span>{t.khatmah.continueReading}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setConfirmCompleteDay(progress.currentDay!)}
                          className="min-h-[46px] flex-1 px-5 py-2.5 rounded-xl border border-[#064E3B] dark:border-[#34D399] text-[#064E3B] dark:text-[#34D399] hover:bg-[#ECFDF5] dark:hover:bg-[#112E24] text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                        >
                          <Check className="w-4 h-4" />
                          <span>{t.khatmah.markCompleted}</span>
                        </button>
                      </div>
                    </div>
                  )
                )}
              </section>

              {/* Daily Reading Schedule List */}
              <section className="rounded-2xl border border-[#E5DFD3] dark:border-[#1B3A2F] bg-white dark:bg-[#0C1F19] overflow-hidden">
                <div className="p-5 sm:px-6 border-b border-[#EFECE4] dark:border-[#18352B] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Calendar className="w-5 h-5 text-[#B48A3E] dark:text-[#D4AF6A]" />
                    <h3 className="font-display text-lg font-semibold text-[#14241E] dark:text-[#F2EFE9]">
                      {t.khatmah.scheduleTitle}
                    </h3>
                  </div>

                  <div className="flex items-center p-1 rounded-xl bg-[#FAF8F3] dark:bg-[#071410] border border-[#E5DFD3] dark:border-[#1B3A2F] self-start sm:self-auto">
                    {(['all', 'remaining', 'completed'] as ScheduleFilter[]).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setScheduleFilter(f)}
                        className={`min-h-[34px] px-3 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                          scheduleFilter === f
                            ? 'bg-white dark:bg-[#143328] text-[#064E3B] dark:text-[#F2EFE9] shadow-xs'
                            : 'text-[#52635C] dark:text-[#8FA89E]'
                        }`}
                      >
                        {f === 'all'
                          ? t.khatmah.filterAll
                          : f === 'remaining'
                          ? t.khatmah.filterRemaining
                          : t.khatmah.filterCompleted}
                      </button>
                    ))}
                  </div>
                </div>

                {scheduleLoading ? (
                  <div className="p-5 space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-16 rounded-xl bg-[#EFECE4] dark:bg-[#112921] animate-pulse"
                      />
                    ))}
                  </div>
                ) : filteredSchedule.length === 0 ? (
                  <p className="p-6 text-sm text-[#52635C] dark:text-[#A3B8AF]">
                    {schedule.length === 0 ? t.khatmah.noSchedule : t.khatmah.allDaysDone}
                  </p>
                ) : (
                  <div className="divide-y divide-[#EFECE4] dark:divide-[#18352B]">
                    {filteredSchedule.map((day) => {
                      const rangeKey = makeRangeKey(day.start_verse_id, day.end_verse_id);
                      const isCompleted = progress.completedRangeKeys.has(rangeKey);
                      const matchedLog = progress.logByRangeKey.get(rangeKey);
                      const isPendingSync = matchedLog ? queuedLogIds.has(matchedLog.id) : false;
                      const isCurrent =
                        !isCompleted &&
                        progress.currentDay?.day_number === day.day_number &&
                        displayedPlan.status === 'active';

                      const statusText = isCompleted
                        ? t.khatmah.statusCompleted
                        : isCurrent
                        ? t.khatmah.statusCurrent
                        : t.khatmah.statusUpcoming;

                      return (
                        <div
                          key={day.day_number}
                          className={`p-4 sm:px-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors ${
                            isCurrent
                              ? 'bg-[#F5F9F6] dark:bg-[#0F261E]'
                              : isCompleted
                              ? 'bg-[#FAF8F3]/60 dark:bg-[#091813]'
                              : ''
                          }`}
                        >
                          <div className="flex items-start gap-3.5 min-w-0">
                            <span
                              className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold tabular-nums shrink-0 mt-0.5 ${
                                isCompleted
                                  ? 'bg-[#ECFDF5] dark:bg-[#112E24] text-[#064E3B] dark:text-[#34D399]'
                                  : isCurrent
                                  ? 'bg-[#064E3B] text-white dark:bg-[#10B981] dark:text-[#071410]'
                                  : 'bg-[#F4F1EA] dark:bg-[#143328] text-[#52635C] dark:text-[#A3B8AF]'
                              }`}
                            >
                              {isCompleted ? <Check className="w-4 h-4" /> : day.day_number}
                            </span>

                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-2 text-xs text-[#52635C] dark:text-[#8FA89E] tabular-nums">
                                <span className="font-semibold text-[#14241E] dark:text-[#F2EFE9]">
                                  {t.khatmah.dayPrefix} {day.day_number}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span>{formatShortDate(day.scheduled_date, lang)}</span>
                                <span aria-hidden="true">·</span>
                                <span
                                  className={`font-medium ${
                                    isCompleted
                                      ? 'text-[#064E3B] dark:text-[#34D399]'
                                      : isCurrent
                                      ? 'text-[#B48A3E] dark:text-[#D4AF6A]'
                                      : ''
                                  }`}
                                >
                                  {statusText}
                                </span>
                                {isPendingSync && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="inline-flex items-center gap-1 text-[#7A6334] dark:text-[#E6CFA0]">
                                      <WifiOff className="w-3 h-3" />
                                      <span>{t.khatmah.queuedSyncNote}</span>
                                    </span>
                                  </>
                                )}
                              </div>

                              <p className="text-sm font-medium text-[#14241E] dark:text-[#F2EFE9] tabular-nums">
                                {formatVerseRefLabel(day.start_verse_id, surahs, lang)} —{' '}
                                {formatVerseRefLabel(day.end_verse_id, surahs, lang)}
                              </p>

                              <p className="text-xs text-[#52635C] dark:text-[#8FA89E] tabular-nums">
                                {day.target_verses} {t.khatmah.versesCountUnit}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0 sm:pl-13 lg:pl-0">
                            <button
                              type="button"
                              disabled={openingReaderDay === day.day_number}
                              onClick={() => void handleContinueReading(day)}
                              className="min-h-[40px] px-3.5 py-2 rounded-xl border border-[#E5DFD3] dark:border-[#1B3A2F] bg-white dark:bg-[#0C1F19] text-xs font-medium text-[#14241E] dark:text-[#F2EFE9] hover:border-[#064E3B] dark:hover:border-[#34D399] inline-flex items-center gap-1.5 whitespace-nowrap"
                            >
                              <BookOpen className="w-3.5 h-3.5 text-[#064E3B] dark:text-[#34D399]" />
                              <span>{t.khatmah.continueReading}</span>
                            </button>

                            {!isCompleted && displayedPlan.status === 'active' && (
                              <button
                                type="button"
                                onClick={() => setConfirmCompleteDay(day)}
                                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#064E3B] text-white dark:bg-[#10B981] dark:text-[#071410] text-xs font-semibold inline-flex items-center gap-1.5 hover:opacity-95 whitespace-nowrap"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{t.khatmah.markCompleted}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          )}
        </>
      )}

      {/* PLANS MANAGEMENT TAB */}
      {subTab === 'plans' && (
        <section className="rounded-2xl border border-[#E5DFD3] dark:border-[#1B3A2F] bg-white dark:bg-[#0C1F19] overflow-hidden">
          <div className="p-5 sm:px-6 border-b border-[#EFECE4] dark:border-[#18352B] flex items-center justify-between gap-4">
            <h3 className="font-display text-lg font-semibold text-[#14241E] dark:text-[#F2EFE9]">
              {t.khatmah.plansTitle}
            </h3>
            {!activePlan && (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#064E3B] text-white dark:bg-[#10B981] dark:text-[#071410] text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t.khatmah.startBtn}</span>
              </button>
            )}
          </div>

          {plans.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <p className="text-sm text-[#52635C] dark:text-[#A3B8AF]">{t.khatmah.noPlans}</p>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#064E3B] text-white dark:bg-[#10B981] dark:text-[#071410] text-xs font-semibold inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>{t.khatmah.startBtn}</span>
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[#EFECE4] dark:divide-[#18352B]">
              {plans.map((plan) => {
                const planLogs = allLogs.filter((l) => l.plan_id === plan.id);
                const planSched =
                  plan.id === displayedPlan?.id && schedule.length > 0
                    ? schedule
                    : buildOfflineKhatmahSchedule(plan);
                const stats = computeKhatmahProgress(planSched, planLogs, todayMogadishu);
                const isSelected = displayedPlan?.id === plan.id;

                return (
                  <div
                    key={plan.id}
                    className={`p-5 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      isSelected ? 'bg-[#F5F9F6] dark:bg-[#0F261E]' : ''
                    }`}
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#52635C] dark:text-[#8FA89E] tabular-nums">
                        <span
                          className={`font-semibold ${
                            plan.status === 'active'
                              ? 'text-[#064E3B] dark:text-[#34D399]'
                              : plan.status === 'completed'
                              ? 'text-[#B48A3E] dark:text-[#D4AF6A]'
                              : ''
                          }`}
                        >
                          {planStatusText(plan.status)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {plan.duration_days} {t.khatmah.daysUnit}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {formatShortDate(plan.start_date, lang)} —{' '}
                          {formatShortDate(
                            calculateTargetEndDate(plan.start_date, plan.duration_days),
                            lang
                          )}
                        </span>
                      </div>
                      <h4 className="font-display text-base font-semibold text-[#14241E] dark:text-[#F2EFE9] truncate">
                        {plan.name}
                      </h4>
                      <p className="text-xs text-[#52635C] dark:text-[#A3B8AF] tabular-nums">
                        {stats.completionPercentage}% · {stats.completedDaysCount}/{stats.totalDays}{' '}
                        {t.khatmah.daysUnit}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleSelectPlan(plan)}
                        className="min-h-[40px] px-3.5 py-2 rounded-xl border border-[#E5DFD3] dark:border-[#1B3A2F] bg-white dark:bg-[#0C1F19] text-xs font-medium text-[#14241E] dark:text-[#F2EFE9] hover:border-[#064E3B] whitespace-nowrap"
                      >
                        {t.khatmah.scheduleTitle}
                      </button>

                      {plan.status === 'active' && (
                        <button
                          type="button"
                          disabled={updatingStatusPlanId === plan.id}
                          onClick={() => setConfirmPausePlan(plan)}
                          className="min-h-[40px] px-3.5 py-2 rounded-xl border border-[#E5DFD3] dark:border-[#1B3A2F] text-xs font-semibold text-[#7A6334] dark:text-[#E6CFA0] inline-flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <Pause className="w-3.5 h-3.5" />
                          <span>{t.khatmah.pauseBtn}</span>
                        </button>
                      )}

                      {plan.status === 'paused' && (
                        <button
                          type="button"
                          disabled={updatingStatusPlanId === plan.id || Boolean(activePlan)}
                          onClick={() => void updatePlanStatus(plan, 'active')}
                          className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#064E3B] text-white dark:bg-[#10B981] dark:text-[#071410] text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>{t.khatmah.resumeBtn}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* READING HISTORY TAB */}
      {subTab === 'history' && (
        <section className="rounded-2xl border border-[#E5DFD3] dark:border-[#1B3A2F] bg-white dark:bg-[#0C1F19] overflow-hidden">
          <div className="p-5 sm:px-6 border-b border-[#EFECE4] dark:border-[#18352B] flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Clock className="w-5 h-5 text-[#B48A3E] dark:text-[#D4AF6A]" />
              <h3 className="font-display text-lg font-semibold text-[#14241E] dark:text-[#F2EFE9]">
                {t.khatmah.historyTitle}
              </h3>
            </div>
            <span className="text-xs font-medium tabular-nums text-[#52635C] dark:text-[#8FA89E]">
              {allLogs.length}
            </span>
          </div>

          {allLogs.length === 0 ? (
            <p className="p-6 text-sm text-[#52635C] dark:text-[#A3B8AF]">{t.khatmah.noHistory}</p>
          ) : (
            <div className="divide-y divide-[#EFECE4] dark:divide-[#18352B]">
              {allLogs.map((log) => {
                const parentPlan = planById.get(log.plan_id);
                const verseCount = Math.max(1, log.end_verse_id - log.start_verse_id + 1);
                const isPending = queuedLogIds.has(log.id);
                return (
                  <div
                    key={log.id}
                    className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#52635C] dark:text-[#8FA89E] tabular-nums">
                        <span className="font-semibold text-[#064E3B] dark:text-[#34D399]">
                          {formatShortDate(log.reading_date, lang)}
                        </span>
                        {parentPlan && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="truncate">{parentPlan.name}</span>
                          </>
                        )}
                        {isPending && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 text-[#7A6334] dark:text-[#E6CFA0]">
                              <WifiOff className="w-3 h-3" />
                              <span>{t.khatmah.queuedSyncNote}</span>
                            </span>
                          </>
                        )}
                      </div>
                      <p className="text-sm font-medium text-[#14241E] dark:text-[#F2EFE9] tabular-nums">
                        {formatVerseRefLabel(log.start_verse_id, surahs, lang)} —{' '}
                        {formatVerseRefLabel(log.end_verse_id, surahs, lang)}
                      </p>
                    </div>

                    <span className="text-xs font-semibold tabular-nums text-[#52635C] dark:text-[#A3B8AF] shrink-0">
                      {verseCount} {t.khatmah.versesCountUnit}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* CREATE KHATMAH PLAN MODAL */}
      {createOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <form
            onSubmit={handleCreatePlan}
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#0C1F19] border border-[#E5DFD3] dark:border-[#1B3A2F] p-6 space-y-5 shadow-xl"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-lg font-semibold text-[#14241E] dark:text-[#F2EFE9]">
                {t.khatmah.createTitle}
              </h3>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                aria-label={t.common.close}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-[#52635C] hover:bg-[#FAF8F3] dark:hover:bg-[#112921]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#52635C] dark:text-[#A3B8AF]">
                {t.khatmah.durationLabel}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {([30, 60, 90] as KhatmahDurationDays[]).map((d) => {
                  const selected = durationDays === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDurationDays(d)}
                      className={`min-h-[60px] p-3 rounded-xl border text-left transition-colors ${
                        selected
                          ? 'border-[#064E3B] dark:border-[#34D399] bg-[#ECFDF5] dark:bg-[#112E24]'
                          : 'border-[#E5DFD3] dark:border-[#1B3A2F] bg-[#FAF8F3] dark:bg-[#071410]'
                      }`}
                    >
                      <p
                        className={`text-base font-bold tabular-nums ${
                          selected
                            ? 'text-[#064E3B] dark:text-[#34D399]'
                            : 'text-[#14241E] dark:text-[#F2EFE9]'
                        }`}
                      >
                        {d} {t.khatmah.daysUnit}
                      </p>
                      <p className="text-[11px] text-[#52635C] dark:text-[#8FA89E] tabular-nums">
                        ~{Math.round(6236 / d)} {t.khatmah.versesCountUnit}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="khatmah-plan-name"
                className="block text-xs font-semibold text-[#52635C] dark:text-[#A3B8AF]"
              >
                {t.khatmah.planNameLabel}
              </label>
              <input
                id="khatmah-plan-name"
                type="text"
                maxLength={80}
                value={planNameInput}
                onChange={(e) => setPlanNameInput(e.target.value)}
                placeholder={getDefaultPlanName(durationDays, lang)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#E5DFD3] dark:border-[#1B3A2F] bg-[#FAF8F3] dark:bg-[#071410] text-[#14241E] dark:text-[#F2EFE9] focus:outline-none focus:border-[#064E3B] dark:focus:border-[#34D399]"
              />
            </div>

            <div className="p-4 rounded-xl bg-[#FAF8F3] dark:bg-[#071410] border border-[#E5DFD3] dark:border-[#1B3A2F] grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-[#52635C] dark:text-[#8FA89E]">{t.khatmah.startDateLabel}</p>
                <p className="mt-1 font-semibold tabular-nums text-[#14241E] dark:text-[#F2EFE9]">
                  {formatShortDate(todayMogadishu, lang)}
                </p>
              </div>
              <div>
                <p className="text-[#52635C] dark:text-[#8FA89E]">{t.khatmah.targetEndDateLabel}</p>
                <p className="mt-1 font-semibold tabular-nums text-[#064E3B] dark:text-[#34D399]">
                  {formatShortDate(previewTargetEndDate, lang)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-medium text-[#52635C] dark:text-[#A3B8AF]"
              >
                {t.common.cancel}
              </button>
              <button
                type="submit"
                disabled={creatingPlan}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#064E3B] text-white dark:bg-[#10B981] dark:text-[#071410] text-xs font-semibold disabled:opacity-60"
              >
                {creatingPlan ? t.khatmah.creating : t.khatmah.confirmCreate}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CONFIRM DAILY COMPLETION MODAL */}
      {confirmCompleteDay && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#0C1F19] border border-[#E5DFD3] dark:border-[#1B3A2F] p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-lg font-semibold text-[#14241E] dark:text-[#F2EFE9]">
                {t.khatmah.confirmCompleteTitle}
              </h3>
              <button
                type="button"
                onClick={() => setConfirmCompleteDay(null)}
                aria-label={t.common.close}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-[#52635C]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-[#52635C] dark:text-[#A3B8AF]">
              {t.khatmah.confirmCompleteBody}
            </p>

            <div className="p-4 rounded-xl bg-[#FAF8F3] dark:bg-[#071410] border border-[#E5DFD3] dark:border-[#1B3A2F] space-y-1">
              <p className="text-xs font-semibold text-[#064E3B] dark:text-[#34D399] tabular-nums">
                {t.khatmah.dayPrefix} {confirmCompleteDay.day_number} ·{' '}
                {confirmCompleteDay.target_verses} {t.khatmah.versesCountUnit}
              </p>
              <p className="text-sm font-semibold text-[#14241E] dark:text-[#F2EFE9] tabular-nums">
                {formatVerseRefLabel(confirmCompleteDay.start_verse_id, surahs, lang)} —{' '}
                {formatVerseRefLabel(confirmCompleteDay.end_verse_id, surahs, lang)}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmCompleteDay(null)}
                className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-medium text-[#52635C] dark:text-[#A3B8AF]"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                disabled={loggingDay}
                onClick={() => void handleConfirmDayComplete()}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#064E3B] text-white dark:bg-[#10B981] dark:text-[#071410] text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-60"
              >
                <Check className="w-4 h-4" />
                <span>{t.khatmah.confirmCompleteAction}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM PAUSE PLAN MODAL */}
      {confirmPausePlan && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#0C1F19] border border-[#E5DFD3] dark:border-[#1B3A2F] p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-lg font-semibold text-[#14241E] dark:text-[#F2EFE9]">
                {t.khatmah.pauseBtn}
              </h3>
              <button
                type="button"
                onClick={() => setConfirmPausePlan(null)}
                aria-label={t.common.close}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-[#52635C]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-[#52635C] dark:text-[#A3B8AF]">
              {t.khatmah.pauseConfirmBody}
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmPausePlan(null)}
                className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-medium text-[#52635C] dark:text-[#A3B8AF]"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                disabled={updatingStatusPlanId === confirmPausePlan.id}
                onClick={() => void updatePlanStatus(confirmPausePlan, 'paused')}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#B48A3E] text-white dark:bg-[#D4AF6A] dark:text-[#071410] text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Pause className="w-3.5 h-3.5" />
                <span>{t.khatmah.pauseBtn}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
