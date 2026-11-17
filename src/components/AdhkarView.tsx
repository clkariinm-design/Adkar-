import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Heart, RotateCcw, Check } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import {
  supabase,
  type AdhkarCategory,
  type AdhkarItem,
  type UserProgress,
} from '../lib/supabase';
import { getTodayDateString } from '../lib/i18n';

export function AdhkarView() {
  const { user, profile, lang, t, showToast } = useApp();

  const [categories, setCategories] = useState<AdhkarCategory[]>([]);
  const [items, setItems] = useState<AdhkarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedSlug, setSelectedSlug] = useState<string>('all');
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [progressRows, setProgressRows] = useState<Record<string, UserProgress>>({});
  const [localCounts, setLocalCounts] = useState<Record<string, number>>({});

  const tz = profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const todayStr = getTodayDateString(tz);

  const fetchAdhkar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [catsRes, itemsRes] = await Promise.all([
        supabase
          .from('adhkar_categories')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true }),
        supabase
          .from('adhkar_items')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true }),
      ]);

      if (catsRes.error) throw catsRes.error;
      if (itemsRes.error) throw itemsRes.error;

      setCategories(catsRes.data ?? []);
      setItems(itemsRes.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Adhkar');
    } finally {
      setLoading(false);
    }
  }, []);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchUserAdhkarState = useCallback(async () => {
    if (!user) return;
    const [favRes, progRes] = await Promise.all([
      supabase.from('favorites').select('adhkar_item_id').eq('user_id', user.id),
      supabase
        .from('user_progress')
        .select('id, user_id, adhkar_item_id, progress_date, count, updated_at')
        .eq('user_id', user.id)
        .eq('progress_date', todayStr),
    ]);

    if (!isMountedRef.current) return;
    if (!favRes.error && favRes.data) {
      setFavoriteIds(new Set(favRes.data.map((r) => r.adhkar_item_id)));
    }
    if (!progRes.error && progRes.data) {
      const byItem: Record<string, UserProgress> = {};
      const countMap: Record<string, number> = {};
      progRes.data.forEach((row) => {
        byItem[row.adhkar_item_id] = row;
        countMap[row.adhkar_item_id] = row.count;
      });
      setProgressRows(byItem);
      setLocalCounts(countMap);
    }
  }, [user, todayStr]);

  useEffect(() => {
    fetchAdhkar();
  }, [fetchAdhkar]);

  useEffect(() => {
    fetchUserAdhkarState();
  }, [fetchUserAdhkarState]);

  const categoryMap = useMemo(() => {
    const map = new Map<string, AdhkarCategory>();
    categories.forEach((c) => map.set(c.id, c));
    return map;
  }, [categories]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (favoritesOnly && !favoriteIds.has(item.id)) return false;
      if (selectedSlug === 'all') return true;
      const cat = categoryMap.get(item.category_id);
      return cat?.slug === selectedSlug;
    });
  }, [items, favoritesOnly, favoriteIds, selectedSlug, categoryMap]);

  const syncTimersRef = useRef<Record<string, number>>({});
  const pendingProgressRef = useRef<Record<string, number>>({});

  const flushProgressItem = useCallback(
    async (itemId: string, nextCount: number) => {
      if (!user) return;
      delete pendingProgressRef.current[itemId];
      const nowIso = new Date().toISOString();
      const { data, error: upsertErr } = await supabase
        .from('user_progress')
        .upsert(
          {
            user_id: user.id,
            adhkar_item_id: itemId,
            progress_date: todayStr,
            count: nextCount,
            updated_at: nowIso,
          },
          { onConflict: 'user_id,adhkar_item_id,progress_date' }
        )
        .select('*')
        .single();

      if (!isMountedRef.current) return;
      if (upsertErr) {
        showToast(upsertErr.message, 'error');
        return;
      }
      if (data) {
        setProgressRows((prev) => ({ ...prev, [itemId]: data }));
      }
    },
    [user, todayStr, showToast]
  );

  useEffect(() => {
    return () => {
      Object.entries(syncTimersRef.current).forEach(([itemId, timerId]) => {
        window.clearTimeout(timerId);
        delete syncTimersRef.current[itemId];
      });
      Object.entries(pendingProgressRef.current).forEach(([itemId, count]) => {
        void flushProgressItem(itemId, count);
      });
    };
  }, [flushProgressItem]);

  const persistProgress = (itemId: string, nextCount: number) => {
    if (!user) return;
    pendingProgressRef.current[itemId] = nextCount;
    if (syncTimersRef.current[itemId]) {
      window.clearTimeout(syncTimersRef.current[itemId]);
    }
    syncTimersRef.current[itemId] = window.setTimeout(() => {
      delete syncTimersRef.current[itemId];
      void flushProgressItem(itemId, nextCount);
    }, 250);
  };

  const handleTapCount = (item: AdhkarItem) => {
    const current = localCounts[item.id] ?? 0;
    const next = current + 1;
    setLocalCounts((prev) => ({ ...prev, [item.id]: next }));
    persistProgress(item.id, next);
  };

  const handleResetCount = (item: AdhkarItem) => {
    setLocalCounts((prev) => ({ ...prev, [item.id]: 0 }));
    persistProgress(item.id, 0);
  };

  const handleToggleFavorite = async (itemId: string) => {
    if (!user) return;
    const isFav = favoriteIds.has(itemId);
    try {
      if (isFav) {
        const { error: delErr } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('adhkar_item_id', itemId);
        if (delErr) throw delErr;
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          next.delete(itemId);
          return next;
        });
        showToast(t.adhkar.favoriteRemoved, 'info');
      } else {
        const { error: insErr } = await supabase
          .from('favorites')
          .insert({ user_id: user.id, adhkar_item_id: itemId });
        if (insErr) throw insErr;
        setFavoriteIds((prev) => new Set(prev).add(itemId));
        showToast(t.adhkar.favoriteAdded, 'success');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error updating favorite', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#14241E] dark:text-[#F2EFE9]">
            {t.adhkar.title}
          </h1>
          <p className="mt-1 text-sm text-[#52635C] dark:text-[#A3B8AF] max-w-2xl">
            {t.adhkar.subtitle}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setFavoritesOnly((v) => !v)}
          className={`self-start md:self-auto px-4 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap ${
            favoritesOnly
              ? 'bg-[#064E3B] text-white border-[#064E3B] dark:bg-[#10B981] dark:text-[#071410] dark:border-[#10B981]'
              : 'bg-white dark:bg-[#0C1F19] border-[#E5DFD3] dark:border-[#1B3A2F] text-[#14241E] dark:text-[#F2EFE9]'
          }`}
        >
          <Heart className={`w-3.5 h-3.5 ${favoritesOnly ? 'fill-current' : ''}`} />
          <span>{t.adhkar.favoritesOnly}</span>
          {favoriteIds.size > 0 && <span className="tabular-nums">({favoriteIds.size})</span>}
        </button>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setSelectedSlug('all')}
          className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 border ${
            selectedSlug === 'all'
              ? 'bg-[#064E3B] text-white border-[#064E3B] dark:bg-[#10B981] dark:text-[#071410] dark:border-[#10B981]'
              : 'bg-white dark:bg-[#0C1F19] text-[#52635C] dark:text-[#A3B8AF] border-[#E5DFD3] dark:border-[#1B3A2F] hover:text-[#14241E]'
          }`}
        >
          {t.adhkar.allCategories}
        </button>
        {categories.map((cat) => {
          const active = selectedSlug === cat.slug;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedSlug(cat.slug)}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 border ${
                active
                  ? 'bg-[#064E3B] text-white border-[#064E3B] dark:bg-[#10B981] dark:text-[#071410] dark:border-[#10B981]'
                  : 'bg-white dark:bg-[#0C1F19] text-[#52635C] dark:text-[#A3B8AF] border-[#E5DFD3] dark:border-[#1B3A2F] hover:text-[#14241E]'
              }`}
            >
              {lang === 'so' ? cat.name_so : cat.name_en}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-64 rounded-2xl bg-[#EFECE4] dark:bg-[#0C1F19] animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] dark:bg-[#2A1215] dark:border-[#7F1D1D] flex items-center justify-between gap-4">
          <p className="text-sm text-[#991B1B] dark:text-[#FCA5A5]">{error}</p>
          <button
            type="button"
            onClick={fetchAdhkar}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-[#991B1B] text-white"
          >
            {t.common.retry}
          </button>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-[#E5DFD3] dark:border-[#1B3A2F] bg-white dark:bg-[#0C1F19] p-10 text-center space-y-2">
          <p className="text-sm text-[#52635C] dark:text-[#A3B8AF]">
            {favoritesOnly ? t.adhkar.noFavorites : t.adhkar.noItemsInCategory}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
          {filteredItems.map((item) => {
            const cat = categoryMap.get(item.category_id);
            const current = localCounts[item.id] ?? 0;
            const target = Math.max(1, item.repeat_count || 1);
            const isComplete = current >= target;
            const pct = Math.min(100, Math.round((current / target) * 100));
            const isFav = favoriteIds.has(item.id);
            const translation =
              lang === 'en' && item.translation_en ? item.translation_en : item.translation_so;
            const virtue = lang === 'en' && item.virtue_en ? item.virtue_en : item.virtue_so;

            return (
              <article
                key={item.id}
                className="rounded-2xl border border-[#E5DFD3] dark:border-[#1B3A2F] bg-white dark:bg-[#0C1F19] p-6 flex flex-col justify-between gap-5"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-xs text-[#52635C] dark:text-[#8FA89E] flex flex-wrap items-center gap-1.5">
                      {cat && (
                        <span className="font-semibold text-[#064E3B] dark:text-[#34D399]">
                          {lang === 'so' ? cat.name_so : cat.name_en}
                        </span>
                      )}
                      {item.reference_text && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{item.reference_text}</span>
                        </>
                      )}
                      {item.source_grade && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="capitalize">{item.source_grade}</span>
                        </>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleFavorite(item.id)}
                      aria-label={t.common.favorites}
                      className={`min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg transition-colors ${
                        isFav
                          ? 'text-[#B48A3E] dark:text-[#D4AF6A] bg-[#FDF6E7] dark:bg-[#231D11]'
                          : 'text-[#52635C] dark:text-[#8FA89E] hover:bg-[#FAF8F3] dark:hover:bg-[#112921]'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                    </button>
                  </div>

                  <p
                    dir="rtl"
                    lang="ar"
                    className="font-arabic text-2xl sm:text-3xl leading-[2.15] text-right text-[#14241E] dark:text-[#F2EFE9]"
                  >
                    {item.content_ar}
                  </p>

                  <div className="space-y-2 pt-1">
                    {item.transliteration && (
                      <p className="text-xs font-medium text-[#7A6334] dark:text-[#D4AF6A]">
                        {item.transliteration}
                      </p>
                    )}
                    {translation && (
                      <p className="text-sm leading-relaxed text-[#2C3E37] dark:text-[#D6E2DC]">
                        {translation}
                      </p>
                    )}
                    {virtue && (
                      <p className="text-xs leading-relaxed text-[#52635C] dark:text-[#8FA89E] pt-1">
                        <span className="font-semibold text-[#14241E] dark:text-[#F2EFE9]">
                          {t.adhkar.virtue}:{' '}
                        </span>
                        {virtue}
                      </p>
                    )}
                    {item.source_url && (
                      <a
                        href={item.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#064E3B] dark:text-[#34D399] hover:underline pt-1"
                      >
                        <span>{t.adhkar.viewSource}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-[#EFECE4] dark:border-[#18352B] space-y-3">
                  <div className="h-1.5 w-full rounded-full bg-[#EFECE4] dark:bg-[#143328] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-200 ${
                        isComplete ? 'bg-[#B48A3E] dark:bg-[#D4AF6A]' : 'bg-[#064E3B] dark:bg-[#10B981]'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => handleTapCount(item)}
                      className={`flex-1 min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold transition-transform active:scale-[0.98] flex items-center justify-between ${
                        isComplete
                          ? 'bg-[#FDF6E7] dark:bg-[#231D11] text-[#7A6334] dark:text-[#D4AF6A] border border-[#E6CFA0] dark:border-[#5C4820]'
                          : 'bg-[#064E3B] text-white dark:bg-[#10B981] dark:text-[#071410]'
                      }`}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {isComplete && <Check className="w-4 h-4" />}
                        <span>{isComplete ? t.adhkar.completed : t.adhkar.tapToCount}</span>
                      </span>
                      <span className="tabular-nums font-bold">
                        {current} / {target}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleResetCount(item)}
                      aria-label={t.adhkar.resetCount}
                      title={t.adhkar.resetCount}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-[#E5DFD3] dark:border-[#1B3A2F] text-[#52635C] dark:text-[#A3B8AF] hover:text-[#14241E] dark:hover:text-[#F2EFE9]"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
