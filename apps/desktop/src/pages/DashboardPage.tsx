import { obsSnapshotMessage } from '@condeck/shared';
import { MonitorPlay, Radio, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { ActivityList } from '../components/activity/ActivityList';
import { ActivityLogDialog } from '../components/activity/ActivityLogDialog';
import { StatCard } from '../components/dashboard/StatCard';
import { ProfileForm } from '../components/profiles/ProfileForm';
import { Button } from '../components/ui/Button';
import { Panel, PanelBody, PanelHeader } from '../components/ui/Panel';
import { StatusIndicator } from '../components/ui/StatusIndicator';
import { useT } from '../i18n';
import { obsToneByState } from '../lib/obs';
import { useAppStore } from '../stores/app-store';
import { useNavigationStore } from '../stores/navigation-store';
import { useObsStore } from '../stores/obs-store';

export function DashboardPage() {
  const t = useT();
  const summary = useAppStore((state) => state.summary);
  const activity = useAppStore((state) => state.activity);
  const obsSnapshot = useObsStore((state) => state.snapshot);
  const setView = useNavigationStore((state) => state.setView);
  const [activityOpen, setActivityOpen] = useState(false);

  if (!summary) {
    return null;
  }

  const isFirstRun = summary.profile.total === 0;
  const obsState = obsSnapshot?.state ?? summary.obs.state;
  const obsDetail = obsSnapshot ? obsSnapshotMessage(obsSnapshot) : (summary.obs.message ?? '');
  const profileCount = summary.profile.total;

  return (
    <div className="space-y-5">
      {isFirstRun ? (
        <Panel className="border-accent/30">
          <PanelHeader title={t('dashboard.welcomeTitle')} description={t('dashboard.welcomeDescription')} />
          <PanelBody className="max-w-md">
            <ProfileForm submitLabel={t('profiles.createProfile')} />
          </PanelBody>
        </Panel>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={MonitorPlay}
          label={t('dashboard.obs')}
          value={t(`obs.${obsState}`)}
          detail={<StatusIndicator tone={obsToneByState[obsState]} label={obsDetail} />}
        />
        <StatCard
          icon={Radio}
          label={t('dashboard.activeProfile')}
          value={summary.profile.active?.name ?? t('common.none')}
          detail={t(profileCount === 1 ? 'dashboard.profilesConfigured' : 'dashboard.profilesConfiguredPlural', {
            count: profileCount,
          })}
        />
        <StatCard
          icon={Smartphone}
          label={t('dashboard.remoteDevices')}
          value={`${summary.devices.online} / ${summary.devices.paired}`}
          detail={t('dashboard.onlinePaired')}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel className="xl:col-span-2">
          <PanelHeader
            title={t('dashboard.recentActivity')}
            description={t('dashboard.recentActivityDescription')}
            action={
              <Button size="sm" variant="ghost" onClick={() => setActivityOpen(true)}>
                {t('common.viewAll')}
              </Button>
            }
          />
          <ActivityList logs={summary.activity} />
        </Panel>

        <Panel>
          <PanelHeader title={t('dashboard.quickActions')} description={t('dashboard.quickActionsDescription')} />
          <PanelBody className="space-y-2">
            <Button className="w-full" onClick={() => setView('decks')}>
              {t('dashboard.openDeck')}
            </Button>
            <Button className="w-full" onClick={() => setView('profiles')}>
              {t('dashboard.manageProfiles')}
            </Button>
            <Button className="w-full" onClick={() => setView('integrations')}>
              {t('dashboard.obsIntegration')}
            </Button>
            <Button className="w-full" onClick={() => setView('devices')}>
              {t('dashboard.pairDevice')}
            </Button>
          </PanelBody>
        </Panel>
      </div>

      <ActivityLogDialog open={activityOpen} initialLogs={activity} onClose={() => setActivityOpen(false)} />
    </div>
  );
}
