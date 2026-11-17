import { supabase } from './supabase';

const DB_NAME = 'nuur_offline_db';
const DB_VERSION = 1;
const STORE_CACHE = 'cache';
const STORE_QUEUE = 'sync_queue';

export type SyncOpType =
  | 'reading_progress'
  | 'adhkar_progress'
  | 'tasbih_total'
  | 'tasbih_session'
  | 'daily_goal'
  | 'khatmah_plan_create'
  | 'khatmah_plan_status'
  | 'khatmah_reading_log';

export interface SyncQueueItem {
  dedupeKey: string;
  userId: string;
  type: SyncOpType;
  payload: Record<string, unknown>;
  updatedAt: string;
  attempts: number;
  lastError?: string | null;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_CACHE)) {
            db.createObjectStore(STORE_CACHE);
          }
          if (!db.objectStoreNames.contains(STORE_QUEUE)) {
            db.createObjectStore(STORE_QUEUE, { keyPath: 'dedupeKey' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return dbPromise;
}

const FALLBACK_CACHE_PREFIX = 'nuur_cache_v1_';
const FALLBACK_QUEUE_KEY = 'nuur_sync_queue_v1';

export async function getCachedValue<T>(key: string): Promise<T | null> {
  const db = await openDb();
  if (db) {
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_CACHE, 'readonly');
        const store = tx.objectStore(STORE_CACHE);
        const req = store.get(key);
        req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  try {
    const raw = localStorage.getItem(FALLBACK_CACHE_PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function setCachedValue<T>(key: string, value: T): Promise<void> {
  const db = await openDb();
  if (db) {
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_CACHE, 'readwrite');
        const store = tx.objectStore(STORE_CACHE);
        store.put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }
  try {
    localStorage.setItem(FALLBACK_CACHE_PREFIX + key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors in restricted environments
  }
}

export async function getQueuedOps(userId?: string): Promise<SyncQueueItem[]> {
  const db = await openDb();
  let items: SyncQueueItem[] = [];
  if (db) {
    items = await new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_QUEUE, 'readonly');
        const store = tx.objectStore(STORE_QUEUE);
        const req = store.getAll();
        req.onsuccess = () => resolve((req.result as SyncQueueItem[]) ?? []);
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  } else {
    try {
      const raw = localStorage.getItem(FALLBACK_QUEUE_KEY);
      items = raw ? (JSON.parse(raw) as SyncQueueItem[]) : [];
    } catch {
      items = [];
    }
  }

  const filtered = userId ? items.filter((item) => item.userId === userId) : items;
  return filtered.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
}

async function putQueuedOp(item: SyncQueueItem): Promise<void> {
  const db = await openDb();
  if (db) {
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_QUEUE, 'readwrite');
        tx.objectStore(STORE_QUEUE).put(item);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }
  try {
    const all = await getQueuedOps();
    const next = all.filter((i) => i.dedupeKey !== item.dedupeKey);
    next.push(item);
    localStorage.setItem(FALLBACK_QUEUE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors
  }
}

async function deleteQueuedOp(dedupeKey: string): Promise<void> {
  const db = await openDb();
  if (db) {
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_QUEUE, 'readwrite');
        tx.objectStore(STORE_QUEUE).delete(dedupeKey);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }
  try {
    const all = await getQueuedOps();
    const next = all.filter((i) => i.dedupeKey !== dedupeKey);
    localStorage.setItem(FALLBACK_QUEUE_KEY, JSON.stringify(next));
  } catch {
    // Ignore
  }
}

type QueueListener = () => void;
const listeners = new Set<QueueListener>();

export function subscribeSyncQueue(listener: QueueListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyQueueListeners() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // Ignore subscriber error
    }
  });
}

export async function enqueueSyncOp(
  userId: string,
  type: SyncOpType,
  dedupeKey: string,
  payload: Record<string, unknown>
): Promise<void> {
  const item: SyncQueueItem = {
    dedupeKey,
    userId,
    type,
    payload,
    updatedAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
  };
  await putQueuedOp(item);
  notifyQueueListeners();
}

export interface FlushResult {
  synced: number;
  remaining: number;
  lastError: string | null;
}

let activeFlushPromise: Promise<FlushResult> | null = null;

function getOpSyncPriority(op: SyncQueueItem, allOps: SyncQueueItem[]): number {
  if (op.type === 'khatmah_plan_status') {
    const status = String(op.payload.status ?? '');
    const planId = String(op.payload.plan_id ?? '');
    const hasPendingCreate = allOps.some(
      (candidate) => candidate.type === 'khatmah_plan_create' && candidate.payload.id === planId
    );
    // Pause/cancel pre-existing active plan before creating a new active plan
    if (!hasPendingCreate && (status === 'paused' || status === 'cancelled')) return 1;
    // Apply status updates on newly created plans or activations/completions after create & logs
    return 4;
  }
  if (op.type === 'khatmah_plan_create') return 2;
  if (op.type === 'khatmah_reading_log') return 3;
  return 5;
}

export async function flushSyncQueue(userId: string): Promise<FlushResult> {
  if (activeFlushPromise) {
    return activeFlushPromise;
  }

  activeFlushPromise = (async () => {
    const rawOps = await getQueuedOps(userId);
    if (rawOps.length === 0) {
      return { synced: 0, remaining: 0, lastError: null };
    }

    // Ensure plans synchronize before their associated reading logs (and pauses before new creations)
    const ops = [...rawOps].sort((a, b) => {
      const pDiff = getOpSyncPriority(a, rawOps) - getOpSyncPriority(b, rawOps);
      if (pDiff !== 0) return pDiff;
      return a.updatedAt.localeCompare(b.updatedAt);
    });

    let synced = 0;
    let lastError: string | null = null;

    for (const op of ops) {
      try {
        if (op.type === 'khatmah_plan_create') {
          const { id, name, duration_days, start_date, status } = op.payload as {
            id: string;
            name: string;
            duration_days: number;
            start_date: string;
            status: 'active' | 'paused' | 'completed' | 'cancelled';
          };

          const { data: existingPlan } = await supabase
            .from('quran_khatmah_plans')
            .select('id')
            .eq('id', id)
            .eq('user_id', userId)
            .maybeSingle();

          if (!existingPlan) {
            const { error } = await supabase.from('quran_khatmah_plans').insert({
              id,
              user_id: userId,
              name,
              duration_days,
              start_date,
              status: status ?? 'active',
            });
            if (error) {
              if ((error as { code?: string }).code === '23505') {
                const { data: byIdAfter } = await supabase
                  .from('quran_khatmah_plans')
                  .select('id')
                  .eq('id', id)
                  .eq('user_id', userId)
                  .maybeSingle();
                if (!byIdAfter) {
                  throw error;
                }
              } else {
                throw error;
              }
            }
          }
        } else if (op.type === 'khatmah_plan_status') {
          const { plan_id, status, completed_at, updated_at } = op.payload as {
            plan_id: string;
            status: 'active' | 'paused' | 'completed' | 'cancelled';
            completed_at: string | null;
            updated_at: string;
          };

          const { data: existing } = await supabase
            .from('quran_khatmah_plans')
            .select('id, updated_at')
            .eq('id', plan_id)
            .eq('user_id', userId)
            .maybeSingle();

          if (!existing) {
            // Plan does not exist on server (e.g., if creation hasn't succeeded yet); keep in queue if create exists
            const hasCreateQueued = ops.some(
              (candidate) =>
                candidate.type === 'khatmah_plan_create' && candidate.payload.id === plan_id
            );
            if (hasCreateQueued) {
              throw new Error('Waiting for Khatmah plan creation to sync first.');
            }
            await deleteQueuedOp(op.dedupeKey);
            synced += 1;
            continue;
          }

          if (existing.updated_at && existing.updated_at > updated_at) {
            await deleteQueuedOp(op.dedupeKey);
            synced += 1;
            continue;
          }

          const { error } = await supabase
            .from('quran_khatmah_plans')
            .update({
              status,
              completed_at: status === 'completed' ? completed_at ?? updated_at : null,
              updated_at,
            })
            .eq('id', plan_id)
            .eq('user_id', userId);
          if (error) throw error;
        } else if (op.type === 'khatmah_reading_log') {
          const { id, plan_id, reading_date, start_verse_id, end_verse_id, note } = op.payload as {
            id: string;
            plan_id: string;
            reading_date: string;
            start_verse_id: number;
            end_verse_id: number;
            note?: string | null;
          };

          const { data: existingLog } = await supabase
            .from('quran_khatmah_reading_logs')
            .select('id')
            .eq('plan_id', plan_id)
            .eq('user_id', userId)
            .eq('start_verse_id', start_verse_id)
            .eq('end_verse_id', end_verse_id)
            .maybeSingle();

          if (!existingLog) {
            const { error } = await supabase.from('quran_khatmah_reading_logs').insert({
              id,
              plan_id,
              user_id: userId,
              reading_date,
              start_verse_id,
              end_verse_id,
              note: note ?? null,
            });
            // Treat unique constraint 23505 as already synced to prevent duplicate synchronization
            if (error && (error as { code?: string }).code !== '23505') {
              throw error;
            }
          }
        } else if (op.type === 'reading_progress') {
          const { last_surah_id, last_verse_number, last_read_at } = op.payload as {
            last_surah_id: number;
            last_verse_number: number;
            last_read_at: string;
          };
          const { data: existing } = await supabase
            .from('quran_reading_progress')
            .select('last_read_at')
            .eq('user_id', userId)
            .maybeSingle();

          // Conflict resolution: preserve newer timestamp on server if server is ahead
          if (existing?.last_read_at && existing.last_read_at > last_read_at) {
            await deleteQueuedOp(op.dedupeKey);
            synced += 1;
            continue;
          }

          const { error } = await supabase.from('quran_reading_progress').upsert(
            {
              user_id: userId,
              last_surah_id,
              last_verse_number,
              last_read_at,
            },
            { onConflict: 'user_id' }
          );
          if (error) throw error;
        } else if (op.type === 'adhkar_progress') {
          const { adhkar_item_id, progress_date, count, updated_at } = op.payload as {
            adhkar_item_id: string;
            progress_date: string;
            count: number;
            updated_at: string;
          };
          const { data: existing } = await supabase
            .from('user_progress')
            .select('count, updated_at')
            .eq('user_id', userId)
            .eq('adhkar_item_id', adhkar_item_id)
            .eq('progress_date', progress_date)
            .maybeSingle();

          // Conflict resolution: keep whichever progress update is newer (or higher count if same timestamp)
          const resolvedCount =
            existing?.updated_at && existing.updated_at > updated_at
              ? existing.count
              : count;

          const { error } = await supabase.from('user_progress').upsert(
            {
              user_id: userId,
              adhkar_item_id,
              progress_date,
              count: resolvedCount,
              updated_at,
            },
            { onConflict: 'user_id,adhkar_item_id,progress_date' }
          );
          if (error) throw error;
        } else if (op.type === 'tasbih_total') {
          const { counter_id, total_count, updated_at } = op.payload as {
            counter_id: string;
            total_count: number;
            updated_at: string;
          };
          const { data: existing } = await supabase
            .from('tasbih_counters')
            .select('total_count')
            .eq('id', counter_id)
            .eq('user_id', userId)
            .maybeSingle();

          if (!existing) {
            // Counter was deleted remotely; drop stale total update safely
            await deleteQueuedOp(op.dedupeKey);
            synced += 1;
            continue;
          }

          const safeTotal = Math.max(existing.total_count ?? 0, total_count);
          const { error } = await supabase
            .from('tasbih_counters')
            .update({ total_count: safeTotal, updated_at })
            .eq('id', counter_id)
            .eq('user_id', userId);
          if (error) throw error;
        } else if (op.type === 'tasbih_session') {
          const { id, counter_id, dhikr_label, count, session_date } = op.payload as {
            id: string;
            counter_id: string;
            dhikr_label: string;
            count: number;
            session_date: string;
          };
          const { error } = await supabase
            .from('tasbih_sessions')
            .upsert(
              {
                id,
                user_id: userId,
                counter_id,
                dhikr_label,
                count,
                session_date,
              },
              { onConflict: 'id', ignoreDuplicates: true }
            );
          if (error) throw error;
        } else if (op.type === 'daily_goal') {
          const { goal_date, target_count, updated_at } = op.payload as {
            goal_date: string;
            target_count: number;
            updated_at: string;
          };
          const { data: existing } = await supabase
            .from('daily_goals')
            .select('updated_at')
            .eq('user_id', userId)
            .eq('goal_date', goal_date)
            .maybeSingle();

          if (existing?.updated_at && existing.updated_at > updated_at) {
            await deleteQueuedOp(op.dedupeKey);
            synced += 1;
            continue;
          }

          const { error } = await supabase.from('daily_goals').upsert(
            {
              user_id: userId,
              goal_date,
              target_count,
              updated_at,
            },
            { onConflict: 'user_id,goal_date' }
          );
          if (error) throw error;
        }

        await deleteQueuedOp(op.dedupeKey);
        synced += 1;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Sync failed';
        lastError = msg;
        await putQueuedOp({
          ...op,
          attempts: (op.attempts || 0) + 1,
          lastError: msg,
        });
      }
    }

    const remainingOps = await getQueuedOps(userId);
    notifyQueueListeners();
    return { synced, remaining: remainingOps.length, lastError };
  })().finally(() => {
    activeFlushPromise = null;
  });

  return activeFlushPromise;
}
