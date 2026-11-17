import React from 'react';
import {
  BookOpen,
  Compass,
  HeartHandshake,
  Home,
  Moon,
  Sun,
  User,
  X,
  CheckCircle2,
  AlertCircle,
  Info,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useApp, type NavTab } from '../contexts/AppContext';

export function Layout({ children }: { children: React.ReactNode }) {
  const { activeTab, setActiveTab, user, profile, t, theme, toggleTheme, lang, setLang, toast, clearToast } =
    useApp();

  const navItems: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'home', label: t.nav.home, icon: Home },
    { id: 'quran', label: t.nav.quran, icon: BookOpen },
    { id: 'adhkar', label: t.nav.adhkar, icon: HeartHandshake },
    { id: 'tasbih', label: t.nav.tasbih, icon: Compass },
    { id: 'account', label: t.nav.account, icon: User },
  ];

  const accountButtonLabel = user
    ? profile?.display_name || user.email?.split('@')[0] || t.nav.account
    : t.common.signIn;

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F3] text-[#14241E] dark:bg-[#071410] dark:text-[#F2EFE9] transition-colors duration-200">
      {/* Desktop Top Navigation (Strict 3-Zone Top Bar Contract) */}
      <header className="hidden md:block sticky top-0 z-40 bg-[#FAF8F3]/90 dark:bg-[#071410]/90 backdrop-blur-md border-b border-[#E5DFD3] dark:border-[#18352B]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className="font-display text-2xl font-bold tracking-tight text-[#064E3B] dark:text-[#F2EFE9] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B48A3E] rounded-md px-1"
          >
            {t.appName}
          </button>

          {/* Zone 2: 5 concise single-line navigation links */}
          <nav className="flex items-center gap-7" aria-label="Main navigation">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`relative py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B48A3E] rounded ${
                    isActive
                      ? 'text-[#064E3B] dark:text-[#34D399]'
                      : 'text-[#52635C] hover:text-[#14241E] dark:text-[#A3B8AF] dark:hover:text-[#F2EFE9]'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute left-0 right-0 -bottom-[1px] h-[2px] bg-[#064E3B] dark:bg-[#34D399]" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('account')}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-[#064E3B] text-[#FAF8F3] hover:bg-[#053F30] dark:bg-[#10B981] dark:text-[#071410] dark:hover:bg-[#34D399] transition-colors whitespace-nowrap shrink-0 max-w-[160px] truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B48A3E]"
            >
              {accountButtonLabel}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Compact Top Bar (52px height, respecting 15% mobile sticky cap) */}
      <header className="md:hidden sticky top-0 z-40 h-[52px] bg-[#FAF8F3]/92 dark:bg-[#071410]/92 backdrop-blur-md border-b border-[#E5DFD3] dark:border-[#18352B] px-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setActiveTab('home')}
          className="font-display text-xl font-bold tracking-tight text-[#064E3B] dark:text-[#F2EFE9] whitespace-nowrap shrink-0"
        >
          {t.appName}
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setLang(lang === 'so' ? 'en' : 'so')}
            aria-label={lang === 'so' ? 'Switch to English' : 'U beddel Soomaali'}
            className="min-h-[44px] min-w-[44px] px-2 flex items-center justify-center text-xs font-semibold text-[#52635C] dark:text-[#A3B8AF] hover:text-[#064E3B] dark:hover:text-[#F2EFE9] transition-colors"
          >
            {lang === 'so' ? 'SO' : 'EN'}
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'light' ? t.common.darkMode : t.common.lightMode}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#52635C] dark:text-[#A3B8AF] hover:text-[#064E3B] dark:hover:text-[#F2EFE9] transition-colors"
          >
            {theme === 'light' ? <Moon className="w-[18px] h-[18px]" /> : <Sun className="w-[18px] h-[18px]" />}
          </button>
        </div>
      </header>

      {/* Non-blocking Toast Feedback */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.18 }}
            role="status"
            aria-live="polite"
            className="fixed top-16 md:top-20 right-4 left-4 md:left-auto md:w-96 z-50"
          >
            <div
              className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-md ${
                toast.tone === 'error'
                  ? 'bg-[#FEF2F2]/95 dark:bg-[#2A1215]/95 border-[#FECACA] dark:border-[#7F1D1D] text-[#991B1B] dark:text-[#FCA5A5]'
                  : toast.tone === 'success'
                  ? 'bg-[#ECFDF5]/95 dark:bg-[#0B2E22]/95 border-[#A7F3D0] dark:border-[#065F46] text-[#065F46] dark:text-[#6EE7B7]'
                  : 'bg-white/95 dark:bg-[#0C1F19]/95 border-[#E5DFD3] dark:border-[#1B3A2F] text-[#14241E] dark:text-[#F2EFE9]'
              }`}
            >
              {toast.tone === 'error' ? (
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              ) : toast.tone === 'success' ? (
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              ) : (
                <Info className="w-4 h-4 mt-0.5 shrink-0" />
              )}
              <p className="text-sm font-medium flex-1">{toast.text}</p>
              <button
                type="button"
                onClick={clearToast}
                aria-label={t.common.close}
                className="p-0.5 opacity-70 hover:opacity-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Viewport */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-24 md:pb-12">
        {children}
      </main>

      {/* Desktop Footer */}
      <footer className="hidden md:block border-t border-[#E5DFD3] dark:border-[#18352B] py-6">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 flex items-center justify-between text-xs text-[#52635C] dark:text-[#8FA89E]">
          <span>NUUR · {lang === 'so' ? 'Qur’aanka, Adkaarta iyo Tasbiixda' : 'Holy Quran, Adhkar & Digital Tasbih'}</span>
          <span>
            {lang === 'so'
              ? 'Tarjumaadda Qur’aanka: Abdullah Hasan Yaqoub (QuranEnc.com v1.0.27)'
              : 'Somali Quran Translation: Abdullah Hasan Yaqoub (QuranEnc.com v1.0.27)'}
          </span>
        </div>
      </footer>

      {/* Mobile Fixed Bottom Navigation (64px height) */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-[#FAF8F3]/95 dark:bg-[#071410]/95 backdrop-blur-md border-t border-[#E5DFD3] dark:border-[#18352B]"
      >
        <div className="grid grid-cols-5 h-full items-center">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`min-h-[44px] flex flex-col items-center justify-center gap-1 transition-colors ${
                  isActive
                    ? 'text-[#064E3B] dark:text-[#34D399]'
                    : 'text-[#52635C] dark:text-[#8FA89E]'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[11px] font-medium tracking-tight leading-none whitespace-nowrap">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
