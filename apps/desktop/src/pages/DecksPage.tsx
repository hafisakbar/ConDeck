import { LayoutGrid } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { Panel, PanelBody, PanelHeader } from '../components/ui/Panel';
import { useAppStore } from '../stores/app-store';

export function DecksPage() {
  const summary = useAppStore((state) => state.summary);
  const profiles = useAppStore((state) => state.profiles);
  const activeProfile = profiles.find((profile) => profile.isActive);

  return (
    <div className="space-y-5">
      <Panel>
        <PanelHeader
          title="Deck editor"
          description={
            activeProfile
              ? `Deck of profile "${activeProfile.name}".`
              : 'Create a profile first to attach decks to it.'
          }
          action={<Badge tone="accent">Phase 2</Badge>}
        />
        <EmptyState
          icon={LayoutGrid}
          title="The deck canvas is not implemented yet"
          description="Phase 1 delivers the foundation: SQLite persistence, a secured IPC layer and navigation. The button grid, page management and button editor are built in Phase 2 of the development roadmap."
        />
      </Panel>

      <Panel>
        <PanelHeader title="Stored configuration" description="Data currently held in the local database." />
        <PanelBody>
          <dl className="grid gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-[11px] tracking-wide text-content-subtle uppercase">Profiles</dt>
              <dd className="mt-1 text-lg font-semibold">{summary?.profile.total ?? 0}</dd>
            </div>
            <div>
              <dt className="text-[11px] tracking-wide text-content-subtle uppercase">Decks</dt>
              <dd className="mt-1 text-lg font-semibold">{summary?.deck.total ?? 0}</dd>
            </div>
            <div>
              <dt className="text-[11px] tracking-wide text-content-subtle uppercase">Active profile</dt>
              <dd className="mt-1 text-lg font-semibold">{summary?.profile.active?.name ?? 'None'}</dd>
            </div>
          </dl>
        </PanelBody>
      </Panel>
    </div>
  );
}
