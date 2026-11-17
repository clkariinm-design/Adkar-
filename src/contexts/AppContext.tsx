import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
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

interface StartSessionResult {
  ok: boolean;
  errorCode?: string;
  errorMessage?: string;
}

interface AppContextValue {
  user: User | null;
  session: Session | null;
  authLoading: boolean;
  startingSession: boolean;
  startAnonymousSession: () => Promise<StartSessionResult>;
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
  registerBackHandler: (handler: () => boolean) => () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const LANG_STORAGE_KEY = 'nuur_lang';
const THEME_STORAGE_KEY = 'nuur_theme';

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [startingSession, setStartingSession] = useState(false);
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
  const backHandlersRef = useRef<Set<() => boolean>>(new Set());

  const registerBackHandler = useCallback((handler: () => boolean) => {
    backHandlersRef.current.add(handler);
    return () => {
      backHandlersRef.current.delete(handler);
    };
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let removeListener: (() => void) | undefined;

    CapApp.addListener('backButton', ({ canGoBack }) => {
      // Give active sub-views/modals first chance to consume the back press
      const handlers = Array.from(backHandlersRef.current);
      for (let i = handlers.length - 1; i >= 0; i -= 1) {
        if (handlers[i]()) {
          return;
        }
      }
      if (activeTab !== 'home') {
        setActiveTab('home');
        return;
      }
      if (canGoBack) {
        window.history.back();
        return;
      }
      CapApp.exitApp();
    }).then((handle) => {
      removeListener = () => handle.remove();
    });

    return () => {
      if (removeListener) removeListener();
    };
  }, [activeTab]);

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

  // Load the profile created by the existing database trigger (with short retry if trigger just fired)
  const loadProfileFromTrigger = useCallback(async (currentUser: User) => {
    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, locale, timezone, created_at, updated_at')
        .eq('id', currentUser.id)
        .maybeSingle();
      if (error) return null;
      return data;
    };

    let data = await fetchProfile();
    if (!data) {
      // Wait briefly for DB trigger on auth.users if just created
      await new Promise((r) => window.setTimeout(r, 400));
      data = await fetchProfile();
    }

    if (data) {
      setProfile(data);
      if (data.locale === 'en' || data.locale === 'so') {
        setLangState(data.locale);
      }
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }
    await loadProfileFromTrigger(user);
  }, [user, loadProfileFromTrigger]);

  // Restore existing session on app open; never auto-create a new anonymous account on page load
  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setAuthLoading(false);
      if (data.session?.user) {
        loadProfileFromTrigger(data.session.user);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setAuthLoading(false);
      if (nextSession?.user) {
        loadProfileFromTrigger(nextSession.user);
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfileFromTrigger]);

  const startAnonymousSession = useCallback(async (): Promise<StartSessionResult> => {
    setStartingSession(true);
    try {
      // Ensure we do not create a duplicate anonymous user if a session already exists
      const { data: existing } = await supabase.auth.getSession();
      if (existing.session?.user) {
        setSession(existing.session);
        setUser(existing.session.user);
        await loadProfileFromTrigger(existing.session.user);
        setActiveTab('home');
        return { ok: true };
      }

      const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const { data, error } = await supabase.auth.signInAnonymously({
        options: {
          data: {
            locale: lang,
            timezone: browserTz,
          },
        },
      });

      if (error) {
        return {
          ok: false,
          errorCode: (error as { code?: string }).code || String(error.status ?? ''),
          errorMessage: error.message,
        };
      }

      if (data.session?.user) {
        setSession(data.session);
        setUser(data.session.user);
        await loadProfileFromTrigger(data.session.user);
        setActiveTab('home');
        return { ok: true };
      }

      return { ok: false, errorMessage: 'No session returned from Supabase.' };
    } catch (err) {
      return {
        ok: false,
        errorMessage: err instanceof Error ? err.message : 'Unable to start session.',
      };
    } finally {
      setStartingSession(false);
    }
  }, [lang, loadProfileFromTrigger]);

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

  return (
    <AppContext.Provider
      value={{
        user,
        session,
        authLoading,
        startingSession,
        startAnonymousSession,
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
        registerBackHandler,
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
