import { LayoutGrid, MonitorPlay, Radio, Smartphone } from 'lucide-react';
import { ActivityList } from '../components/activity/ActivityList';
import { StatCard } from '../components/dashboard/StatCard';
import { ProfileForm } from '../components/profiles/ProfileForm';
import { Button } from '../components/ui/Button';
import { Panel, PanelBody, PanelHeader } from '../components/ui/Panel';
import { StatusIndicator } from '../components/ui/StatusIndicator';
import { obsLabelByState, obsToneByState } from '../lib/obs';
import { obsSnapshotMessage } from '@condeck/shared';
import { useAppStore } from '../stores/app-store';
import { useNavigationStore } from '../stores/navigation-store';
import { useObsStore } from '../stores/obs-store';

export function DashboardPage() {
  const summary = useAppStore((state) => state.summary);
  const obsSnapshot = useObsStore((state) => state.snapshot);
  const setView = useNavigationStore((state) => state.setView);

  if (!summary) {
    return null;
  }

  const isFirstRun = summary.profile.total === 0;
  const obsState = obsSnapshot?.state ?? summary.obs.state;
  const obsDetail = obsSnapshot
    ? obsSnapshotMessage(obsSnapshot)
    : (summary.obs.message ?? 'Ready');

  return (
    <div className="space-y-5">
      {isFirstRun ? (
        <Panel className="border-accent/30">
          <PanelHeader
            title="Welcome to ConDeck"
            description="Create your first profile. Profiles keep separate decks for streaming, gaming or anything else."
          />
          <PanelBody className="max-w-md">
            <ProfileForm submitLabel="Create profile" autoFocus />
          </PanelBody>
        </Panel>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={MonitorPlay}
          label="OBS Studio"
          value={obsLabelByState[obsState]}
          detail={<StatusIndicator tone={obsToneByState[obsState]} label={obsDetail} />}
        />
        <StatCard
          icon={Radio}
          label="Active profile"
          value={summary.profile.active?.name ?? 'None'}
          detail={`${summary.profile.total} profile${summary.profile.total === 1 ? '' : 's'} configured`}
        />
        <StatCard
          icon={LayoutGrid}
          label="Decks"
          value={String(summary.deck.total)}
          detail="Build your grid in My Deck"
        />
        <StatCard
          icon={Smartphone}
          label="Remote devices"
          value={`${summary.devices.online} / ${summary.devices.paired}`}
          detail="online / paired"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel className="xl:col-span-2">
          <PanelHeader
            title="Recent activity"
            description="Latest events recorded by ConDeck."
            action={
              <Button size="sm" variant="ghost" onClick={() => setView('activity')}>
                View all
              </Button>
            }
          />
          <ActivityList logs={summary.activity} />
        </Panel>

        <Panel>
          <PanelHeader title="Quick actions" description="Jump straight to the next step." />
          <PanelBody className="space-y-2">
            <Button className="w-full" onClick={() => setView('decks')}>
              Open My Deck
            </Button>
            <Button className="w-full" onClick={() => setView('profiles')}>
              Manage profiles
            </Button>
            <Button className="w-full" onClick={() => setView('integrations')}>
              OBS integration
            </Button>
            <Button className="w-full" onClick={() => setView('devices')}>
              Pair a remote device
            </Button>
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}
