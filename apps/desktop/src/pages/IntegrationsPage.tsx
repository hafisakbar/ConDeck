import { PlugZap } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { Panel, PanelBody, PanelHeader } from '../components/ui/Panel';
import { StatusIndicator } from '../components/ui/StatusIndicator';
import { obsLabelByState, obsToneByState } from '../lib/obs';
import { useAppStore } from '../stores/app-store';

export function IntegrationsPage() {
  const summary = useAppStore((state) => state.summary);

  return (
    <div className="space-y-5">
      <Panel>
        <PanelHeader
          title="OBS Studio"
          description="ConDeck controls OBS Studio through OBS WebSocket v5 (default port 4455)."
          action={<Badge tone="accent">Phase 4</Badge>}
        />
        <PanelBody className="space-y-4">
          <div className="flex items-center justify-between rounded-control border border-border-subtle bg-surface-raised px-4 py-3">
            <div>
              <p className="text-sm font-medium text-content">Connection</p>
              <p className="mt-0.5 text-xs text-content-muted">
                {summary?.obs.message ?? 'Status unavailable'}
              </p>
            </div>
            <StatusIndicator
              tone={summary ? obsToneByState[summary.obs.state] : 'offline'}
              label={summary ? obsLabelByState[summary.obs.state] : 'Unknown'}
            />
          </div>

          <EmptyState
            icon={PlugZap}
            title="OBS connection settings are not implemented yet"
            description="Host, port and password fields, connection testing and the OBS command bridge are implemented in Phase 4. Credentials will be stored with Electron safeStorage, never as plaintext."
          />
        </PanelBody>
      </Panel>
    </div>
  );
}
