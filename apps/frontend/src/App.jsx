import React, { lazy, Suspense, useEffect, useState } from 'react';
import AppLayout from './layouts/AppLayout';
import DashboardPage from './pages/DashboardPage';
import { LoadingState } from './components/WorkspaceUI';
const KnowledgeHubPage = lazy(() => import('./pages/KnowledgeHubPage'));
const VoiceStudioPage = lazy(() => import('./pages/VoiceStudioPage'));
const InsightsPage = lazy(() => import('./pages/InsightsPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const ArchitecturePage = lazy(() => import('./pages/ArchitecturePage'));
const CallHistoryPage = lazy(() => import('./pages/CallHistoryPage'));
const TeamPage = lazy(() => import('./pages/TeamPage'));
const HandoffInboxPage = lazy(() => import('./pages/HandoffInboxPage'));
const OperationsPage = lazy(() => import('./pages/OperationsPage'));
const QAPage = lazy(() => import('./pages/QAPage'));

export default function App() {
  const getInitialTab = () => {
    const path = window.location.pathname.replace('/', '').toLowerCase();
    const search = new URLSearchParams(window.location.search).get('tab');
    const tabs = [
      'dashboard',
      'knowledge',
      'agents',
      'insights',
      'analytics',
      'architecture',
      'history',
      'handoffs',
      'team',
      'operations',
      'qa',
    ];
    if (tabs.includes(search)) return search;
    if (tabs.includes(path)) return path;
    return 'dashboard';
  };

  const [activeTab, setActiveTabState] = useState(getInitialTab);
  const [selectedCallId, setSelectedCallId] = useState(() =>
    new URLSearchParams(window.location.search).get('call')
  );

  useEffect(() => {
    const onPopState = () => {
      setActiveTabState(getInitialTab());
      setSelectedCallId(
        new URLSearchParams(window.location.search).get('call')
      );
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    setSelectedCallId(null);
    window.history.pushState({}, '', `?tab=${tab}`);
  };
  const reviewCall = (callId) => {
    setActiveTabState('history');
    setSelectedCallId(callId);
    const query = new URLSearchParams({ tab: 'history' });
    if (callId) query.set('call', callId);
    window.history.pushState({}, '', `?${query}`);
  };

  return (
    <AppLayout activeTab={activeTab} setActiveTab={setActiveTab}>
      <Suspense
        fallback={
          <div className="page">
            <LoadingState label="Loading page" />
          </div>
        }
      >
        {activeTab === 'dashboard' && (
          <DashboardPage
            setActiveTab={setActiveTab}
            onReviewCall={reviewCall}
          />
        )}
        {activeTab === 'knowledge' && <KnowledgeHubPage />}
        {activeTab === 'agents' && <VoiceStudioPage />}
        {activeTab === 'insights' && <InsightsPage />}
        {activeTab === 'analytics' && <AnalyticsPage />}
        {activeTab === 'architecture' && <ArchitecturePage />}
        {activeTab === 'history' && (
          <CallHistoryPage
            selectedId={selectedCallId}
            onSelectCall={reviewCall}
          />
        )}
        {activeTab === 'handoffs' && (
          <HandoffInboxPage onReviewCall={reviewCall} />
        )}
        {activeTab === 'team' && <TeamPage />}
        {activeTab === 'operations' && <OperationsPage />}
        {activeTab === 'qa' && <QAPage onReviewCall={reviewCall} />}
      </Suspense>
    </AppLayout>
  );
}
