import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState, type ComponentType } from 'react';
import { BootScreen } from './components/layout/BootScreen';
import { NavigationDrawer } from './components/layout/NavigationDrawer';
import { StartupErrorScreen } from './components/layout/StartupErrorScreen';
import { TopBar } from './components/layout/TopBar';
import { cn } from './lib/cn';
import type { ViewId } from './lib/navigation';
import { ActivityPage } from './pages/ActivityPage';
import { DashboardPage } from './pages/DashboardPage';
import { DevicesPage } from './pages/DevicesPage';
import { IntegrationsPage } from './pages/IntegrationsPage';
import { ProfilesPage } from './pages/ProfilesPage';
import { SettingsPage } from './pages/SettingsPage';
import { StreamDeckPage } from './pages/StreamDeckPage';
import { useAppStore } from './stores/app-store';
import { useNavigationStore } from './stores/navigation-store';
import { useObsStore } from './stores/obs-store';

const viewComponents: Record<ViewId, ComponentType> = {
  dashboard: DashboardPage,
  decks: StreamDeckPage,
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
  const initializeObs = useObsStore((state) => state.initialize);
  const view = useNavigationStore((state) => state.view);
  const setView = useNavigationStore((state) => state.setView);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void initializeObs();
  }, [initializeObs]);

  if (status === 'loading') {
    return <BootScreen />;
  }

  if (status === 'error') {
    return <StartupErrorScreen message={error ?? 'Unknown error.'} onRetry={() => void refresh()} />;
  }

  const Page = viewComponents[view];
  const deviceView = view === 'decks';

  return (
    <div className="relative flex h-screen flex-col overflow-hidden">
      <TopBar onOpenMenu={() => setMenuOpen(true)} />

      <NavigationDrawer
        open={menuOpen}
        view={view}
        onSelect={setView}
        onClose={() => setMenuOpen(false)}
      />

      <main
        className={cn(
          'min-h-0 flex-1',
          deviceView ? 'overflow-hidden' : 'overflow-y-auto px-8 pt-2 pb-8',
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={view}
            className={deviceView ? 'h-full' : undefined}
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
  );
}
