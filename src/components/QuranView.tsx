import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bookmark,
  BookmarkCheck,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Search,
  Check,
  ChevronDown,
  ChevronUp,
  Trash2,
  X,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import {
  supabase,
  type QuranBookmark,
  type QuranReadingProgress,
  type QuranSurah,
  type QuranVerse,
} from '../lib/supabase';

const VERSES_PER_PAGE = 20;

type QuranMode = 'surahs' | 'search' | 'bookmarks';
type ArabicScale = 'sm' | 'md' | 'lg' | 'xl';

const ARABIC_SIZE_CLASSES: Record<ArabicScale, string> = {
  sm: 'text-2xl leading-[2.1]',
  md: 'text-3xl leading-[2.25]',
  lg: 'text-4xl leading-[2.4]',
  xl: 'text-[2.65rem] leading-[2.5]',
};

function toArabicIndicDigits(num: number): string {
  const map = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(num)
    .split('')
    .map((d) => map[Number(d)] ?? d)
    .join('');
}

export function QuranView() {
  const { user, lang, t, targetVerse, openQuranAt, showToast, registerBackHandler } = useApp();

  const [mode, setMode] = useState<QuranMode>('surahs');
  const [surahs, setSurahs] = useState<QuranSurah[]>([]);
  const [surahsLoading, setSurahsLoading] = useState(true);
  const [surahsError, setSurahsError] = useState<string | null>(null);

  const [surahQuery, setSurahQuery] = useState('');
  const [placeFilter, setPlaceFilter] = useState<'all' | 'meccan' | 'medinan'>('all');

  const [selectedSurahId, setSelectedSurahId] = useState<number>(1);
  const [mobileReaderOpen, setMobileReaderOpen] = useState(false);

  const [page, setPage] = useState(1);
  const [verses, setVerses] = useState<QuranVerse[]>([]);
  const [versesLoading, setVersesLoading] = useState(false);
  const [versesError, setVersesError] = useState<string | null>(null);

  const [arabicScale, setArabicScale] = useState<ArabicScale>('md');
  const [expandedFootnotes, setExpandedFootnotes] = useState<Record<number, boolean>>({});

  // Progress & Bookmarks
  const [readingProgress, setReadingProgress] = useState<QuranReadingProgress | null>(null);
  const [userQuranLoaded, setUserQuranLoaded] = useState(false);
  const [bookmarks, setBookmarks] = useState<QuranBookmark[]>([]);
  const [bookmarksLoading, setBookmarksLoading] = useState(false);
  const [editingBookmarkVerse, setEditingBookmarkVerse] = useState<QuranVerse | null>(null);
  const [bookmarkNote, setBookmarkNote] = useState('');
  const [savingBookmark, setSavingBookmark] = useState(false);

  // Verse Search
  const [verseQuery, setVerseQuery] = useState('');
  const [searchResults, setSearchResults] = useState<QuranVerse[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const pendingScrollVerseRef = useRef<number | null>(null);
  const pendingAutoSaveRef = useRef<{ surahId: number; verseNumber: number } | null>(null);

  useEffect(() => {
    return registerBackHandler(() => {
      if (editingBookmarkVerse) {
        setEditingBookmarkVerse(null);
        return true;
      }
      if (mode !== 'surahs') {
        setMode('surahs');
        return true;
      }
      if (mobileReaderOpen) {
        setMobileReaderOpen(false);
        return true;
      }
      return false;
    });
  }, [registerBackHandler, editingBookmarkVerse, mode, mobileReaderOpen]);

  const fetchSurahs = useCallback(async () => {
    setSurahsLoading(true);
    setSurahsError(null);
    try {
      const { data, error } = await supabase
        .from('quran_surahs')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setSurahs(data ?? []);
    } catch (err) {
      setSurahsError(err instanceof Error ? err.message : 'Failed to load Surahs');
    } finally {
      setSurahsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSurahs();
  }, [fetchSurahs]);

  const fetchUserQuranData = useCallback(async () => {
    if (!user) return;
    setBookmarksLoading(true);
    try {
      const [progRes, bmRes] = await Promise.all([
        supabase
          .from('quran_reading_progress')
          .select('user_id, last_surah_id, last_verse_number, last_read_at')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('quran_bookmarks')
          .select(
            'user_id, verse_id, note, created_at, quran_verses(id, surah_id, verse_number, text_uthmani, sajda, quran_translations(id, verse_id, language_code, translation_text, translator, edition_version))'
          )
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
      ]);
      if (!progRes.error && progRes.data) {
        setReadingProgress(progRes.data);
      }
      if (!bmRes.error && bmRes.data) {
        setBookmarks(bmRes.data as unknown as QuranBookmark[]);
      }
    } finally {
      setBookmarksLoading(false);
      setUserQuranLoaded(true);
    }
  }, [user]);

  useEffect(() => {
    fetchUserQuranData();
  }, [fetchUserQuranData]);

  useEffect(() => {
    if (!targetVerse) return;
    const targetNum = targetVerse.verseNumber ?? 1;
    setMode('surahs');
    setSelectedSurahId(targetVerse.surahId);
    const targetPage = Math.max(1, Math.ceil(targetNum / VERSES_PER_PAGE));
    setPage(targetPage);
    pendingScrollVerseRef.current = targetNum;
    pendingAutoSaveRef.current = { surahId: targetVerse.surahId, verseNumber: targetNum };
    setMobileReaderOpen(true);
  }, [targetVerse]);

  const activeSurah = useMemo(
    () => surahs.find((s) => s.id === selectedSurahId) ?? null,
    [surahs, selectedSurahId]
  );

  const totalPages = useMemo(() => {
    if (!activeSurah) return 1;
    return Math.max(1, Math.ceil(activeSurah.verse_count / VERSES_PER_PAGE));
  }, [activeSurah]);

  const saveReadingProgress = useCallback(
    async (surahId: number, verseNumber: number, showFeedback = false) => {
      if (!user) return;
      const nowIso = new Date().toISOString();
      try {
        const { data, error } = await supabase
          .from('quran_reading_progress')
          .upsert(
            {
              user_id: user.id,
              last_surah_id: surahId,
              last_verse_number: verseNumber,
              last_read_at: nowIso,
            },
            { onConflict: 'user_id' }
          )
          .select('*')
          .single();
        if (error) throw error;
        setReadingProgress(data);
        if (showFeedback) {
          showToast(t.quran.lastReadSaved, 'success');
        }
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Error saving progress', 'error');
      }
    },
    [user, showToast, t.quran.lastReadSaved]
  );

  const fetchVerses = useCallback(async () => {
    setVersesLoading(true);
    setVersesError(null);
    const from = (page - 1) * VERSES_PER_PAGE;
    const to = from + VERSES_PER_PAGE - 1;

    try {
      const { data, error } = await supabase
        .from('quran_verses')
        .select(
          'id, surah_id, verse_number, text_uthmani, text_simple, juz_number, hizb_number, page_number, sajda, quran_translations(id, verse_id, language_code, translator, translation_text, source_name, edition_version, footnotes)'
        )
        .eq('surah_id', selectedSurahId)
        .order('verse_number', { ascending: true })
        .range(from, to);

      if (error) throw error;
      const loaded = (data as unknown as QuranVerse[]) ?? [];
      setVerses(loaded);

      if (pendingScrollVerseRef.current !== null) {
        const targetNum = pendingScrollVerseRef.current;
        pendingScrollVerseRef.current = null;
        window.requestAnimationFrame(() => {
          const el = document.getElementById(`verse-${selectedSurahId}-${targetNum}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        });
      }
    } catch (err) {
      setVersesError(err instanceof Error ? err.message : 'Failed to load verses');
    } finally {
      setVersesLoading(false);
    }
  }, [selectedSurahId, page]);

  useEffect(() => {
    if (mode === 'surahs') {
      fetchVerses();
    }
  }, [fetchVerses, mode]);

  const lastAutoSavedRef = useRef<string>('');
  useEffect(() => {
    if (!user || !userQuranLoaded || mode !== 'surahs' || verses.length === 0) return;

    const intended = pendingAutoSaveRef.current;
    // Wait for explicit user navigation unless user has no reading progress yet
    if (!intended && readingProgress) {
      return;
    }

    const saveSurahId = intended ? intended.surahId : verses[0].surah_id;
    const saveVerseNum = intended ? intended.verseNumber : verses[0].verse_number;
    if (verses[0].surah_id !== saveSurahId) return;

    const key = `${saveSurahId}:${saveVerseNum}`;
    if (lastAutoSavedRef.current === key) {
      pendingAutoSaveRef.current = null;
      return;
    }

    pendingAutoSaveRef.current = null;
    lastAutoSavedRef.current = key;

    // Do not overwrite if already at this exact position
    if (
      readingProgress &&
      readingProgress.last_surah_id === saveSurahId &&
      readingProgress.last_verse_number === saveVerseNum
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      saveReadingProgress(saveSurahId, saveVerseNum, false);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [user, userQuranLoaded, mode, verses, readingProgress, saveReadingProgress]);

  const handleSelectSurah = (surahId: number, targetVerseNum = 1) => {
    setSelectedSurahId(surahId);
    const nextPage = Math.max(1, Math.ceil(targetVerseNum / VERSES_PER_PAGE));
    setPage(nextPage);
    pendingScrollVerseRef.current = targetVerseNum;
    pendingAutoSaveRef.current = { surahId, verseNumber: targetVerseNum };
    setMobileReaderOpen(true);
    setMode('surahs');
  };

  const filteredSurahs = useMemo(() => {
    const q = surahQuery.trim().toLowerCase();
    return surahs.filter((s) => {
      if (placeFilter !== 'all' && s.revelation_place !== placeFilter) return false;
      if (!q) return true;
      return (
        String(s.id) === q ||
        s.name_so.toLowerCase().includes(q) ||
        s.name_en.toLowerCase().includes(q) ||
        s.transliteration.toLowerCase().includes(q) ||
        s.name_ar.includes(q)
      );
    });
  }, [surahs, surahQuery, placeFilter]);

  const bookmarkedMap = useMemo(() => {
    const map = new Map<number, QuranBookmark>();
    bookmarks.forEach((b) => map.set(b.verse_id, b));
    return map;
  }, [bookmarks]);

  const openBookmarkEditor = (verse: QuranVerse) => {
    const existing = bookmarkedMap.get(verse.id);
    setEditingBookmarkVerse(verse);
    setBookmarkNote(existing?.note ?? '');
  };

  const handleSaveBookmark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingBookmarkVerse) return;
    setSavingBookmark(true);
    try {
      const { error } = await supabase.from('quran_bookmarks').upsert(
        {
          user_id: user.id,
          verse_id: editingBookmarkVerse.id,
          note: bookmarkNote.trim() || null,
        },
        { onConflict: 'user_id,verse_id' }
      );
      if (error) throw error;
      await fetchUserQuranData();
      setEditingBookmarkVerse(null);
      showToast(t.quran.bookmarkAdded, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error saving bookmark', 'error');
    } finally {
      setSavingBookmark(false);
    }
  };

  const handleRemoveBookmark = async (verseId: number) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('quran_bookmarks')
        .delete()
        .eq('user_id', user.id)
        .eq('verse_id', verseId);
      if (error) throw error;
      setBookmarks((prev) => prev.filter((b) => b.verse_id !== verseId));
      if (editingBookmarkVerse?.id === verseId) {
        setEditingBookmarkVerse(null);
      }
      showToast(t.quran.bookmarkRemoved, 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error removing bookmark', 'error');
    }
  };

  const handleVerseSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = verseQuery.trim();
    if (q.length < 2) return;
    setSearchLoading(true);
    setSearchError(null);
    setHasSearched(true);

    try {
      const [transMatches, arUthmaniMatches, arSimpleMatches] = await Promise.all([
        supabase
          .from('quran_translations')
          .select('verse_id')
          .ilike('translation_text', `%${q}%`)
          .limit(20),
        supabase
          .from('quran_verses')
          .select('id')
          .ilike('text_uthmani', `%${q}%`)
          .limit(20),
        supabase
          .from('quran_verses')
          .select('id')
          .ilike('text_simple', `%${q}%`)
          .limit(20),
      ]);

      if (transMatches.error) throw transMatches.error;
      if (arUthmaniMatches.error) throw arUthmaniMatches.error;
      if (arSimpleMatches.error) throw arSimpleMatches.error;

      const verseIds = Array.from(
        new Set([
          ...(transMatches.data ?? []).map((r) => r.verse_id),
          ...(arUthmaniMatches.data ?? []).map((r) => r.id),
          ...(arSimpleMatches.data ?? []).map((r) => r.id),
        ])
      ).slice(0, 25);

      if (verseIds.length === 0) {
        setSearchResults([]);
        setSearchLoading(false);
        return;
      }

      const { data: fullVerses, error: fullErr } = await supabase
        .from('quran_verses')
        .select(
          'id, surah_id, verse_number, text_uthmani, sajda, quran_translations(id, verse_id, language_code, translator, translation_text, edition_version)'
        )
        .in('id', verseIds)
        .order('id', { ascending: true });

      if (fullErr) throw fullErr;
      setSearchResults((fullVerses as unknown as QuranVerse[]) ?? []);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearchLoading(false);
    }
  };

  const surahById = useMemo(() => {
    const map = new Map<number, QuranSurah>();
    surahs.forEach((s) => map.set(s.id, s));
    return map;
  }, [surahs]);

  const progressSurah = readingProgress ? surahById.get(readingProgress.last_surah_id) : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#14241E] dark:text-[#F2EFE9]">
            {t.quran.title}
          </h1>
          <p className="mt-1 text-xs text-[#52635C] dark:text-[#8FA89E]">
            {t.quran.attributionLabel}: Abdullah Hasan Yaqoub · QuranEnc.com v1.0.27
          </p>
        </div>

        <div className="flex items-center p-1 rounded-xl bg-[#EFECE4] dark:bg-[#0C1F19] border border-[#E5DFD3] dark:border-[#1B3A2F] self-start md:self-auto">
          <button
            type="button"
            onClick={() => setMode('surahs')}
            className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              mode === 'surahs'
                ? 'bg-white dark:bg-[#143328] text-[#064E3B] dark:text-[#F2EFE9] shadow-xs'
                : 'text-[#52635C] dark:text-[#8FA89E] hover:text-[#14241E]'
            }`}
          >
            {t.quran.modeSurahs}
          </button>
          <button
            type="button"
            onClick={() => setMode('search')}
            className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              mode === 'search'
                ? 'bg-white dark:bg-[#143328] text-[#064E3B] dark:text-[#F2EFE9] shadow-xs'
                : 'text-[#52635C] dark:text-[#8FA89E] hover:text-[#14241E]'
            }`}
          >
            {t.quran.modeVerseSearch}
          </button>
          <button
            type="button"
            onClick={() => setMode('bookmarks')}
            className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              mode === 'bookmarks'
                ? 'bg-white dark:bg-[#143328] text-[#064E3B] dark:text-[#F2EFE9] shadow-xs'
                : 'text-[#52635C] dark:text-[#8FA89E] hover:text-[#14241E]'
            }`}
          >
            {t.quran.modeBookmarks}
            {bookmarks.length > 0 ? ` (${bookmarks.length})` : ''}
          </button>
        </div>
      </div>

      {readingProgress && progressSurah && (
        <div className="rounded-xl border border-[#D8CEB8] dark:border-[#244A3C] bg-[#F5F1E6] dark:bg-[#0C1F19] px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-sm">
            <BookOpen className="w-4 h-4 text-[#B48A3E] dark:text-[#D4AF6A] shrink-0" />
            <span className="text-[#52635C] dark:text-[#A3B8AF]">{t.quran.resumeBanner}:</span>
            <span className="font-semibold text-[#14241E] dark:text-[#F2EFE9] tabular-nums">
              {lang === 'so' ? progressSurah.name_so : progressSurah.name_en} ({progressSurah.id}:
              {readingProgress.last_verse_number})
            </span>
          </div>
          <button
            type="button"
            onClick={() => openQuranAt(readingProgress.last_surah_id, readingProgress.last_verse_number)}
            className="px-3.5 py-1.5 rounded-lg bg-[#064E3B] text-white dark:bg-[#10B981] dark:text-[#071410] text-xs font-semibold hover:opacity-95 whitespace-nowrap"
          >
            {t.quran.continueFrom} {progressSurah.id}:{readingProgress.last_verse_number}
          </button>
        </div>
      )}

      {mode === 'surahs' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <aside
            className={`lg:col-span-4 rounded-2xl border border-[#E5DFD3] dark:border-[#1B3A2F] bg-white dark:bg-[#0C1F19] overflow-hidden ${
              mobileReaderOpen ? 'hidden lg:block' : 'block'
            }`}
          >
            <div className="p-4 border-b border-[#EFECE4] dark:border-[#18352B] space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-[#52635C] dark:text-[#8FA89E] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={surahQuery}
                  onChange={(e) => setSurahQuery(e.target.value)}
                  placeholder={t.quran.searchSurahsPlaceholder}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[#E5DFD3] dark:border-[#1B3A2F] bg-[#FAF8F3] dark:bg-[#071410] text-[#14241E] dark:text-[#F2EFE9] placeholder:text-[#7D8C86] focus:outline-none focus:border-[#064E3B] dark:focus:border-[#34D399]"
                />
              </div>

              <div className="flex items-center gap-1 p-1 rounded-lg bg-[#FAF8F3] dark:bg-[#071410] border border-[#EFECE4] dark:border-[#18352B]">
                {(['all', 'meccan', 'medinan'] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setPlaceFilter(filter)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      placeFilter === filter
                        ? 'bg-white dark:bg-[#143328] text-[#064E3B] dark:text-[#F2EFE9] shadow-xs'
                        : 'text-[#52635C] dark:text-[#8FA89E]'
                    }`}
                  >
                    {filter === 'all' ? t.common.all : filter === 'meccan' ? t.quran.meccan : t.quran.medinan}
                  </button>
                ))}
              </div>
            </div>

            {surahsLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 8 }).map((_, idx) => (
                  <div key={idx} className="h-14 rounded-xl bg-[#EFECE4] dark:bg-[#112921] animate-pulse" />
                ))}
              </div>
            ) : surahsError ? (
              <div className="p-6 text-center space-y-3">
                <p className="text-sm text-[#991B1B] dark:text-[#FCA5A5]">{surahsError}</p>
                <button
                  type="button"
                  onClick={fetchSurahs}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-[#064E3B] text-white"
                >
                  {t.common.retry}
                </button>
              </div>
            ) : (
              <div className="max-h-[68vh] overflow-y-auto divide-y divide-[#EFECE4] dark:divide-[#18352B]">
                {filteredSurahs.map((surah) => {
                  const isSelected = surah.id === selectedSurahId;
                  return (
                    <button
                      key={surah.id}
                      type="button"
                      onClick={() => handleSelectSurah(surah.id, 1)}
                      className={`w-full text-left px-4 py-3.5 min-h-[56px] flex items-center justify-between gap-3 transition-colors ${
                        isSelected
                          ? 'bg-[#ECFDF5] dark:bg-[#112E24]'
                          : 'hover:bg-[#FAF8F3] dark:hover:bg-[#112921]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold tabular-nums shrink-0 ${
                            isSelected
                              ? 'bg-[#064E3B] text-white dark:bg-[#10B981] dark:text-[#071410]'
                              : 'bg-[#F4F1EA] dark:bg-[#143328] text-[#52635C] dark:text-[#A3B8AF]'
                          }`}
                        >
                          {surah.id}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#14241E] dark:text-[#F2EFE9] truncate">
                            {lang === 'so' ? surah.name_so : surah.name_en}
                          </p>
                          <p className="text-xs text-[#52635C] dark:text-[#8FA89E] truncate">
                            {surah.revelation_place === 'meccan' ? t.quran.meccan : t.quran.medinan} ·{' '}
                            <span className="tabular-nums">{surah.verse_count}</span> {t.quran.versesLabel}
                          </p>
                        </div>
                      </div>
                      <span
                        dir="rtl"
                        lang="ar"
                        className="font-arabic text-xl text-[#064E3B] dark:text-[#D4AF6A] shrink-0"
                      >
                        {surah.name_ar}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          <section
            className={`lg:col-span-8 rounded-2xl border border-[#E5DFD3] dark:border-[#1B3A2F] bg-white dark:bg-[#0C1F19] overflow-hidden ${
              mobileReaderOpen ? 'block' : 'hidden lg:block'
            }`}
          >
            <div className="p-4 sm:px-6 border-b border-[#EFECE4] dark:border-[#18352B] flex flex-wrap items-center justify-between gap-3 bg-[#FAF8F3]/70 dark:bg-[#091A14]">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMobileReaderOpen(false)}
                  className="lg:hidden min-h-[40px] px-2.5 rounded-lg border border-[#E5DFD3] dark:border-[#1B3A2F] text-xs font-medium inline-flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>{t.quran.modeSurahs}</span>
                </button>
                {activeSurah && (
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-display text-lg sm:text-xl font-semibold text-[#14241E] dark:text-[#F2EFE9]">
                        {activeSurah.id}. {lang === 'so' ? activeSurah.name_so : activeSurah.name_en}
                      </h2>
                      <span
                        dir="rtl"
                        lang="ar"
                        className="font-arabic text-2xl text-[#064E3B] dark:text-[#D4AF6A]"
                      >
                        {activeSurah.name_ar}
                      </span>
                    </div>
                    <p className="text-xs text-[#52635C] dark:text-[#8FA89E]">
                      {activeSurah.transliteration} ·{' '}
                      {activeSurah.revelation_place === 'meccan' ? t.quran.meccan : t.quran.medinan} ·{' '}
                      <span className="tabular-nums">{activeSurah.verse_count}</span> {t.quran.versesLabel}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center p-0.5 rounded-lg bg-[#EFECE4] dark:bg-[#112921] border border-[#E5DFD3] dark:border-[#1B3A2F]">
                  {(['sm', 'md', 'lg', 'xl'] as ArabicScale[]).map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setArabicScale(sz)}
                      className={`px-2 py-1 text-[11px] font-semibold uppercase rounded-md transition-colors ${
                        arabicScale === sz
                          ? 'bg-white dark:bg-[#1B4234] text-[#064E3B] dark:text-[#F2EFE9]'
                          : 'text-[#52635C] dark:text-[#8FA89E]'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={selectedSurahId <= 1}
                    onClick={() => handleSelectSurah(selectedSurahId - 1, 1)}
                    aria-label={t.common.previous}
                    className="p-2 rounded-lg border border-[#E5DFD3] dark:border-[#1B3A2F] disabled:opacity-40 hover:bg-[#FAF8F3] dark:hover:bg-[#112921]"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={selectedSurahId >= 114}
                    onClick={() => handleSelectSurah(selectedSurahId + 1, 1)}
                    aria-label={t.common.next}
                    className="p-2 rounded-lg border border-[#E5DFD3] dark:border-[#1B3A2F] disabled:opacity-40 hover:bg-[#FAF8F3] dark:hover:bg-[#112921]"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {page === 1 && selectedSurahId !== 1 && selectedSurahId !== 9 && (
              <div className="py-5 px-6 text-center border-b border-[#EFECE4] dark:border-[#18352B] bg-[#FAF8F3]/50 dark:bg-[#0A1C16]">
                <p dir="rtl" lang="ar" className="font-arabic text-3xl text-[#064E3B] dark:text-[#D4AF6A]">
                  بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
                </p>
              </div>
            )}

            {versesLoading ? (
              <div className="p-6 space-y-6">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="space-y-3 animate-pulse">
                    <div className="h-8 bg-[#EFECE4] dark:bg-[#112921] rounded w-5/6 ml-auto" />
                    <div className="h-4 bg-[#EFECE4] dark:bg-[#112921] rounded w-2/3" />
                  </div>
                ))}
              </div>
            ) : versesError ? (
              <div className="p-8 text-center space-y-3">
                <p className="text-sm text-[#991B1B] dark:text-[#FCA5A5]">{versesError}</p>
                <button
                  type="button"
                  onClick={fetchVerses}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-[#064E3B] text-white"
                >
                  {t.common.retry}
                </button>
              </div>
            ) : (
              <div className="divide-y divide-[#EFECE4] dark:divide-[#18352B]">
                {verses.map((verse) => {
                  const translation =
                    verse.quran_translations?.find((tr) => tr.language_code === 'so') ??
                    verse.quran_translations?.[0];
                  const isBookmarked = bookmarkedMap.has(verse.id);
                  const isLastRead =
                    readingProgress?.last_surah_id === verse.surah_id &&
                    readingProgress?.last_verse_number === verse.verse_number;
                  const showFootnote = !!expandedFootnotes[verse.id];

                  return (
                    <article
                      key={verse.id}
                      id={`verse-${verse.surah_id}-${verse.verse_number}`}
                      className={`p-5 sm:p-6 transition-colors ${
                        isLastRead ? 'bg-[#F5F9F6] dark:bg-[#0F261E]' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4 mb-4">
                        <div className="flex items-center gap-2 text-xs font-medium text-[#52635C] dark:text-[#8FA89E] tabular-nums">
                          <span className="font-semibold text-[#064E3B] dark:text-[#34D399]">
                            {verse.surah_id}:{verse.verse_number}
                          </span>
                          {verse.juz_number && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>Juz {verse.juz_number}</span>
                            </>
                          )}
                          {verse.sajda && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-[#B48A3E] dark:text-[#D4AF6A]">{t.quran.sajdaLabel}</span>
                            </>
                          )}
                          {isLastRead && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-[#064E3B] dark:text-[#34D399]">{t.quran.resumeBanner}</span>
                            </>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => saveReadingProgress(verse.surah_id, verse.verse_number, true)}
                            title={t.quran.markLastRead}
                            className={`min-h-[36px] px-2.5 rounded-lg text-xs font-medium inline-flex items-center gap-1 transition-colors ${
                              isLastRead
                                ? 'text-[#064E3B] dark:text-[#34D399] bg-[#ECFDF5] dark:bg-[#143328]'
                                : 'text-[#52635C] dark:text-[#8FA89E] hover:bg-[#FAF8F3] dark:hover:bg-[#112921]'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{t.quran.markLastRead}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => openBookmarkEditor(verse)}
                            aria-label={t.quran.saveBookmark}
                            className={`min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg transition-colors ${
                              isBookmarked
                                ? 'text-[#B48A3E] dark:text-[#D4AF6A] bg-[#FDF6E7] dark:bg-[#231D11]'
                                : 'text-[#52635C] dark:text-[#8FA89E] hover:bg-[#FAF8F3] dark:hover:bg-[#112921]'
                            }`}
                          >
                            {isBookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <p
                        dir="rtl"
                        lang="ar"
                        className={`font-arabic text-right text-[#14241E] dark:text-[#F2EFE9] ${ARABIC_SIZE_CLASSES[arabicScale]}`}
                      >
                        {verse.text_uthmani}{' '}
                        <span className="inline-block text-[#B48A3E] dark:text-[#D4AF6A] text-[0.75em] mx-1 select-none">
                          ﴿{toArabicIndicDigits(verse.verse_number)}﴾
                        </span>
                      </p>

                      {translation && (
                        <div className="mt-4 space-y-2">
                          <p className="text-[15px] sm:text-base leading-relaxed text-[#2C3E37] dark:text-[#D6E2DC]">
                            {translation.translation_text}
                          </p>

                          {translation.footnotes && (
                            <div>
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedFootnotes((prev) => ({
                                    ...prev,
                                    [verse.id]: !prev[verse.id],
                                  }))
                                }
                                className="inline-flex items-center gap-1 text-xs font-medium text-[#064E3B] dark:text-[#34D399] hover:underline"
                              >
                                {showFootnote ? (
                                  <>
                                    <ChevronUp className="w-3.5 h-3.5" />
                                    <span>{t.quran.hideFootnotes}</span>
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="w-3.5 h-3.5" />
                                    <span>{t.quran.footnotes}</span>
                                  </>
                                )}
                              </button>
                              {showFootnote && (
                                <div className="mt-2 p-3.5 rounded-xl bg-[#FAF8F3] dark:bg-[#071410] border border-[#E5DFD3] dark:border-[#18352B] text-xs leading-relaxed text-[#52635C] dark:text-[#A3B8AF] whitespace-pre-line">
                                  {translation.footnotes}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}

            {totalPages > 1 && (
              <div className="p-4 sm:px-6 border-t border-[#EFECE4] dark:border-[#18352B] flex items-center justify-between gap-4 bg-[#FAF8F3]/60 dark:bg-[#091A14]">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => {
                    const nextPage = Math.max(1, page - 1);
                    pendingAutoSaveRef.current = {
                      surahId: selectedSurahId,
                      verseNumber: (nextPage - 1) * VERSES_PER_PAGE + 1,
                    };
                    setPage(nextPage);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="px-3.5 py-2 rounded-lg border border-[#E5DFD3] dark:border-[#1B3A2F] text-xs font-medium disabled:opacity-40 inline-flex items-center gap-1.5 hover:bg-white dark:hover:bg-[#112921]"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>{t.common.previous}</span>
                </button>

                <span className="text-xs font-medium tabular-nums text-[#52635C] dark:text-[#A3B8AF]">
                  {t.quran.pageLabel} {page} {t.common.of} {totalPages}
                </span>

                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => {
                    const nextPage = Math.min(totalPages, page + 1);
                    pendingAutoSaveRef.current = {
                      surahId: selectedSurahId,
                      verseNumber: (nextPage - 1) * VERSES_PER_PAGE + 1,
                    };
                    setPage(nextPage);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="px-3.5 py-2 rounded-lg border border-[#E5DFD3] dark:border-[#1B3A2F] text-xs font-medium disabled:opacity-40 inline-flex items-center gap-1.5 hover:bg-white dark:hover:bg-[#112921]"
                >
                  <span>{t.common.next}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      {mode === 'search' && (
        <section className="rounded-2xl border border-[#E5DFD3] dark:border-[#1B3A2F] bg-white dark:bg-[#0C1F19] p-5 sm:p-6 space-y-6">
          <form onSubmit={handleVerseSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#52635C] dark:text-[#8FA89E] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={verseQuery}
                onChange={(e) => setVerseQuery(e.target.value)}
                placeholder={t.quran.searchVersesPlaceholder}
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-[#E5DFD3] dark:border-[#1B3A2F] bg-[#FAF8F3] dark:bg-[#071410] text-[#14241E] dark:text-[#F2EFE9] focus:outline-none focus:border-[#064E3B] dark:focus:border-[#34D399]"
              />
            </div>
            <button
              type="submit"
              disabled={searchLoading || verseQuery.trim().length < 2}
              className="px-5 py-2.5 rounded-xl bg-[#064E3B] text-white dark:bg-[#10B981] dark:text-[#071410] text-sm font-medium disabled:opacity-50 whitespace-nowrap"
            >
              {searchLoading ? t.common.loading : t.common.search}
            </button>
          </form>

          {searchError && <p className="text-sm text-[#991B1B] dark:text-[#FCA5A5]">{searchError}</p>}

          {!hasSearched ? (
            <p className="text-sm text-[#52635C] dark:text-[#A3B8AF]">{t.quran.searchHint}</p>
          ) : searchLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="h-24 rounded-xl bg-[#EFECE4] dark:bg-[#112921] animate-pulse" />
              ))}
            </div>
          ) : searchResults.length === 0 ? (
            <p className="text-sm text-[#52635C] dark:text-[#A3B8AF]">{t.quran.noSearchResults}</p>
          ) : (
            <div className="divide-y divide-[#EFECE4] dark:divide-[#18352B]">
              {searchResults.map((v) => {
                const s = surahById.get(v.surah_id);
                const tr =
                  v.quran_translations?.find((item) => item.language_code === 'so') ??
                  v.quran_translations?.[0];
                return (
                  <div key={v.id} className="py-5 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-[#064E3B] dark:text-[#34D399] tabular-nums">
                        {s ? (lang === 'so' ? s.name_so : s.name_en) : `Surah ${v.surah_id}`} · {v.surah_id}:
                        {v.verse_number}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleSelectSurah(v.surah_id, v.verse_number)}
                        className="text-xs font-medium text-[#B48A3E] dark:text-[#D4AF6A] hover:underline"
                      >
                        {t.quran.continueFrom} {v.surah_id}:{v.verse_number}
                      </button>
                    </div>
                    <p dir="rtl" lang="ar" className="font-arabic text-2xl leading-[2] text-[#14241E] dark:text-[#F2EFE9]">
                      {v.text_uthmani}
                    </p>
                    {tr?.translation_text && (
                      <p className="text-sm text-[#52635C] dark:text-[#D6E2DC]">
                        {tr.translation_text}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {mode === 'bookmarks' && (
        <section className="rounded-2xl border border-[#E5DFD3] dark:border-[#1B3A2F] bg-white dark:bg-[#0C1F19] p-5 sm:p-6">
          {bookmarksLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="h-24 rounded-xl bg-[#EFECE4] dark:bg-[#112921] animate-pulse" />
              ))}
            </div>
          ) : bookmarks.length === 0 ? (
            <div className="py-8 text-center space-y-2 max-w-md mx-auto">
              <Bookmark className="w-8 h-8 mx-auto text-[#B48A3E] dark:text-[#D4AF6A]" />
              <h2 className="font-display text-lg font-semibold">{t.quran.noBookmarks}</h2>
              <p className="text-sm text-[#52635C] dark:text-[#A3B8AF]">{t.quran.noBookmarksDesc}</p>
            </div>
          ) : (
            <div className="divide-y divide-[#EFECE4] dark:divide-[#18352B]">
              {bookmarks.map((bm) => {
                const v = bm.quran_verses;
                const s = v ? surahById.get(v.surah_id) : undefined;
                return (
                  <div key={bm.verse_id} className="py-5 space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <button
                        type="button"
                        onClick={() => v && handleSelectSurah(v.surah_id, v.verse_number)}
                        className="text-sm font-semibold text-[#064E3B] dark:text-[#34D399] hover:underline tabular-nums"
                      >
                        {s ? (lang === 'so' ? s.name_so : s.name_en) : ''} ·{' '}
                        {v ? `${v.surah_id}:${v.verse_number}` : bm.verse_id}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveBookmark(bm.verse_id)}
                        aria-label={t.quran.removeBookmark}
                        className="p-2 text-[#52635C] hover:text-[#991B1B] dark:text-[#8FA89E] dark:hover:text-[#FCA5A5] rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {v && (() => {
                      const tr =
                        v.quran_translations?.find((item) => item.language_code === 'so') ??
                        v.quran_translations?.[0];
                      return (
                        <>
                          <p
                            dir="rtl"
                            lang="ar"
                            className="font-arabic text-2xl leading-[2] text-[#14241E] dark:text-[#F2EFE9]"
                          >
                            {v.text_uthmani}
                          </p>
                          {tr?.translation_text && (
                            <p className="text-sm text-[#52635C] dark:text-[#D6E2DC]">
                              {tr.translation_text}
                            </p>
                          )}
                        </>
                      );
                    })()}
                    {bm.note && (
                      <p className="text-xs italic text-[#7A6334] dark:text-[#D4AF6A]">{bm.note}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {editingBookmarkVerse && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <form
            onSubmit={handleSaveBookmark}
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#0C1F19] border border-[#E5DFD3] dark:border-[#1B3A2F] p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-[#14241E] dark:text-[#F2EFE9] tabular-nums">
                {t.quran.saveBookmark} ({editingBookmarkVerse.surah_id}:{editingBookmarkVerse.verse_number})
              </h3>
              <button
                type="button"
                onClick={() => setEditingBookmarkVerse(null)}
                aria-label={t.common.close}
                className="p-1.5 rounded-lg text-[#52635C] hover:bg-[#FAF8F3] dark:hover:bg-[#112921]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <textarea
              rows={3}
              value={bookmarkNote}
              onChange={(e) => setBookmarkNote(e.target.value)}
              placeholder={t.quran.addNotePlaceholder}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#E5DFD3] dark:border-[#1B3A2F] bg-[#FAF8F3] dark:bg-[#071410] text-[#14241E] dark:text-[#F2EFE9] focus:outline-none focus:border-[#064E3B]"
            />

            <div className="flex items-center justify-between gap-3 pt-1">
              {bookmarkedMap.has(editingBookmarkVerse.id) ? (
                <button
                  type="button"
                  onClick={() => handleRemoveBookmark(editingBookmarkVerse.id)}
                  className="px-3.5 py-2 rounded-xl text-xs font-medium text-[#991B1B] dark:text-[#FCA5A5] hover:bg-[#FEF2F2] dark:hover:bg-[#2A1215]"
                >
                  {t.quran.removeBookmark}
                </button>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingBookmarkVerse(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-[#52635C] dark:text-[#A3B8AF]"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={savingBookmark}
                  className="px-4 py-2 rounded-xl bg-[#064E3B] text-white dark:bg-[#10B981] dark:text-[#071410] text-xs font-semibold"
                >
                  {t.common.save}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
