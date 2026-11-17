import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, type Profile } from '../lib/supabase';
import { translations, type AppLang, type Translations } from '../lib/i18n';

export type NavTab = 'home' | 'quran' | 'adhkar' | 'tasbih' | 'account';
export type ThemeMode = 'light' | 'dark';

export interface TargetVerseJump {
  surahId: number;
  verseNumber?: number;
  nonce: number;
}

export interface ToastMessage {
  id: number;
  text: string;
  tone: 'success' | 'error' | 'info';
}

interface AppContextValue {
  user: User | null;
  session: Session | null;
  authLoading: boolean;
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
  lang: AppLang;
  setLang: (lang: AppLang) => void;
  t: Translations;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  targetVerse: TargetVerseJump | null;
  openQuranAt: (surahId: number, verseNumber?: number) => void;
  toast: ToastMessage | null;
  showToast: (text: string, tone?: 'success' | 'error' | 'info') => void;
  clearToast: () => void;
  signOut: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

const LANG_STORAGE_KEY = 'nuur_lang';
const THEME_STORAGE_KEY = 'nuur_theme';

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [lang, setLangState] = useState<AppLang>(() => {
    try {
      const saved = localStorage.getItem(LANG_STORAGE_KEY);
      return saved === 'en' ? 'en' : 'so';
    } catch {
      return 'so';
    }
  });

  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      return saved === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [targetVerse, setTargetVerse] = useState<TargetVerseJump | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage failures
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      // Ignore storage failures
    }
  }, [lang]);

  const showToast = useCallback((text: string, tone: 'success' | 'error' | 'info' = 'info') => {
    setToast({ id: Date.now(), text, tone });
  }, []);

  const clearToast = useCallback(() => {
    setToast(null);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const loadOrCreateProfile = useCallback(async (currentUser: User) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, locale, timezone, created_at, updated_at')
      .eq('id', currentUser.id)
      .maybeSingle();

    if (error) {
      return;
    }

    if (data) {
      setProfile(data);
      if (data.locale === 'en' || data.locale === 'so') {
        setLangState(data.locale);
      }
      return;
    }

    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const metaName =
      typeof currentUser.user_metadata?.display_name === 'string'
        ? currentUser.user_metadata.display_name
        : currentUser.email?.split('@')[0] ?? null;

    const { data: inserted } = await supabase
      .from('profiles')
      .upsert(
        {
          id: currentUser.id,
          display_name: metaName,
          locale: lang,
          timezone: browserTz,
        },
        { onConflict: 'id' }
      )
      .select('id, display_name, locale, timezone, created_at, updated_at')
      .maybeSingle();

    if (inserted) {
      setProfile(inserted);
    }
  }, [lang]);

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }
    await loadOrCreateProfile(user);
  }, [user, loadOrCreateProfile]);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setAuthLoading(false);
      if (data.session?.user) {
        loadOrCreateProfile(data.session.user);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setAuthLoading(false);
      if (nextSession?.user) {
        loadOrCreateProfile(nextSession.user);
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadOrCreateProfile]);

  const setLang = useCallback(
    (nextLang: AppLang) => {
      setLangState(nextLang);
      if (user) {
        supabase
          .from('profiles')
          .update({ locale: nextLang, updated_at: new Date().toISOString() })
          .eq('id', user.id)
          .then(() => {
            setProfile((prev) => (prev ? { ...prev, locale: nextLang } : prev));
          });
      }
    },
    [user]
  );

  const setTheme = useCallback((nextTheme: ThemeMode) => {
    setThemeState(nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const openQuranAt = useCallback((surahId: number, verseNumber?: number) => {
    setTargetVerse({ surahId, verseNumber, nonce: Date.now() });
    setActiveTab('quran');
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setUser(null);
    setSession(null);
  }, []);

  return (
    <AppContext.Provider
      value={{
        user,
        session,
        authLoading,
        profile,
        refreshProfile,
        lang,
        setLang,
        t: translations[lang],
        theme,
        setTheme,
        toggleTheme,
        activeTab,
        setActiveTab,
        targetVerse,
        openQuranAt,
        toast,
        showToast,
        clearToast,
        signOut,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
