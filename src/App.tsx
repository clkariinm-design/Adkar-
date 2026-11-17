import React from 'react';
import { AppProvider, useApp } from './contexts/AppContext';
import { Layout } from './components/Layout';
import { WelcomeScreen } from './components/WelcomeScreen';
import { HomeDashboard } from './components/HomeDashboard';
import { QuranView } from './components/QuranView';
import { AdhkarView } from './components/AdhkarView';
import { TasbihView } from './components/TasbihView';
import { AccountAndRemindersView } from './components/AccountAndRemindersView';
import { MaintenanceScreen } from './components/MaintenanceScreen';
import { UpdatePromptModal } from './components/UpdatePromptModal';

function MainViews() {
  const { activeTab, session, authLoading, maintenanceMode, t } = useApp();

  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[#FAF8F3] text-[#064E3B] dark:bg-[#071410] dark:text-[#34D399]">
        <span className="font-display text-3xl font-bold tracking-tight">{t.appName}</span>
        <span className="text-xs text-[#52635C] dark:text-[#8FA89E]">{t.common.loading}</span>
      </div>
    );
  }

  if (maintenanceMode) {
    return <MaintenanceScreen />;
  }

  if (!session) {
    return <WelcomeScreen />;
  }

  return (
    <>
      <Layout>
        {activeTab === 'home' && <HomeDashboard />}
        {activeTab === 'quran' && <QuranView />}
        {activeTab === 'adhkar' && <AdhkarView />}
        {activeTab === 'tasbih' && <TasbihView />}
        {activeTab === 'account' && <AccountAndRemindersView />}
      </Layout>
      <UpdatePromptModal />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainViews />
    </AppProvider>
  );
}
