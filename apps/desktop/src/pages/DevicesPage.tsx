import { Smartphone } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { Panel, PanelBody, PanelHeader } from '../components/ui/Panel';
import { StatusIndicator } from '../components/ui/StatusIndicator';
import { formatDateTime, formatRelativeTime } from '../lib/format';
import { useAppStore } from '../stores/app-store';

export function DevicesPage() {
  const devices = useAppStore((state) => state.devices);
  const summary = useAppStore((state) => state.summary);

  return (
    <div className="space-y-5">
      <Panel>
        <PanelHeader
          title="Paired devices"
          description="Devices authorised to control this ConDeck instance."
          action={
            <div className="flex items-center gap-3">
              <StatusIndicator
                tone={(summary?.devices.online ?? 0) > 0 ? 'online' : 'offline'}
                label={`${summary?.devices.online ?? 0} online`}
              />
              <Badge tone="accent">Phase 5</Badge>
            </div>
          }
        />
        {devices.length === 0 ? (
          <EmptyState
            icon={Smartphone}
            title="No devices paired"
            description="QR pairing, device authentication and the local WebSocket server arrive in Phase 5. Until then no remote can connect, so this list stays empty."
          />
        ) : (
          <ul className="divide-y divide-border-subtle">
            {devices.map((device) => (
              <li key={device.id} className="flex items-start justify-between gap-4 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-content">{device.deviceName}</p>
                  <p className="mt-0.5 text-xs text-content-muted">
                    {device.deviceType} · paired {formatDateTime(device.createdAt)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <Badge tone={device.isAuthorized ? 'success' : 'danger'}>
                    {device.isAuthorized ? 'Authorised' : 'Revoked'}
                  </Badge>
                  <p className="mt-1 text-[11px] text-content-subtle">
                    {device.lastSeenAt ? `Last seen ${formatRelativeTime(device.lastSeenAt)}` : 'Never connected'}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <PanelHeader title="Network" description="Where the remote server will listen." />
        <PanelBody>
          <p className="text-xs leading-relaxed text-content-muted">
            ConDeck will host its WebSocket server on port 43821 by default (configurable). Remote
            devices must be on the same local network and authenticate with a short-lived pairing
            token before they can press a button.
          </p>
        </PanelBody>
      </Panel>
    </div>
  );
}
