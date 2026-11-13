import {
  OBS_DEFAULT_HOST,
  OBS_DEFAULT_PORT,
  saveObsSettingsInputSchema,
  type SaveObsSettingsInput,
} from '@condeck/shared';
import { Cable, ListVideo, Mic, PlugZap, Radio, TriangleAlert, Video, MonitorPlay } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { Panel, PanelBody, PanelHeader } from '../components/ui/Panel';
import { StatusIndicator } from '../components/ui/StatusIndicator';
import { Toggle } from '../components/ui/Toggle';
import { useT } from '../i18n';
import { cn } from '../lib/cn';
import { obsToneByState } from '../lib/obs';
import { useObsStore } from '../stores/obs-store';
import { useTikTokStore } from '../stores/tiktok-store';
import { tiktokSnapshotMessage } from '@condeck/shared';

export function IntegrationsPage() {
  const t = useT();
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

  const tiktokSnapshot = useTikTokStore((state) => state.snapshot);
  const tiktokBusy = useTikTokStore((state) => state.busy);
  const tiktokError = useTikTokStore((state) => state.error);
  const tiktokTestResult = useTikTokStore((state) => state.testResult);
  const saveTikTokSettings = useTikTokStore((state) => state.saveSettings);
  const connectTikTok = useTikTokStore((state) => state.connect);
  const disconnectTikTok = useTikTokStore((state) => state.disconnect);
  const testTikTokConnection = useTikTokStore((state) => state.testConnection);
  const dismissTikTokTestResult = useTikTokStore((state) => state.dismissTestResult);
  const dismissTikTokError = useTikTokStore((state) => state.dismissError);

  const tiktokConnected = tiktokSnapshot?.state === 'CONNECTED';
  const tiktokWorking = tiktokBusy !== null;

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
      setFormError(parsed.error.issues[0]?.message ?? t('integrations.formHint'));
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
            {t('integrations.dismiss')}
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel>
          <PanelHeader
            title="OBS Studio"
            description={t('integrations.obsDescription')}
            action={<Badge tone="accent">OBS</Badge>}
          />
          <PanelBody className="space-y-4">
            <div className="rounded-control border border-border-subtle bg-surface-raised px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-content">{t('integrations.connection')}</p>
                  <p className="mt-0.5 text-xs break-words text-content-muted">
                    {snapshot
                      ? t(`obs.${snapshot.state}`)
                      : t('integrations.loadingStatus')}
                  </p>
                </div>
                <StatusIndicator
                  tone={snapshot ? obsToneByState[snapshot.state] : 'offline'}
                  label={snapshot ? t(`obs.${snapshot.state}`) : t('integrations.unknown')}
                />
              </div>

              {isConnected ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge tone="neutral">
                    <ListVideo className="size-3" aria-hidden />
                    {snapshot.sceneName ?? t('integrations.noScene')}
                  </Badge>
                  <Badge tone={snapshot.isStreaming ? 'danger' : 'neutral'}>
                    <Radio className="size-3" aria-hidden />
                    {snapshot.isStreaming ? t('integrations.streaming') : t('integrations.streamIdle')}
                  </Badge>
                  <Badge tone={snapshot.isRecording ? 'danger' : 'neutral'}>
                    <Video className="size-3" aria-hidden />
                    {snapshot.isRecording ? t('integrations.recording') : t('integrations.recordingIdle')}
                  </Badge>
                  <Badge tone={snapshot.hasPassword ? 'success' : 'neutral'}>
                    <Mic className="size-3" aria-hidden />
                    {snapshot.hasPassword ? t('integrations.passwordSaved') : t('integrations.noPassword')}
                  </Badge>
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <Input
                label={t('integrations.host')}
                value={host}
                placeholder={OBS_DEFAULT_HOST}
                hint={t('integrations.hostHint')}
                onChange={(event) => setHost(event.target.value)}
              />
              <Input
                label={t('integrations.port')}
                type="number"
                min={1}
                max={65535}
                value={port}
                hint={t('integrations.defaultPort', { port: OBS_DEFAULT_PORT })}
                onChange={(event) => setPort(event.target.value)}
              />
            </div>

            <Input
              label={t('integrations.password')}
              type="password"
              value={password}
              autoComplete="off"
              placeholder={
                snapshot?.hasPassword
                  ? t('integrations.savedPasswordPlaceholder')
                  : t('common.optional')
              }
              hint={t('integrations.passwordHint')}
              onChange={(event) => setPassword(event.target.value)}
            />

            <Toggle
              label={t('integrations.enable')}
              description={t('integrations.enableDescription')}
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
                  {t('integrations.close')}
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
                {t('integrations.save')}
              </Button>
              <Button
                loading={busy === 'test'}
                disabled={working}
                icon={<Cable className="size-3.5" aria-hidden />}
                onClick={() => void handleTest()}
              >
                {t('integrations.test')}
              </Button>
              {isConnected ? (
                <Button
                  variant="danger"
                  loading={busy === 'disconnect'}
                  disabled={working}
                  onClick={() => void disconnect()}
                >
                  {t('integrations.disconnect')}
                </Button>
              ) : (
                <Button
                  loading={busy === 'connect'}
                  disabled={working || !isConfigured || !isEnabled}
                  onClick={() => void connect()}
                >
                  {t('integrations.connect')}
                </Button>
              )}
              {snapshot?.hasPassword ? (
                <Button variant="ghost" disabled={working} onClick={() => void handleSave(true)}>
                  {t('integrations.removePassword')}
                </Button>
              ) : null}
            </div>

            {!isConfigured ? (
              <p className="text-[11px] text-content-subtle">{t('integrations.saveHint')}</p>
            ) : null}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            title={t('integrations.scenes')}
            description={t('integrations.scenesDescription')}
          />
          {isConnected && snapshot.scenes.length > 0 ? (
            <ul className="divide-y divide-border-subtle">
              {snapshot.scenes.map((scene) => (
                <li
                  key={scene}
                  className="flex items-center justify-between gap-3 px-5 py-3 text-xs text-content"
                >
                  <span className="truncate">{scene}</span>
                  {scene === snapshot.sceneName ? (
                    <Badge tone="success">{t('integrations.live')}</Badge>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={PlugZap}
              title={isConnected ? t('integrations.noScenes') : t('integrations.notConnected')}
              description={
                isConnected
                  ? t('integrations.noscenesDescription')
                  : t('integrations.notConnectedDescription')
              }
            />
          )}
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          title={t('integrations.tiktokTitle')}
          description={t('integrations.tiktokDescription')}
          action={
            <Badge tone={tiktokConnected ? 'success' : 'neutral'}>TikTok LIVE Studio</Badge>
          }
        />
        <PanelBody className="space-y-4">
          {tiktokError ? (
            <div
              role="alert"
              className="flex items-start justify-between gap-3 rounded-control border border-danger/40 bg-danger-soft px-3 py-2 text-[11px] text-danger"
            >
              <span className="flex items-start gap-2">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {tiktokError}
              </span>
              <button type="button" className="font-medium underline" onClick={dismissTikTokError}>
                {t('integrations.dismiss')}
              </button>
            </div>
          ) : null}

          <div className="rounded-control border border-border-subtle bg-surface-raised px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-content">{t('integrations.tiktokStatus')}</p>
                <p className="mt-0.5 text-xs break-words text-content-muted">
                  {tiktokSnapshot
                    ? t(`integrations.tiktokState.${tiktokSnapshot.state}`)
                    : t('integrations.tiktokLoading')}
                </p>
              </div>
              {tiktokSnapshot ? (
                <StatusIndicator
                  tone={tiktokConnected ? 'online' : tiktokSnapshot.state === 'ERROR' ? 'danger' : 'offline'}
                  label={t(`integrations.tiktokState.${tiktokSnapshot.state}`)}
                />
              ) : null}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-content-subtle">
              {tiktokSnapshot ? tiktokSnapshotMessage(tiktokSnapshot) : t('integrations.tiktokLoading')}
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: t('integrations.tiktokFound'),
                value: tiktokSnapshot?.found
                  ? t('integrations.tiktokFound')
                  : t('integrations.tiktokNotFound'),
              },
              { label: t('integrations.tiktokVersion'), value: tiktokSnapshot?.version ?? '—' },
              {
                label: t('integrations.tiktokPort'),
                value: tiktokSnapshot?.port ? String(tiktokSnapshot.port) : '—',
              },
              {
                label: t('integrations.tiktokScene'),
                value: tiktokSnapshot?.sceneName ?? t('integrations.noScene'),
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-control border border-border-subtle bg-surface-raised px-3 py-2"
              >
                <p className="text-[10px] tracking-wide text-content-subtle uppercase">{item.label}</p>
                <p className="mt-0.5 truncate text-xs text-content">{item.value}</p>
              </div>
            ))}
          </div>

          {tiktokConnected && tiktokSnapshot ? (
            <div className="flex flex-wrap gap-1.5">
              <Badge tone={tiktokSnapshot.micMuted ? 'accent' : 'neutral'}>
                {tiktokSnapshot.micMuted
                  ? t('integrations.tiktokMicMuted')
                  : t('integrations.tiktokMicLive')}
              </Badge>
              <Badge tone={tiktokSnapshot.audioMuted ? 'accent' : 'neutral'}>
                {tiktokSnapshot.audioMuted
                  ? t('integrations.tiktokAudioMuted')
                  : t('integrations.tiktokAudioOn')}
              </Badge>
              <Badge tone={tiktokSnapshot.recording ? 'danger' : 'neutral'}>
                {tiktokSnapshot.recording
                  ? t('integrations.tiktokRecordingOn')
                  : t('integrations.tiktokRecordingOff')}
              </Badge>
            </div>
          ) : null}

          {tiktokSnapshot?.state === 'DISCONNECTED' && !tiktokSnapshot.found ? (
            <p className="flex items-start gap-2 rounded-control border border-warning/40 bg-warning-soft px-3 py-2 text-[11px] leading-relaxed text-warning">
              <MonitorPlay className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {t('integrations.tiktokOpenHint')}
            </p>
          ) : null}

          <Toggle
            label={t('integrations.tiktokEnable')}
            description={t('integrations.tiktokEnableDescription')}
            checked={tiktokSnapshot?.isEnabled ?? true}
            disabled={tiktokWorking}
            onChange={(checked) => void saveTikTokSettings({ isEnabled: checked })}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              size="sm"
              icon={<Cable className="size-3.5" aria-hidden />}
              disabled={tiktokWorking || tiktokSnapshot?.isEnabled === false}
              loading={tiktokBusy === 'connect'}
              onClick={() => void connectTikTok()}
            >
              {t('integrations.connect')}
            </Button>
            <Button
              size="sm"
              icon={<PlugZap className="size-3.5" aria-hidden />}
              disabled={tiktokWorking || !tiktokConnected}
              loading={tiktokBusy === 'disconnect'}
              onClick={() => void disconnectTikTok()}
            >
              {t('integrations.disconnect')}
            </Button>
            <Button
              size="sm"
              icon={<MonitorPlay className="size-3.5" aria-hidden />}
              disabled={tiktokWorking || tiktokSnapshot?.isEnabled === false}
              loading={tiktokBusy === 'test'}
              onClick={() => void testTikTokConnection()}
            >
              {t('integrations.tiktokTest')}
            </Button>
          </div>
          <p className="text-[11px] text-content-subtle">{t('integrations.tiktokTestHint')}</p>

          {tiktokTestResult ? (
            <div
              role="status"
              className={cn(
                'rounded-control border px-3 py-2 text-[11px] leading-relaxed',
                tiktokTestResult.ok
                  ? 'border-success/40 bg-success/10 text-success'
                  : 'border-danger/40 bg-danger-soft text-danger',
              )}
            >
              {tiktokTestResult.message}
              <button
                type="button"
                className="ml-2 font-medium underline"
                onClick={dismissTikTokTestResult}
              >
                {t('integrations.dismiss')}
              </button>
            </div>
          ) : null}

          <div className="space-y-1.5 rounded-control border border-border-subtle bg-surface-raised px-3 py-2 text-[11px] leading-relaxed text-content-subtle">
            <p className="flex items-start gap-2">
              <Mic className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {t('integrations.tiktokNoCredentials')}
            </p>
            <p>{t('integrations.tiktokCompatibility')}</p>
          </div>
        </PanelBody>
      </Panel>
    </div>
  );
}
