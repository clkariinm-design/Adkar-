import React from 'react';
import { Moon, RefreshCw, Sun, Wrench } from 'lucide-react';
import { useApp } from '../contexts/AppContext';

export function MaintenanceScreen() {
  const {
    lang,
    setLang,
    theme,
    toggleTheme,
    t,
    maintenanceMessage,
    maintenanceEndAt,
    configLoading,
    refreshAppConfig,
  } = useApp();

  const formattedEnd = React.useMemo(() => {
    if (!maintenanceEndAt) return null;
    try {
      const dt = new Date(maintenanceEndAt);
      if (Number.isNaN(dt.getTime())) return maintenanceEndAt;
      return dt.toLocaleString(lang === 'so' ? 'so-SO' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return maintenanceEndAt;
    }
  }, [maintenanceEndAt, lang]);

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F3] text-[#14241E] dark:bg-[#071410] dark:text-[#F2EFE9] transition-colors duration-200">
      <header className="w-full max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
        <span className="font-display text-2xl font-bold tracking-tight text-[#064E3B] dark:text-[#F2EFE9]">
          {t.appName}
        </span>

        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 rounded-lg bg-[#EFECE4] dark:bg-[#0C1F19] border border-[#E5DFD3] dark:border-[#1B3A2F]">
            <button
              type="button"
              onClick={() => setLang('so')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                lang === 'so'
                  ? 'bg-white dark:bg-[#143328] text-[#064E3B] dark:text-[#F2EFE9]'
                  : 'text-[#52635C] dark:text-[#8FA89E]'
              }`}
            >
              SO
            </button>
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                lang === 'en'
                  ? 'bg-white dark:bg-[#143328] text-[#064E3B] dark:text-[#F2EFE9]'
                  : 'text-[#52635C] dark:text-[#8FA89E]'
              }`}
            >
              EN
            </button>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'light' ? t.common.darkMode : t.common.lightMode}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg border border-[#E5DFD3] dark:border-[#1B3A2F] bg-white dark:bg-[#0C1F19]"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-[#D4AF6A]" />}
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-lg rounded-3xl border border-[#E5DFD3] dark:border-[#1B3A2F] bg-white dark:bg-[#0C1F19] p-8 text-center space-y-6">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FDF6E7] dark:bg-[#231D11] border border-[#E6CFA0] dark:border-[#5C4820] flex items-center justify-center text-[#B48A3E] dark:text-[#D4AF6A]">
            <Wrench className="w-7 h-7" />
          </div>

          <div className="space-y-3">
            <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#14241E] dark:text-[#F2EFE9] text-balance">
              {t.maintenance.title}
            </h1>
            <p className="text-sm sm:text-base leading-relaxed text-[#52635C] dark:text-[#A3B8AF]">
              {maintenanceMessage || t.maintenance.defaultMessage}
            </p>
            {formattedEnd && (
              <p className="text-xs font-medium text-[#064E3B] dark:text-[#34D399] tabular-nums pt-1">
                {t.maintenance.expectedEnd}: {formattedEnd}
              </p>
            )}
          </div>

          <div className="flex items-center justify-center pt-2">
            <button
              type="button"
              onClick={() => void refreshAppConfig()}
              disabled={configLoading}
              className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-xl bg-[#064E3B] text-white dark:bg-[#10B981] dark:text-[#071410] text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${configLoading ? 'animate-spin' : ''}`} />
              <span>{t.common.retry}</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
