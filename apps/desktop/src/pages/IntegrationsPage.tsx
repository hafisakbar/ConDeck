import {
  OBS_DEFAULT_HOST,
  OBS_DEFAULT_PORT,
  obsSnapshotMessage,
  saveObsSettingsInputSchema,
  type SaveObsSettingsInput,
} from '@condeck/shared';
import { Cable, ListVideo, Mic, PlugZap, Radio, TriangleAlert, Video } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { Panel, PanelBody, PanelHeader } from '../components/ui/Panel';
import { StatusIndicator } from '../components/ui/StatusIndicator';
import { Toggle } from '../components/ui/Toggle';
import { obsLabelByState, obsToneByState } from '../lib/obs';
import { useObsStore } from '../stores/obs-store';

export function IntegrationsPage() {
  const snapshot = useObsStore((state) => state.snapshot);
  const busy = useObsStore((state) => state.busy);
  const error = useObsStore((state) => state.error);
  const testResult = useObsStore((state) => state.testResult);
  const saveSettings = useObsStore((state) => state.saveSettings);
  const connect = useObsStore((state) => state.connect);
  const disconnect = useObsStore((state) => state.disconnect);
  const testConnection = useObsStore((state) => state.testConnection);
  const dismissTestResult = useObsStore((state) => state.dismissTestResult);
  const dismissError = useObsStore((state) => state.dismissError);

  const [host, setHost] = useState(snapshot?.host ?? OBS_DEFAULT_HOST);
  const [port, setPort] = useState(String(snapshot?.port ?? OBS_DEFAULT_PORT));
  const [password, setPassword] = useState('');
  const [isEnabled, setIsEnabled] = useState(snapshot?.isEnabled ?? true);
  const [formError, setFormError] = useState<string | null>(null);

  // Only re-seed the form when the saved address changes, so live OBS pushes do
  // not overwrite what the user is currently typing.
  useEffect(() => {
    if (!snapshot) {
      return;
    }
    setHost(snapshot.host ?? OBS_DEFAULT_HOST);
    setPort(String(snapshot.port ?? OBS_DEFAULT_PORT));
    setIsEnabled(snapshot.isEnabled);
    setPassword('');
  }, [snapshot?.host, snapshot?.port, snapshot?.isEnabled]);

  const isConnected = snapshot?.state === 'CONNECTED';
  const isConfigured = snapshot !== null && snapshot.state !== 'NOT_CONFIGURED';
  const working = busy !== null;

  function readForm(): SaveObsSettingsInput | null {
    const candidate: SaveObsSettingsInput = {
      host: host.trim(),
      port: Number(port),
      isEnabled,
      ...(password.length > 0 ? { password } : {}),
    };
    const parsed = saveObsSettingsInputSchema.safeParse(candidate);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Check the form and try again.');
      return null;
    }
    setFormError(null);
    return parsed.data;
  }

  async function handleSave(clearPassword = false) {
    const input = readForm();
    if (!input) {
      return;
    }
    await saveSettings(clearPassword ? { ...input, password: '' } : input);
  }

  async function handleTest() {
    const input = readForm();
    if (!input) {
      return;
    }
    await testConnection(input);
  }

  return (
    <div className="space-y-5">
      {error ? (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-panel border border-danger/40 bg-danger-soft px-4 py-3 text-xs text-danger"
        >
          <span className="flex items-start gap-2">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {error}
          </span>
          <button type="button" className="font-medium underline" onClick={dismissError}>
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel>
          <PanelHeader
            title="OBS Studio"
            description="Connect ConDeck to OBS through OBS WebSocket v5. Enable it in OBS under Tools → WebSocket Server Settings."
            action={<Badge tone="accent">Phase 4</Badge>}
          />
          <PanelBody className="space-y-4">
            <div className="rounded-control border border-border-subtle bg-surface-raised px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-content">Connection</p>
                  <p className="mt-0.5 text-xs break-words text-content-muted">
                    {snapshot ? obsSnapshotMessage(snapshot) : 'Loading OBS status…'}
                  </p>
                </div>
                <StatusIndicator
                  tone={snapshot ? obsToneByState[snapshot.state] : 'offline'}
                  label={snapshot ? obsLabelByState[snapshot.state] : 'Unknown'}
                />
              </div>

              {isConnected ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge tone="neutral">
                    <ListVideo className="size-3" aria-hidden />
                    {snapshot.sceneName ?? 'No scene'}
                  </Badge>
                  <Badge tone={snapshot.isStreaming ? 'danger' : 'neutral'}>
                    <Radio className="size-3" aria-hidden />
                    {snapshot.isStreaming ? 'Streaming' : 'Stream idle'}
                  </Badge>
                  <Badge tone={snapshot.isRecording ? 'danger' : 'neutral'}>
                    <Video className="size-3" aria-hidden />
                    {snapshot.isRecording ? 'Recording' : 'Recording idle'}
                  </Badge>
                  <Badge tone={snapshot.hasPassword ? 'success' : 'neutral'}>
                    <Mic className="size-3" aria-hidden />
                    {snapshot.hasPassword ? 'Password saved' : 'No password'}
                  </Badge>
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <Input
                label="Host"
                value={host}
                placeholder={OBS_DEFAULT_HOST}
                hint="Usually 127.0.0.1 when OBS runs on this computer."
                onChange={(event) => setHost(event.target.value)}
              />
              <Input
                label="Port"
                type="number"
                min={1}
                max={65535}
                value={port}
                hint={`Default: ${OBS_DEFAULT_PORT}`}
                onChange={(event) => setPort(event.target.value)}
              />
            </div>

            <Input
              label="Password"
              type="password"
              value={password}
              autoComplete="off"
              placeholder={snapshot?.hasPassword ? 'Saved password — leave blank to keep' : 'Optional'}
              hint="Stored with the Windows/macOS credential store through Electron safeStorage, never as plaintext."
              onChange={(event) => setPassword(event.target.value)}
            />

            <Toggle
              label="Enable OBS integration"
              description="Turn this off to keep the settings but block every OBS action."
              checked={isEnabled}
              onChange={setIsEnabled}
            />

            {formError ? <p className="text-xs text-danger">{formError}</p> : null}

            {testResult ? (
              <div
                role="status"
                className={
                  testResult.ok
                    ? 'flex items-start justify-between gap-3 rounded-control border border-success/40 bg-success/10 px-3 py-2 text-[11px] text-success'
                    : 'flex items-start justify-between gap-3 rounded-control border border-danger/40 bg-danger-soft px-3 py-2 text-[11px] text-danger'
                }
              >
                <span>{testResult.message}</span>
                <button type="button" className="font-medium underline" onClick={dismissTestResult}>
                  Close
                </button>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 border-t border-border-subtle pt-4">
              <Button
                variant="primary"
                loading={busy === 'save'}
                disabled={working}
                onClick={() => void handleSave()}
              >
                Save settings
              </Button>
              <Button
                loading={busy === 'test'}
                disabled={working}
                icon={<Cable className="size-3.5" aria-hidden />}
                onClick={() => void handleTest()}
              >
                Test connection
              </Button>
              {isConnected ? (
                <Button
                  variant="danger"
                  loading={busy === 'disconnect'}
                  disabled={working}
                  onClick={() => void disconnect()}
                >
                  Disconnect
                </Button>
              ) : (
                <Button
                  loading={busy === 'connect'}
                  disabled={working || !isConfigured || !isEnabled}
                  onClick={() => void connect()}
                >
                  Connect
                </Button>
              )}
              {snapshot?.hasPassword ? (
                <Button
                  variant="ghost"
                  disabled={working}
                  onClick={() => void handleSave(true)}
                >
                  Remove saved password
                </Button>
              ) : null}
            </div>

            {!isConfigured ? (
              <p className="text-[11px] text-content-subtle">
                Save the host and port once, then Connect becomes available.
              </p>
            ) : null}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            title="Scenes"
            description="Fetched from OBS. Switch-scene actions can pick any of them."
          />
          {isConnected && snapshot.scenes.length > 0 ? (
            <ul className="divide-y divide-border-subtle">
              {snapshot.scenes.map((scene) => (
                <li
                  key={scene}
                  className="flex items-center justify-between gap-3 px-5 py-3 text-xs text-content"
                >
                  <span className="truncate">{scene}</span>
                  {scene === snapshot.sceneName ? <Badge tone="success">Live</Badge> : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={PlugZap}
              title={isConnected ? 'OBS reports no scenes' : 'Not connected'}
              description={
                isConnected
                  ? 'Create a scene in OBS and it will appear here automatically.'
                  : 'Connect to OBS to load the scene list. Until then, OBS actions report “OBS is not connected”.'
              }
            />
          )}
        </Panel>
      </div>
    </div>
  );
}
