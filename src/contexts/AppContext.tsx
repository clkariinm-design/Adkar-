import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Network } from '@capacitor/network';
import {
  supabase,
  type AppAnnouncement,
  type AppSetting,
  type AppVersion,
  type Profile,
} from '../lib/supabase';
import { translations, type AppLang, type Translations } from '../lib/i18n';
import {
  flushSyncQueue,
  getCachedValue,
  getQueuedOps,
  setCachedValue,
  subscribeSyncQueue,
} from '../lib/offlineStore';

export type NavTab = 'home' | 'quran' | 'adhkar' | 'tasbih' | 'account';
export type QuranMode = 'surahs' | 'search' | 'bookmarks' | 'khatmah';
export type ThemeMode = 'light' | 'dark';
export type UpdateStatus = 'none' | 'optional' | 'mandatory';

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
  quranMode: QuranMode;
  setQuranMode: (mode: QuranMode) => void;
  openKhatmah: () => void;
  targetVerse: TargetVerseJump | null;
  openQuranAt: (surahId: number, verseNumber?: number) => void;
  toast: ToastMessage | null;
  showToast: (text: string, tone?: 'success' | 'error' | 'info') => void;
  clearToast: () => void;
  registerBackHandler: (handler: () => boolean) => () => void;

  // Offline & Sync
  isOnline: boolean;
  pendingSyncCount: number;
  isSyncing: boolean;
  syncError: string | null;
  syncNow: () => Promise<void>;

  // Remote App Settings, Announcements & Android Versions
  configLoading: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  maintenanceEndAt: string | null;
  activeAnnouncements: AppAnnouncement[];
  androidVersions: AppVersion[];
  latestAndroidVersion: AppVersion | null;
  minSupportedVersionCode: number | null;
  installedVersionCode: number;
  installedVersionName: string;
  updateStatus: UpdateStatus;
  updateModalOpen: boolean;
  setUpdateModalOpen: (open: boolean) => void;
  refreshAppConfig: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

const LANG_STORAGE_KEY = 'nuur_lang';
const THEME_STORAGE_KEY = 'nuur_theme';
const DEFAULT_ANDROID_VERSION_CODE = 1;
const DEFAULT_ANDROID_VERSION_NAME = '1.0';

function parseBooleanSetting(val: unknown): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') return val.toLowerCase() === 'true';
  return false;
}

function parseStringSetting(val: unknown): string | null {
  if (typeof val === 'string') return val.trim() || null;
  return null;
}

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
  const activeTabRef = useRef<NavTab>('home');
  activeTabRef.current = activeTab;
  const [quranMode, setQuranMode] = useState<QuranMode>('surahs');
  const [targetVerse, setTargetVerse] = useState<TargetVerseJump | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const backHandlersRef = useRef<Set<() => boolean>>(new Set());

  // Offline & Sync state
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Remote config state
  const [configLoading, setConfigLoading] = useState(true);
  const [publicSettings, setPublicSettings] = useState<AppSetting[]>([]);
  const [announcements, setAnnouncements] = useState<AppAnnouncement[]>([]);
  const [androidVersions, setAndroidVersions] = useState<AppVersion[]>([]);
  const [installedVersionCode, setInstalledVersionCode] = useState(DEFAULT_ANDROID_VERSION_CODE);
  const [installedVersionName, setInstalledVersionName] = useState(DEFAULT_ANDROID_VERSION_NAME);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);

  const registerBackHandler = useCallback((handler: () => boolean) => {
    backHandlersRef.current.add(handler);
    return () => {
      backHandlersRef.current.delete(handler);
    };
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let cancelled = false;
    let removeListener: (() => void) | undefined;

    CapApp.addListener('backButton', ({ canGoBack }) => {
      const handlers = Array.from(backHandlersRef.current);
      for (let i = handlers.length - 1; i >= 0; i -= 1) {
        if (handlers[i]()) {
          return;
        }
      }
      if (activeTabRef.current !== 'home') {
        setActiveTab('home');
        return;
      }
      if (canGoBack) {
        window.history.back();
        return;
      }
      CapApp.exitApp();
    }).then((handle) => {
      if (cancelled) {
        handle.remove();
        return;
      }
      removeListener = () => handle.remove();
    });

    return () => {
      cancelled = true;
      if (removeListener) removeListener();
    };
  }, []);

  // Read native Android app version code & name when running on Capacitor native
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    CapApp.getInfo()
      .then((info) => {
        const parsedCode = parseInt(info.build, 10);
        if (!Number.isNaN(parsedCode) && parsedCode > 0) {
          setInstalledVersionCode(parsedCode);
        }
        if (info.version) {
          setInstalledVersionName(info.version);
        }
      })
      .catch(() => {
        // Keep defaults
      });
  }, []);

  // Online/offline detection (Capacitor Network + browser fallback)
  useEffect(() => {
    let mounted = true;
    const handleOnline = () => {
      if (mounted) setIsOnline(true);
    };
    const handleOffline = () => {
      if (mounted) setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    let removeNetListener: (() => void) | undefined;
    if (Capacitor.isNativePlatform()) {
      Network.getStatus()
        .then((status) => {
          if (mounted) setIsOnline(status.connected);
        })
        .catch(() => {});

      Network.addListener('networkStatusChange', (status) => {
        if (mounted) setIsOnline(status.connected);
      })
        .then((handle) => {
          if (!mounted) {
            handle.remove();
            return;
          }
          removeNetListener = () => handle.remove();
        })
        .catch(() => {});
    }

    return () => {
      mounted = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (removeNetListener) removeNetListener();
    };
  }, []);

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

  const refreshQueueCount = useCallback(async (uid?: string) => {
    if (!uid) {
      setPendingSyncCount(0);
      return;
    }
    const ops = await getQueuedOps(uid);
    setPendingSyncCount(ops.length);
    const firstErr = ops.find((o) => o.lastError)?.lastError ?? null;
    setSyncError(firstErr);
  }, []);

  useEffect(() => {
    void refreshQueueCount(user?.id);
    return subscribeSyncQueue(() => {
      void refreshQueueCount(user?.id);
    });
  }, [user?.id, refreshQueueCount]);

  const syncNow = useCallback(async () => {
    if (!user || !isOnline) return;
    setIsSyncing(true);
    try {
      const res = await flushSyncQueue(user.id);
      setPendingSyncCount(res.remaining);
      setSyncError(res.lastError);
      if (res.synced > 0 && res.remaining === 0 && !res.lastError) {
        showToast(translations[lang].offline.syncedSuccess, 'success');
      }
    } finally {
      setIsSyncing(false);
    }
  }, [user, isOnline, lang, showToast]);

  // Auto-flush queue when back online or user becomes available
  useEffect(() => {
    if (isOnline && user) {
      void flushSyncQueue(user.id).then((res) => {
        setPendingSyncCount(res.remaining);
        setSyncError(res.lastError);
      });
    }
  }, [isOnline, user]);

  // Fetch public settings, announcements, and Android versions (with offline cache fallback)
  const refreshAppConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const [settingsRes, announcementsRes, versionsRes] = await Promise.all([
        supabase.from('app_settings').select('*').eq('is_public', true),
        supabase
          .from('app_announcements')
          .select('*')
          .eq('is_active', true)
          .order('priority', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('app_versions')
          .select('*')
          .eq('platform', 'android')
          .eq('is_active', true)
          .order('version_code', { ascending: false }),
      ]);

      if (!settingsRes.error && settingsRes.data) {
        setPublicSettings(settingsRes.data);
        await setCachedValue('app_settings_public', settingsRes.data);
      } else {
        const cached = await getCachedValue<AppSetting[]>('app_settings_public');
        if (cached) setPublicSettings(cached);
      }

      if (!announcementsRes.error && announcementsRes.data) {
        setAnnouncements(announcementsRes.data);
        await setCachedValue('app_announcements_public', announcementsRes.data);
      } else {
        const cached = await getCachedValue<AppAnnouncement[]>('app_announcements_public');
        if (cached) setAnnouncements(cached);
      }

      if (!versionsRes.error && versionsRes.data) {
        setAndroidVersions(versionsRes.data);
        await setCachedValue('app_versions_public', versionsRes.data);
      } else {
        const cached = await getCachedValue<AppVersion[]>('app_versions_public');
        if (cached) setAndroidVersions(cached);
      }
    } catch {
      const [cSettings, cAnnouncements, cVersions] = await Promise.all([
        getCachedValue<AppSetting[]>('app_settings_public'),
        getCachedValue<AppAnnouncement[]>('app_announcements_public'),
        getCachedValue<AppVersion[]>('app_versions_public'),
      ]);
      if (cSettings) setPublicSettings(cSettings);
      if (cAnnouncements) setAnnouncements(cAnnouncements);
      if (cVersions) setAndroidVersions(cVersions);
    } finally {
      setConfigLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshAppConfig();
  }, [refreshAppConfig]);

  // Load the profile created by the existing database trigger (with cache fallback)
  const loadProfileFromTrigger = useCallback(async (currentUser: User) => {
    const cacheKey = `profile:${currentUser.id}`;
    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, locale, timezone, created_at, updated_at')
        .eq('id', currentUser.id)
        .maybeSingle();
      if (error) return null;
      return data;
    };

    try {
      let data = await fetchProfile();
      if (!data) {
        await new Promise((r) => window.setTimeout(r, 400));
        data = await fetchProfile();
      }

      if (data) {
        setProfile(data);
        await setCachedValue(cacheKey, data);
        if (data.locale === 'en' || data.locale === 'so') {
          setLangState(data.locale);
        }
      } else {
        const cached = await getCachedValue<Profile>(cacheKey);
        if (cached) setProfile(cached);
      }
    } catch {
      const cached = await getCachedValue<Profile>(cacheKey);
      if (cached) setProfile(cached);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }
    await loadProfileFromTrigger(user);
  }, [user, loadProfileFromTrigger]);

  // Restore existing session on app open; never auto-create anonymous accounts on page load
  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const nextUser = data.session?.user ?? null;
      setSession(data.session);
      setUser(nextUser);
      setAuthLoading(false);
      if (nextUser) {
        void loadProfileFromTrigger(nextUser);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      const nextUser = nextSession?.user ?? null;
      setSession(nextSession);
      setUser(nextUser);
      setAuthLoading(false);

      if (nextUser) {
        void loadProfileFromTrigger(nextUser);
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
    setQuranMode('surahs');
    setTargetVerse({ surahId, verseNumber, nonce: Date.now() });
    setActiveTab('quran');
  }, []);

  const openKhatmah = useCallback(() => {
    setQuranMode('khatmah');
    setActiveTab('quran');
  }, []);

  // Derived Remote Config values
  const maintenanceMode = useMemo(() => {
    const row = publicSettings.find((s) => s.setting_key === 'maintenance_mode');
    return parseBooleanSetting(row?.setting_value);
  }, [publicSettings]);

  const maintenanceMessage = useMemo(() => {
    const row = publicSettings.find((s) => s.setting_key === 'maintenance_message');
    return parseStringSetting(row?.setting_value);
  }, [publicSettings]);

  const maintenanceEndAt = useMemo(() => {
    const row = publicSettings.find((s) => s.setting_key === 'maintenance_end_at');
    return parseStringSetting(row?.setting_value);
  }, [publicSettings]);

  const activeAnnouncements = useMemo(() => {
    const now = Date.now();
    return announcements.filter((a) => {
      if (!a.is_active) return false;
      if (a.starts_at && new Date(a.starts_at).getTime() > now) return false;
      if (a.ends_at && new Date(a.ends_at).getTime() < now) return false;
      return true;
    });
  }, [announcements]);

  const latestAndroidVersion = useMemo(() => {
    return androidVersions[0] ?? null;
  }, [androidVersions]);

  const minSupportedVersionCode = useMemo(() => {
    const mandatoryCodes = androidVersions
      .filter((v) => v.is_active && v.is_mandatory)
      .map((v) => v.version_code);
    if (mandatoryCodes.length === 0) return null;
    return Math.max(...mandatoryCodes);
  }, [androidVersions]);

  const updateStatus: UpdateStatus = useMemo(() => {
    if (!latestAndroidVersion) return 'none';
    if (minSupportedVersionCode !== null && installedVersionCode < minSupportedVersionCode) {
      return 'mandatory';
    }
    if (latestAndroidVersion.version_code > installedVersionCode) {
      return latestAndroidVersion.is_mandatory ? 'mandatory' : 'optional';
    }
    return 'none';
  }, [latestAndroidVersion, minSupportedVersionCode, installedVersionCode]);

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
        quranMode,
        setQuranMode,
        openKhatmah,
        targetVerse,
        openQuranAt,
        toast,
        showToast,
        clearToast,
        registerBackHandler,
        isOnline,
        pendingSyncCount,
        isSyncing,
        syncError,
        syncNow,
        configLoading,
        maintenanceMode,
        maintenanceMessage,
        maintenanceEndAt,
        activeAnnouncements,
        androidVersions,
        latestAndroidVersion,
        minSupportedVersionCode,
        installedVersionCode,
        installedVersionName,
        updateStatus,
        updateModalOpen,
        setUpdateModalOpen,
        refreshAppConfig,
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
