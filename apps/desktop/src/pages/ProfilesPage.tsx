import { Layers } from 'lucide-react';
import { ProfileForm } from '../components/profiles/ProfileForm';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Panel, PanelBody, PanelHeader } from '../components/ui/Panel';
import { formatDateTime } from '../lib/format';
import { useAppStore } from '../stores/app-store';

export function ProfilesPage() {
  const profiles = useAppStore((state) => state.profiles);
  const busyProfileId = useAppStore((state) => state.busyProfileId);
  const activateProfile = useAppStore((state) => state.activateProfile);

  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <Panel className="xl:col-span-2">
        <PanelHeader
          title="Profiles"
          description="The active profile supplies the deck used by desktop and mobile."
        />
        {profiles.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No profiles yet"
            description="Create your first profile to start organising decks."
          />
        ) : (
          <ul className="divide-y divide-border-subtle">
            {profiles.map((profile) => (
              <li key={profile.id} className="flex items-start justify-between gap-4 px-5 py-3.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-content">{profile.name}</p>
                    {profile.isActive ? <Badge tone="success">Active</Badge> : null}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-content-muted">
                    {profile.description ?? 'No description'}
                  </p>
                  <p className="mt-1 text-[11px] text-content-subtle">
                    Created {formatDateTime(profile.createdAt)}
                  </p>
                </div>
                <Button
                  size="sm"
                  disabled={profile.isActive}
                  loading={busyProfileId === profile.id}
                  onClick={() => void activateProfile(profile.id)}
                >
                  {profile.isActive ? 'In use' : 'Set active'}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <PanelHeader title="New profile" description="Each profile keeps its own deck and pages." />
        <PanelBody>
          <ProfileForm submitLabel="Create profile" />
        </PanelBody>
      </Panel>
    </div>
  );
}
