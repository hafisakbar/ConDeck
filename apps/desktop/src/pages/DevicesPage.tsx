import {
  Copy,
  Plus,
  Power,
  RefreshCw,
  Server,
  ShieldOff,
  Smartphone,
  Wifi,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { remoteDefaultPort, type Device } from '@condeck/shared';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Panel, PanelBody, PanelHeader } from '../components/ui/Panel';
import { StatusIndicator } from '../components/ui/StatusIndicator';
import { Toggle } from '../components/ui/Toggle';
import { formatDateTime, formatRelativeTime } from '../lib/format';
import { useRemoteStore } from '../stores/remote-store';

function useNow(intervalMs = 1_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function serverTone(state: string | undefined): 'online' | 'warning' | 'offline' | 'danger' {
  if (state === 'running') {
    return 'online';
  }
  if (state === 'starting') {
    return 'warning';
  }
  if (state === 'error') {
    return 'danger';
  }
  return 'offline';
}

export function DevicesPage() {
  const server = useRemoteStore((state) => state.server);
  const devices = useRemoteStore((state) => state.devices);
  const error = useRemoteStore((state) => state.error);
  const busy = useRemoteStore((state) => state.busy);
  const initialize = useRemoteStore((state) => state.initialize);
  const refresh = useRemoteStore((state) => state.refresh);
  const saveSettings = useRemoteStore((state) => state.saveSettings);
  const start = useRemoteStore((state) => state.start);
  const stop = useRemoteStore((state) => state.stop);
  const createPairing = useRemoteStore((state) => state.createPairing);
  const revokeDevice = useRemoteStore((state) => state.revokeDevice);
  const dismissError = useRemoteStore((state) => state.dismissError);

  const [port, setPort] = useState(String(server?.port ?? remoteDefaultPort));
  const [enabled, setEnabled] = useState(server?.isEnabled ?? true);
  const [syncedKey, setSyncedKey] = useState<string | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState<Device | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const now = useNow();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    if (!server) {
      return;
    }
    const key = `${server.port}:${server.isEnabled}`;
    if (key === syncedKey) {
      return;
    }
    setSyncedKey(key);
    setPort(String(server.port));
    setEnabled(server.isEnabled);
  }, [server, syncedKey]);

  const running = server?.state === 'running';
  const pairing = server?.pairing ?? null;
  const secondsLeft = pairing
    ? Math.max(0, Math.ceil((Date.parse(pairing.expiresAt) - now) / 1000))
    : 0;

  async function handleSave(): Promise<void> {
    const parsed = Number(port);
    const saved = await saveSettings({ port: Number.isFinite(parsed) ? parsed : remoteDefaultPort, isEnabled: enabled });
    if (saved) {
      await refresh();
    }
  }

  async function copyAddress(address: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      setTimeout(() => setCopiedAddress(null), 1_500);
    } catch {
      setCopiedAddress(null);
    }
  }

  async function copyPairingUrl(): Promise<void> {
    if (!pairing) {
      return;
    }
    try {
      await navigator.clipboard.writeText(pairing.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1_500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-5">
      {error ? (
        <div className="flex items-start justify-between gap-4 rounded-panel border border-danger/40 bg-danger-soft px-4 py-3">
          <p className="text-xs text-danger">{error}</p>
          <Button variant="ghost" size="sm" onClick={dismissError}>
            Dismiss
          </Button>
        </div>
      ) : null}

      <Panel>
        <PanelHeader
          title="Remote server"
          description="Lets a phone on your local network control this deck. Nothing is exposed to the internet."
          action={
            <div className="flex items-center gap-3">
              <StatusIndicator
                tone={serverTone(server?.state)}
                label={
                  server?.state === 'running'
                    ? `Running on port ${server.port}`
                    : server?.state === 'starting'
                      ? 'Starting'
                      : server?.state === 'error'
                        ? 'Needs attention'
                        : 'Stopped'
                }
              />
              <Badge tone="accent">Phase 5</Badge>
            </div>
          }
        />

        <PanelBody className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-4">
              <Toggle
                label="Enable the mobile remote"
                description="The server starts with ConDeck when this is on."
                checked={enabled}
                disabled={busy !== null}
                onChange={setEnabled}
              />
              <Input
                label="Port"
                type="number"
                min={1024}
                max={65535}
                value={port}
                disabled={busy !== null}
                hint="Default 43821. Change it if another program already uses that port."
                onChange={(event) => setPort(event.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  loading={busy === 'save'}
                  disabled={busy !== null && busy !== 'save'}
                  onClick={() => void handleSave()}
                >
                  Save settings
                </Button>
                {running ? (
                  <Button
                    loading={busy === 'stop'}
                    disabled={busy !== null && busy !== 'stop'}
                    onClick={() => void stop()}
                  >
                    Stop server
                  </Button>
                ) : (
                  <Button
                    icon={<Power className="size-4" aria-hidden />}
                    loading={busy === 'start'}
                    disabled={!server?.isEnabled || (busy !== null && busy !== 'start')}
                    onClick={() => void start()}
                  >
                    Start server
                  </Button>
                )}
                <Button
                  variant="ghost"
                  icon={<RefreshCw className="size-4" aria-hidden />}
                  onClick={() => void refresh()}
                >
                  Refresh
                </Button>
              </div>
            </div>

            <div className="rounded-control border border-border-subtle bg-canvas px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-medium text-content-muted">
                <Wifi className="size-3.5" aria-hidden />
                Open on your phone
              </div>
              {server && server.addresses.length > 0 ? (
                <>
                  <ul className="mt-2 space-y-1.5">
                    {server.addresses.map((address, index) => (
                      <li key={address} className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate font-mono text-xs text-content">{address}</span>
                        <span className="flex shrink-0 items-center gap-1">
                          {index === 0 ? <Badge tone="accent">Try first</Badge> : null}
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Copy className="size-3.5" aria-hidden />}
                            onClick={() => void copyAddress(address)}
                          >
                            {copiedAddress === address ? 'Copied' : 'Copy'}
                          </Button>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[11px] leading-relaxed text-content-subtle">
                    The pairing code uses the first address. If the phone times out, try the next
                    one: adapters such as VirtualBox, Hyper-V or a VPN appear in this list but a
                    phone cannot reach them.
                  </p>
                </>
              ) : (
                <p className="mt-2 text-[11px] leading-relaxed text-content-subtle">
                  {running
                    ? 'No local network address was found. Connect this PC to Wi-Fi or Ethernet, then restart the server.'
                    : 'Start the server to see the address your phone should open.'}
                </p>
              )}
              <p className="mt-3 text-[11px] leading-relaxed text-content-subtle">
                The phone must be on the same Wi-Fi or hotspot. If the page will not open, allow
                ConDeck through Windows Firewall for private networks and turn off client isolation
                on the router. Plain HTTP is used on the LAN, so only pair devices you trust.
              </p>
            </div>
          </div>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          title="Pair a phone"
          description="Scan the code with the phone camera, then confirm the connection on the phone."
          action={
            running ? (
              <Button
                icon={<Plus className="size-4" aria-hidden />}
                loading={busy === 'pairing'}
                onClick={() => void createPairing()}
              >
                {pairing ? 'New code' : 'Create pairing code'}
              </Button>
            ) : null
          }
        />

        {!running ? (
          <EmptyState
            icon={Server}
            title="Remote server is stopped"
            description="Start the server above before pairing a phone."
          />
        ) : pairing ? (
          <PanelBody>
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <img
                src={pairing.qrDataUrl}
                alt="Pairing QR code"
                width={200}
                height={200}
                className="rounded-control border border-border-strong bg-white p-2"
              />
              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <p className="text-xs font-medium text-content-muted">
                    Valid for {secondsLeft > 0 ? `${secondsLeft} more seconds` : 'no time left'}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-content-subtle">
                    The code works once. A new code replaces the previous one immediately.
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium text-content-muted">Link</p>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      readOnly
                      value={pairing.url}
                      aria-label="Pairing link"
                      className="h-9 w-full min-w-0 rounded-control border border-border-strong bg-canvas px-3 font-mono text-[11px] text-content"
                      onFocus={(event) => event.currentTarget.select()}
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Copy className="size-3.5" aria-hidden />}
                      onClick={() => void copyPairingUrl()}
                    >
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-content-muted">Pairing code</p>
                  <p className="mt-1 font-mono text-xs break-all text-content">{pairing.token}</p>
                </div>
              </div>
            </div>
          </PanelBody>
        ) : (
          <EmptyState
            icon={Smartphone}
            title="No active pairing code"
            description="Create a code, then scan it with the phone camera to open ConDeck Remote."
          />
        )}
      </Panel>

      <Panel>
        <PanelHeader
          title="Paired devices"
          description="Devices authorised to control this ConDeck instance."
          action={
            <StatusIndicator
              tone={(server?.connectedDevices.length ?? 0) > 0 ? 'online' : 'offline'}
              label={`${server?.connectedDevices.length ?? 0} connected`}
            />
          }
        />
        {devices.length === 0 ? (
          <EmptyState
            icon={Smartphone}
            title="No devices paired"
            description="Pair a phone above. Each device gets its own credential, which you can revoke at any time."
          />
        ) : (
          <ul className="divide-y divide-border-subtle">
            {devices.map((device) => {
              const online = server?.connectedDevices.some((entry) => entry.deviceId === device.id);
              return (
                <li key={device.id} className="flex items-start justify-between gap-4 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-content">{device.deviceName}</p>
                    <p className="mt-0.5 text-xs text-content-muted">
                      {device.deviceType} · paired {formatDateTime(device.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="text-right">
                      <Badge tone={device.isAuthorized ? (online ? 'success' : 'neutral') : 'danger'}>
                        {device.isAuthorized ? (online ? 'Connected' : 'Authorised') : 'Revoked'}
                      </Badge>
                      <p className="mt-1 text-[11px] text-content-subtle">
                        {device.lastSeenAt
                          ? `Last seen ${formatRelativeTime(device.lastSeenAt)}`
                          : 'Never connected'}
                      </p>
                    </div>
                    {device.isAuthorized ? (
                      <Button
                        variant="danger"
                        size="sm"
                        icon={<ShieldOff className="size-3.5" aria-hidden />}
                        disabled={busy !== null}
                        onClick={() => setPendingRevoke(device)}
                      >
                        Revoke
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Modal
        open={pendingRevoke !== null}
        title="Revoke this device?"
        description={
          pendingRevoke
            ? `"${pendingRevoke.deviceName}" will be disconnected and must be paired again to control ConDeck.`
            : undefined
        }
        onClose={() => setPendingRevoke(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingRevoke(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busy === 'revoke'}
              onClick={() => {
                const device = pendingRevoke;
                setPendingRevoke(null);
                if (device) {
                  void revokeDevice(device.id);
                }
              }}
            >
              Revoke access
            </Button>
          </>
        }
      >
        <p className="text-xs leading-relaxed text-content-muted">
          The pairing code is not affected. To let this phone back in, create a new pairing code and
          scan it again.
        </p>
      </Modal>
    </div>
  );
}
