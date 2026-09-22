import React, { useState } from 'react';
import AppLayout from './layouts/AppLayout';
import DashboardPage from './pages/DashboardPage';
import KnowledgeHubPage from './pages/KnowledgeHubPage';
import VoiceStudioPage from './pages/VoiceStudioPage';
import InsightsPage from './pages/InsightsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ArchitecturePage from './pages/ArchitecturePage';

export default function App() {
  const getInitialTab = () => {
    const path = window.location.pathname.replace('/', '').toLowerCase();
    const search = new URLSearchParams(window.location.search).get('tab');
    if (['dashboard', 'knowledge', 'agents', 'insights', 'analytics', 'architecture'].includes(path)) return path;
    if (['dashboard', 'knowledge', 'agents', 'insights', 'analytics', 'architecture'].includes(search)) return search;
    return 'dashboard';
  };

  const [activeTab, setActiveTabState] = useState(getInitialTab);

  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    window.history.pushState({}, '', `?tab=${tab}`);
  };

  return (
    <AppLayout activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === 'dashboard' && <DashboardPage activeTab={activeTab} setActiveTab={setActiveTab} />}
      {activeTab === 'knowledge' && <KnowledgeHubPage />}
      {activeTab === 'agents' && <VoiceStudioPage />}
      {activeTab === 'insights' && <InsightsPage />}
      {activeTab === 'analytics' && <AnalyticsPage />}
      {activeTab === 'architecture' && <ArchitecturePage />}
    </AppLayout>
  );
}


