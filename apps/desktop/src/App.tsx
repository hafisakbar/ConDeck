import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, type ComponentType } from 'react';
import { BootScreen } from './components/layout/BootScreen';
import { Sidebar } from './components/layout/Sidebar';
import { StartupErrorScreen } from './components/layout/StartupErrorScreen';
import { TopBar } from './components/layout/TopBar';
import type { ViewId } from './lib/navigation';
import { ActivityPage } from './pages/ActivityPage';
import { DashboardPage } from './pages/DashboardPage';
import { DecksPage } from './pages/DecksPage';
import { DevicesPage } from './pages/DevicesPage';
import { IntegrationsPage } from './pages/IntegrationsPage';
import { ProfilesPage } from './pages/ProfilesPage';
import { SettingsPage } from './pages/SettingsPage';
import { useAppStore } from './stores/app-store';
import { useNavigationStore } from './stores/navigation-store';

const viewComponents: Record<ViewId, ComponentType> = {
  dashboard: DashboardPage,
  decks: DecksPage,
  profiles: ProfilesPage,
  integrations: IntegrationsPage,
  devices: DevicesPage,
  activity: ActivityPage,
  settings: SettingsPage,
};

export default function App() {
  const status = useAppStore((state) => state.status);
  const error = useAppStore((state) => state.error);
  const refresh = useAppStore((state) => state.refresh);
  const view = useNavigationStore((state) => state.view);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (status === 'loading') {
    return <BootScreen />;
  }

  if (status === 'error') {
    return <StartupErrorScreen message={error ?? 'Unknown error.'} onRetry={() => void refresh()} />;
  }

  const Page = viewComponents[view];

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-8 py-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
            >
              <Page />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
