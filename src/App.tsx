import React from 'react';
import { AppProvider, useApp } from './contexts/AppContext';
import { Layout } from './components/Layout';
import { HomeDashboard } from './components/HomeDashboard';
import { QuranView } from './components/QuranView';
import { AdhkarView } from './components/AdhkarView';
import { TasbihView } from './components/TasbihView';
import { AccountAndRemindersView } from './components/AccountAndRemindersView';

function MainViews() {
  const { activeTab } = useApp();

  return (
    <Layout>
      {activeTab === 'home' && <HomeDashboard />}
      {activeTab === 'quran' && <QuranView />}
      {activeTab === 'adhkar' && <AdhkarView />}
      {activeTab === 'tasbih' && <TasbihView />}
      {activeTab === 'account' && <AccountAndRemindersView />}
    </Layout>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainViews />
    </AppProvider>
  );
}
