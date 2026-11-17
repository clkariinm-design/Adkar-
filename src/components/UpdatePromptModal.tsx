import React, { useEffect, useState } from 'react';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { AlertTriangle, CheckCircle2, Download, ShieldAlert, X } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { pickLocalizedText } from '../lib/supabase';

export function isValidHttpsUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function UpdatePromptModal() {
  const {
    lang,
    t,
    latestAndroidVersion,
    minSupportedVersionCode,
    installedVersionCode,
    installedVersionName,
    updateStatus,
    updateModalOpen,
    setUpdateModalOpen,
    registerBackHandler,
    showToast,
  } = useApp();

  const [confirmStep, setConfirmStep] = useState(false);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    if (!updateModalOpen) {
      setConfirmStep(false);
      return;
    }
    return registerBackHandler(() => {
      if (confirmStep) {
        setConfirmStep(false);
        return true;
      }
      setUpdateModalOpen(false);
      return true;
    });
  }, [updateModalOpen, confirmStep, registerBackHandler, setUpdateModalOpen]);

  if (!updateModalOpen) return null;

  const hasValidUrl = isValidHttpsUrl(latestAndroidVersion?.apk_url);
  const releaseNotes = pickLocalizedText(latestAndroidVersion?.release_notes, lang);

  const handleOpenApk = async () => {
    if (!hasValidUrl || !latestAndroidVersion?.apk_url) return;
    setOpening(true);
    try {
      if (Capacitor.isNativePlatform()) {
        await Browser.open({ url: latestAndroidVersion.apk_url });
      } else {
        window.location.assign(latestAndroidVersion.apk_url);
      }
      setConfirmStep(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to open download URL', 'error');
    } finally {
      setOpening(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="nuur-update-title"
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#0C1F19] border border-[#E5DFD3] dark:border-[#1B3A2F] p-6 space-y-5 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                updateStatus === 'mandatory'
                  ? 'bg-[#FEF2F2] dark:bg-[#2A1215] text-[#991B1B] dark:text-[#FCA5A5]'
                  : 'bg-[#ECFDF5] dark:bg-[#112E24] text-[#064E3B] dark:text-[#34D399]'
              }`}
            >
              {updateStatus === 'mandatory' ? (
                <AlertTriangle className="w-5 h-5" />
              ) : updateStatus === 'optional' ? (
                <Download className="w-5 h-5" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2
                id="nuur-update-title"
                className="font-display text-lg font-semibold text-[#14241E] dark:text-[#F2EFE9]"
              >
                {updateStatus === 'none' ? t.updates.upToDate : t.updates.title}
              </h2>
              {latestAndroidVersion && updateStatus !== 'none' && (
                <p className="text-xs font-medium text-[#B48A3E] dark:text-[#D4AF6A]">
                  {updateStatus === 'mandatory' ? t.updates.mandatoryBadge : t.updates.optionalBadge}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setUpdateModalOpen(false)}
            aria-label={t.common.close}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-[#52635C] hover:bg-[#FAF8F3] dark:hover:bg-[#112921]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-[#FAF8F3] dark:bg-[#071410] border border-[#E5DFD3] dark:border-[#18352B]">
            <p className="text-[#52635C] dark:text-[#8FA89E]">{t.updates.currentVersion}</p>
            <p className="mt-1 font-semibold tabular-nums text-[#14241E] dark:text-[#F2EFE9]">
              v{installedVersionName} ({installedVersionCode})
            </p>
          </div>

          {latestAndroidVersion && (
            <div className="p-3 rounded-xl bg-[#FAF8F3] dark:bg-[#071410] border border-[#E5DFD3] dark:border-[#18352B]">
              <p className="text-[#52635C] dark:text-[#8FA89E]">{t.updates.latestVersion}</p>
              <p className="mt-1 font-semibold tabular-nums text-[#064E3B] dark:text-[#34D399]">
                v{latestAndroidVersion.version_name} ({latestAndroidVersion.version_code})
              </p>
            </div>
          )}

          {minSupportedVersionCode !== null && (
            <div className="p-3 rounded-xl bg-[#FAF8F3] dark:bg-[#071410] border border-[#E5DFD3] dark:border-[#18352B] col-span-2 sm:col-span-1">
              <p className="text-[#52635C] dark:text-[#8FA89E]">{t.updates.minSupported}</p>
              <p className="mt-1 font-semibold tabular-nums text-[#14241E] dark:text-[#F2EFE9]">
                Code {minSupportedVersionCode}
              </p>
            </div>
          )}
        </div>

        {releaseNotes && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-[#52635C] dark:text-[#A3B8AF]">
              {t.updates.releaseNotes}
            </p>
            <p className="text-sm leading-relaxed text-[#14241E] dark:text-[#D6E2DC] whitespace-pre-line">
              {releaseNotes}
            </p>
          </div>
        )}

        {latestAndroidVersion && (
          hasValidUrl ? (
            confirmStep ? (
              <div className="p-4 rounded-xl border border-[#E6CFA0] dark:border-[#5C4820] bg-[#FDF6E7] dark:bg-[#231D11] space-y-3">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert className="w-5 h-5 text-[#B48A3E] dark:text-[#D4AF6A] shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs leading-relaxed text-[#524322] dark:text-[#E6CFA0]">
                    <p className="font-semibold">{t.updates.androidLimitationsTitle}</p>
                    <p>{t.updates.androidLimitationsBody}</p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setConfirmStep(false)}
                    className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-medium text-[#52635C] dark:text-[#A3B8AF]"
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    type="button"
                    disabled={opening}
                    onClick={() => void handleOpenApk()}
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-[#064E3B] text-white dark:bg-[#10B981] dark:text-[#071410] text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <Download className="w-4 h-4" />
                    <span>{t.updates.confirmDownload}</span>
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmStep(true)}
                className="w-full min-h-[44px] px-5 py-2.5 rounded-xl bg-[#064E3B] text-white dark:bg-[#10B981] dark:text-[#071410] text-sm font-semibold inline-flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>{t.updates.downloadApk}</span>
              </button>
            )
          ) : (
            <p className="text-xs text-[#52635C] dark:text-[#8FA89E]">{t.updates.noApkUrl}</p>
          )
        )}
      </div>
    </div>
  );
}
