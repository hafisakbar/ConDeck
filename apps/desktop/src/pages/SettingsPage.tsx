import type { ReactNode } from 'react';
import { Badge } from '../components/ui/Badge';
import { Panel, PanelBody, PanelHeader } from '../components/ui/Panel';
import { useAppStore } from '../stores/app-store';

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-border-subtle py-3 last:border-b-0 sm:grid-cols-[180px_1fr] sm:items-baseline sm:gap-4">
      <dt className="text-xs text-content-subtle">{label}</dt>
      <dd className="min-w-0 text-xs break-all text-content">{children}</dd>
    </div>
  );
}

export function SettingsPage() {
  const appInfo = useAppStore((state) => state.appInfo);

  return (
    <div className="space-y-5">
      <Panel>
        <PanelHeader title="About" description="Build information and local storage locations." />
        <PanelBody>
          <dl>
            <InfoRow label="Application">{appInfo ? `${appInfo.name} ${appInfo.version}` : 'Unknown'}</InfoRow>
            <InfoRow label="Platform">{appInfo?.platform ?? 'Unknown'}</InfoRow>
            <InfoRow label="Build">
              {appInfo ? (appInfo.isPackaged ? 'Packaged build' : 'Development build') : 'Unknown'}
            </InfoRow>
            <InfoRow label="Database">{appInfo?.databasePath ?? 'Unknown'}</InfoRow>
            <InfoRow label="Log file">{appInfo?.logPath ?? 'Unknown'}</InfoRow>
          </dl>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          title="General, appearance and network"
          description="These preference sections are part of later phases."
          action={<Badge tone="neutral">Planned</Badge>}
        />
        <PanelBody>
          <p className="text-xs leading-relaxed text-content-muted">
            Remote server port, theme preferences, backup and restore, and storage management are
            not implemented yet. They follow the development roadmap after the deck builder, action
            engine and mobile remote are complete.
          </p>
        </PanelBody>
      </Panel>
    </div>
  );
}
