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
import { useT } from '../i18n';
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
  const t = useT();
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
    const saved = await saveSettings({
      port: Number.isFinite(parsed) ? parsed : remoteDefaultPort,
      isEnabled: enabled,
    });
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
            {t('devices.dismiss')}
          </Button>
        </div>
      ) : null}

      <Panel>
        <PanelHeader
          title={t('devices.title')}
          description={t('devices.description')}
          action={
            <div className="flex items-center gap-3">
              <StatusIndicator
                tone={serverTone(server?.state)}
                label={
                  server?.state === 'running'
                    ? t('devices.running', { port: server.port })
                    : server?.state === 'starting'
                      ? t('devices.starting')
                      : server?.state === 'error'
                        ? t('devices.attention')
                        : t('devices.stopped')
                }
              />
              <Badge tone="accent">Remote</Badge>
            </div>
          }
        />

        <PanelBody className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-4">
              <Toggle
                label={t('devices.enable')}
                description={t('devices.enableDescription')}
                checked={enabled}
                disabled={busy !== null}
                onChange={setEnabled}
              />
              <Input
                label={t('devices.port')}
                type="number"
                min={1024}
                max={65535}
                value={port}
                disabled={busy !== null}
                hint={t('devices.portHint')}
                onChange={(event) => setPort(event.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  loading={busy === 'save'}
                  disabled={busy !== null && busy !== 'save'}
                  onClick={() => void handleSave()}
                >
                  {t('devices.save')}
                </Button>
                {running ? (
                  <Button
                    loading={busy === 'stop'}
                    disabled={busy !== null && busy !== 'stop'}
                    onClick={() => void stop()}
                  >
                    {t('devices.stopServer')}
                  </Button>
                ) : (
                  <Button
                    icon={<Power className="size-4" aria-hidden />}
                    loading={busy === 'start'}
                    disabled={!server?.isEnabled || (busy !== null && busy !== 'start')}
                    onClick={() => void start()}
                  >
                    {t('devices.startServer')}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  icon={<RefreshCw className="size-4" aria-hidden />}
                  onClick={() => void refresh()}
                >
                  {t('devices.refresh')}
                </Button>
              </div>
            </div>

            <div className="rounded-control border border-border-subtle bg-canvas px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-medium text-content-muted">
                <Wifi className="size-3.5" aria-hidden />
                {t('devices.openOnPhone')}
              </div>
              {server && server.addresses.length > 0 ? (
                <>
                  <ul className="mt-2 space-y-1.5">
                    {server.addresses.map((address, index) => (
                      <li key={address} className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate font-mono text-xs text-content">{address}</span>
                        <span className="flex shrink-0 items-center gap-1">
                          {index === 0 ? <Badge tone="accent">{t('devices.tryFirst')}</Badge> : null}
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Copy className="size-3.5" aria-hidden />}
                            onClick={() => void copyAddress(address)}
                          >
                            {copiedAddress === address ? t('devices.copied') : t('devices.copy')}
                          </Button>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[11px] leading-relaxed text-content-subtle">
                    {t('devices.addressHint')}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-[11px] leading-relaxed text-content-subtle">
                  {running ? t('devices.noAddress') : t('devices.startToSee')}
                </p>
              )}
              <p className="mt-3 text-[11px] leading-relaxed text-content-subtle">
                {t('devices.firewall')}
              </p>
            </div>
          </div>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          title={t('devices.pairTitle')}
          description={t('devices.pairDescription')}
          action={
            running ? (
              <Button
                icon={<Plus className="size-4" aria-hidden />}
                loading={busy === 'pairing'}
                onClick={() => void createPairing()}
              >
                {pairing ? t('devices.newCode') : t('devices.createCode')}
              </Button>
            ) : null
          }
        />

        {!running ? (
          <EmptyState
            icon={Server}
            title={t('devices.stoppedTitle')}
            description={t('devices.stoppedDescription')}
          />
        ) : pairing ? (
          <PanelBody>
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <img
                src={pairing.qrDataUrl}
                alt={t('devices.pairingCode')}
                width={200}
                height={200}
                className="rounded-control border border-border-strong bg-white p-2"
              />
              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <p className="text-xs font-medium text-content-muted">
                    {secondsLeft > 0
                      ? t('devices.validFor', { seconds: secondsLeft })
                      : t('devices.noTimeLeft')}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-content-subtle">
                    {t('devices.codeOnce')}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium text-content-muted">{t('devices.link')}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      readOnly
                      value={pairing.url}
                      aria-label={t('devices.pairingLink')}
                      className="h-9 w-full min-w-0 rounded-control border border-border-strong bg-canvas px-3 font-mono text-[11px] text-content"
                      onFocus={(event) => event.currentTarget.select()}
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Copy className="size-3.5" aria-hidden />}
                      onClick={() => void copyPairingUrl()}
                    >
                      {copied ? t('devices.copied') : t('devices.copy')}
                    </Button>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-content-muted">{t('devices.pairingCode')}</p>
                  <p className="mt-1 font-mono text-xs break-all text-content">{pairing.token}</p>
                </div>
              </div>
            </div>
          </PanelBody>
        ) : (
          <EmptyState
            icon={Smartphone}
            title={t('devices.noPairingTitle')}
            description={t('devices.noPairingDescription')}
          />
        )}
      </Panel>

      <Panel>
        <PanelHeader
          title={t('devices.pairedTitle')}
          description={t('devices.pairedDescription')}
          action={
            <StatusIndicator
              tone={(server?.connectedDevices.length ?? 0) > 0 ? 'online' : 'offline'}
              label={t('devices.connectedCount', {
                count: server?.connectedDevices.length ?? 0,
              })}
            />
          }
        />
        {devices.length === 0 ? (
          <EmptyState
            icon={Smartphone}
            title={t('devices.noDevicesTitle')}
            description={t('devices.noDevicesDescription')}
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
                      {device.deviceType} · {formatDateTime(device.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="text-right">
                      <Badge tone={device.isAuthorized ? (online ? 'success' : 'neutral') : 'danger'}>
                        {device.isAuthorized
                          ? online
                            ? t('obs.CONNECTED')
                            : t('devices.authorised')
                          : t('devices.revoked')}
                      </Badge>
                      <p className="mt-1 text-[11px] text-content-subtle">
                        {device.lastSeenAt
                          ? t('devices.lastSeen', { time: formatRelativeTime(device.lastSeenAt) })
                          : t('devices.neverConnected')}
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
                        {t('devices.revoke')}
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
        title={t('devices.revokeTitle')}
        description={
          pendingRevoke
            ? t('devices.revokeDescription', { name: pendingRevoke.deviceName })
            : undefined
        }
        onClose={() => setPendingRevoke(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingRevoke(null)}>
              {t('common.cancel')}
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
              {t('devices.revokeAccess')}
            </Button>
          </>
        }
      >
        <p className="text-xs leading-relaxed text-content-muted">{t('devices.revokeBody')}</p>
      </Modal>
    </div>
  );
}
