import React, { useState } from 'react';
import { AlertCircle, ArrowRight, BookOpen, Compass, HeartHandshake, Moon, Sun } from 'lucide-react';
import { motion } from 'motion/react';
import { useApp } from '../contexts/AppContext';

export function WelcomeScreen() {
  const { startAnonymousSession, startingSession, lang, setLang, theme, toggleTheme, t } = useApp();
  const [errorInfo, setErrorInfo] = useState<{ code?: string; message: string } | null>(null);
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  const handleStart = async () => {
    setErrorInfo(null);
    const result = await startAnonymousSession();
    if (!result.ok) {
      setErrorInfo({
        code: result.errorCode,
        message: result.errorMessage || 'Authentication error',
      });
    }
  };

  const isAnonDisabled =
    errorInfo?.code === 'anonymous_provider_disabled' ||
    errorInfo?.message.toLowerCase().includes('anonymous');

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F3] text-[#14241E] dark:bg-[#071410] dark:text-[#F2EFE9] transition-colors duration-200">
      {/* Subtle Top Utility Row (Language & Theme only) */}
      <header className="w-full max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {/* NUUR Geometric Octagonal Star Emblem */}
          <svg
            viewBox="0 0 36 36"
            className="w-8 h-8 text-[#064E3B] dark:text-[#34D399]"
            fill="none"
            aria-hidden="true"
          >
            <rect
              x="7.5"
              y="7.5"
              width="21"
              height="21"
              rx="2"
              stroke="currentColor"
              strokeWidth="1.75"
            />
            <rect
              x="7.5"
              y="7.5"
              width="21"
              height="21"
              rx="2"
              transform="rotate(45 18 18)"
              stroke="#B48A3E"
              strokeWidth="1.5"
            />
            <circle cx="18" cy="18" r="3" fill="currentColor" />
          </svg>
          <span className="font-display text-2xl font-bold tracking-tight text-[#064E3B] dark:text-[#F2EFE9]">
            {t.appName}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 rounded-lg bg-[#EFECE4] dark:bg-[#0C1F19] border border-[#E5DFD3] dark:border-[#1B3A2F]">
            <button
              type="button"
              onClick={() => setLang('so')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                lang === 'so'
                  ? 'bg-white dark:bg-[#143328] text-[#064E3B] dark:text-[#F2EFE9] shadow-xs'
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
                  ? 'bg-white dark:bg-[#143328] text-[#064E3B] dark:text-[#F2EFE9] shadow-xs'
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
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg border border-[#E5DFD3] dark:border-[#1B3A2F] bg-white dark:bg-[#0C1F19] text-[#52635C] dark:text-[#A3B8AF]"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-[#D4AF6A]" />}
          </button>
        </div>
      </header>

      {/* Main Split Welcome Showcase */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-6 sm:py-10 flex items-center">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
          className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch"
        >
          {/* Left Content Column */}
          <div className="lg:col-span-7 flex flex-col justify-center space-y-7 py-2">
            <div className="space-y-4">
              <p
                dir="rtl"
                lang="ar"
                className="font-arabic text-2xl sm:text-3xl text-[#B48A3E] dark:text-[#D4AF6A]"
              >
                {t.welcome.bismillah}
              </p>

              <h1 className="font-display text-3xl sm:text-5xl font-semibold tracking-tight leading-[1.15] text-[#14241E] dark:text-[#F2EFE9] text-balance">
                {t.welcome.greeting}
              </h1>

              <p className="text-base sm:text-lg leading-relaxed text-[#52635C] dark:text-[#A3B8AF] max-w-xl">
                {t.welcome.subtitle}
              </p>
            </div>

            {/* Quiet Feature Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1 border-t border-[#E5DFD3] dark:border-[#18352B]">
              <div className="pt-4 flex items-start gap-2.5">
                <BookOpen className="w-4 h-4 text-[#064E3B] dark:text-[#34D399] mt-0.5 shrink-0" />
                <span className="text-xs font-medium text-[#14241E] dark:text-[#D6E2DC] leading-snug">
                  {t.welcome.featureQuran}
                </span>
              </div>
              <div className="pt-4 flex items-start gap-2.5">
                <HeartHandshake className="w-4 h-4 text-[#B48A3E] dark:text-[#D4AF6A] mt-0.5 shrink-0" />
                <span className="text-xs font-medium text-[#14241E] dark:text-[#D6E2DC] leading-snug">
                  {t.welcome.featureAdhkar}
                </span>
              </div>
              <div className="pt-4 flex items-start gap-2.5">
                <Compass className="w-4 h-4 text-[#064E3B] dark:text-[#34D399] mt-0.5 shrink-0" />
                <span className="text-xs font-medium text-[#14241E] dark:text-[#D6E2DC] leading-snug">
                  {t.welcome.featureTasbih}
                </span>
              </div>
            </div>

            {/* Single Large Emerald Green CTA Button */}
            <div className="pt-2 space-y-4">
              <button
                type="button"
                onClick={handleStart}
                disabled={startingSession}
                className="w-full sm:w-auto min-h-[54px] px-8 py-3.5 rounded-2xl bg-[#064E3B] hover:bg-[#053F30] text-[#FAF8F3] dark:bg-[#10B981] dark:hover:bg-[#34D399] dark:text-[#071410] font-semibold text-base shadow-sm transition-all active:scale-[0.98] disabled:opacity-60 inline-flex items-center justify-center gap-3 cursor-pointer"
              >
                <span>{startingSession ? t.welcome.starting : t.welcome.cta}</span>
                <ArrowRight className="w-5 h-5" />
              </button>

              {errorInfo && (
                <div
                  role="alert"
                  className="p-4 rounded-xl border border-[#FECACA] dark:border-[#7F1D1D] bg-[#FEF2F2] dark:bg-[#2A1215] text-[#991B1B] dark:text-[#FCA5A5] flex items-start gap-3 max-w-xl"
                >
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="text-xs leading-relaxed space-y-1">
                    <p className="font-semibold">
                      {isAnonDisabled ? t.welcome.anonDisabledTitle : errorInfo.message}
                    </p>
                    {isAnonDisabled && <p>{t.welcome.anonDisabledDesc}</p>}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Visual Sanctuary Card */}
          <div className="lg:col-span-5 relative rounded-3xl overflow-hidden border border-[#E5DFD3] dark:border-[#1B3A2F] min-h-[280px] lg:min-h-[460px] bg-[#064E3B]">
            {!heroImgFailed ? (
              <img
                src="/src/assets/images/nuur_sanctuary_hero_1794894602769.jpg"
                alt="NUUR Islamic sanctuary courtyard"
                referrerPolicy="no-referrer"
                onError={() => setHeroImgFailed(true)}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 islamic-lattice-bg bg-gradient-to-br from-[#064E3B] to-[#042F24]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#04241B]/90 via-[#04241B]/25 to-transparent" />
            <div className="relative z-10 h-full p-7 flex flex-col justify-end text-[#FAF8F3]">
              <p dir="rtl" lang="ar" className="font-arabic text-3xl text-[#E6CFA0]">
                نُورٌ عَلَىٰ نُورٍ
              </p>
              <p className="mt-1 text-xs text-[#D6E2DC]">
                NUUR · {lang === 'so' ? 'Qur’aanka, Adkaarta iyo Tasbiixda' : 'Quran, Adhkar & Tasbih'}
              </p>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
