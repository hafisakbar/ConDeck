import {
  actionConfigIssue,
  defaultActionConfig,
  type ActionCatalogEntry,
  type ActionType,
  type DeckButtonWithAction,
  type TikTokScene,
  type TikTokSource,
} from '@condeck/shared';
import { CheckCircle2, Loader2, Play, Save, Search, TriangleAlert, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useT, type MessageKey } from '../../i18n';
import { useNavigationStore } from '../../stores/navigation-store';
import { useSoundStore } from '../../stores/sound-store';
import { cn } from '../../lib/cn';
import { actionIcon } from '../../lib/action-icons';
import { ActionPickerDialog } from './ActionPickerDialog';
import type { ExecutionState } from '../../stores/deck-store';
import { useObsStore } from '../../stores/obs-store';
import { useTikTokStore } from '../../stores/tiktok-store';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Toggle } from '../ui/Toggle';

/** Stable empty array so the store selector never returns a new reference. */
const NO_SCENES: string[] = [];
const NO_TIKTOK_SCENES: TikTokScene[] = [];
const NO_TIKTOK_SOURCES: TikTokSource[] = [];

export interface ActionEditorProps {
  button: DeckButtonWithAction;
  catalog: ActionCatalogEntry[];
  busy: boolean;
  execution: ExecutionState | undefined;
  onSave: (buttonId: string, actionType: ActionType, config: Record<string, unknown>) => void;
  onRemove: (buttonId: string) => void;
  onRun: (buttonId: string) => void;
}

export function ActionEditor({
  button,
  catalog,
  busy,
  execution,
  onSave,
  onRemove,
  onRun,
}: ActionEditorProps) {
  const t = useT();
  const setView = useNavigationStore((state) => state.setView);
  const sounds = useSoundStore((state) => state.sounds);
  const loadSounds = useSoundStore((state) => state.load);
  const [actionType, setActionType] = useState<ActionType | ''>(button.action?.actionType ?? '');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [config, setConfig] = useState<Record<string, unknown>>(button.action?.config ?? {});
  const [error, setError] = useState<string | null>(null);
  const obsSnapshot = useObsStore((state) => state.snapshot);
  const obsState = obsSnapshot?.state ?? null;
  const obsScenes = obsSnapshot?.scenes ?? NO_SCENES;
  const tiktokSnapshot = useTikTokStore((state) => state.snapshot);
  const tiktokScenes = tiktokSnapshot?.scenes ?? NO_TIKTOK_SCENES;
  const tiktokSceneName = typeof config.sceneName === 'string' ? config.sceneName : '';
  const tiktokSources =
    tiktokScenes.find((scene) => scene.name === tiktokSceneName)?.sources ?? NO_TIKTOK_SOURCES;

  useEffect(() => {
    setActionType(button.action?.actionType ?? '');
    setConfig(button.action?.config ?? {});
    setError(null);
  }, [button]);

  // The sound list is only needed by the soundboard editor, so it loads lazily.
  useEffect(() => {
    if (actionType === 'SOUNDBOARD_PLAY') {
      void loadSounds();
    }
  }, [actionType, loadSounds]);

  const entry = catalog.find((item) => item.type === actionType);
  const saved = button.action;
  const dirty =
    actionType !== (saved?.actionType ?? '') ||
    JSON.stringify(config) !== JSON.stringify(saved?.config ?? {});
  const running = execution?.status === 'running';

  function handleTypeChange(value: string) {
    const next = value as ActionType | '';
    setActionType(next);
    setConfig(next === '' ? {} : defaultActionConfig(next));
    setError(null);
  }

  function handleFieldChange(key: string, value: unknown) {
    setConfig((current) => ({ ...current, [key]: value }));
    if (error) {
      setError(null);
    }
  }

  function handleSave() {
    if (!actionType) {
      setError(t('action.chooseFirst'));
      return;
    }
    const issue = actionConfigIssue(actionType, config);
    if (issue) {
      setError(issue);
      return;
    }
    onSave(button.id, actionType, config);
  }

  return (
    <section className="space-y-3 border-t border-border-subtle pt-3" aria-label={t('action.section')}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-content uppercase">{t('action.section')}</h3>
        <span className="text-[11px] text-content-subtle">
          {saved ? t('action.runsOnPress') : t('action.notConfigured')}
        </span>
      </div>

      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="flex w-full items-center gap-3 rounded-control border border-border-subtle bg-surface-raised px-3 py-2 text-left transition-colors hover:border-border-strong hover:bg-surface-hover"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
          {entry ? (() => { const Icon = actionIcon(entry.type); return <Icon className="size-4" aria-hidden />; })() : <Search className="size-4" aria-hidden />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium text-content">
            {entry ? t(`action.types.${entry.type}.label`) : t('action.noAction')}
          </span>
          <span className="mt-0.5 block truncate text-[11px] text-content-subtle">
            {entry ? t(`action.types.${entry.type}.description`) : t('action.chooseHint')}
          </span>
        </span>
        <span className="shrink-0 text-[11px] font-medium text-accent">
          {entry ? t('action.change') : t('action.choose')}
        </span>
      </button>

      {error ? <p className="text-[11px] text-danger">{error}</p> : null}

      <ActionPickerDialog
        open={pickerOpen}
        catalog={catalog}
        selected={actionType}
        obsConnected={obsState === 'CONNECTED'}
        tiktokConnected={tiktokSnapshot?.state === 'CONNECTED'}
        onSelect={handleTypeChange}
        onClose={() => setPickerOpen(false)}
      />

      {catalog.length === 0 ? (
        <p className="text-[11px] text-content-subtle">{t('action.loadingCatalog')}</p>
      ) : null}

      {entry ? (
        <>
          <p className="text-[11px] leading-relaxed text-content-subtle">
            {t(`action.types.${entry.type}.description`)}
          </p>

          {entry.type === 'SOUNDBOARD_PLAY' ? (
            <>
              <Select
                label={t('action.fields.soundId')}
                value={typeof config.soundId === 'string' ? config.soundId : ''}
                hint={t('action.soundHint')}
                onChange={(event) => handleFieldChange('soundId', event.target.value)}
              >
                <option value="">{t('action.chooseSound')}</option>
                {sounds.map((sound) => (
                  <option key={sound.id} value={sound.id}>
                    {sound.name} ({sound.format.toUpperCase()})
                  </option>
                ))}
              </Select>

              <Select
                label={t('action.fields.mode')}
                value={typeof config.mode === 'string' ? config.mode : 'restart'}
                onChange={(event) => handleFieldChange('mode', event.target.value)}
              >
                <option value="restart">{t('action.modeRestart')}</option>
                <option value="ignore">{t('action.modeIgnore')}</option>
              </Select>

              {sounds.length === 0 ? (
                <p className="rounded-control border border-border-subtle bg-surface-raised px-2.5 py-2 text-[11px] leading-relaxed text-content-subtle">
                  {t('sounds.noSoundsForAction')}{' '}
                  <button
                    type="button"
                    className="font-medium text-accent underline"
                    onClick={() => setView('sounds')}
                  >
                    {t('sounds.openLibrary')}
                  </button>
                </p>
              ) : null}
            </>
          ) : null}

          {entry.fields.map((field) =>
            (entry.type === 'TIKTOK_SWITCH_SCENE' ||
              entry.type === 'TIKTOK_SET_SOURCE_VISIBILITY' ||
              entry.type === 'TIKTOK_TOGGLE_SOURCE') &&
            field.key === 'sceneName' ? (
              <Select
                key={field.key}
                label={t('action.fields.sceneName')}
                hint={
                  tiktokScenes.length > 0
                    ? t('action.fields.sceneName')
                    : t('action.tiktokScenesHint')
                }
                value={tiktokSceneName}
                onChange={(event) => handleFieldChange('sceneName', event.target.value)}
              >
                <option value="">{t('action.tiktokScenePlaceholder')}</option>
                {tiktokScenes.map((scene) => (
                  <option key={scene.name} value={scene.name}>
                    {scene.name}
                  </option>
                ))}
                {tiktokSceneName.length > 0 &&
                !tiktokScenes.some((scene) => scene.name === tiktokSceneName) ? (
                  <option value={tiktokSceneName}>{tiktokSceneName}</option>
                ) : null}
              </Select>
            ) : (entry.type === 'TIKTOK_SET_SOURCE_VISIBILITY' ||
                entry.type === 'TIKTOK_TOGGLE_SOURCE') &&
              field.key === 'sourceId' ? (
              <Select
                key={field.key}
                label={t('action.fields.sourceId')}
                hint={t('action.fields.sourceIdHelp')}
                value={typeof config[field.key] === 'string' ? (config[field.key] as string) : ''}
                onChange={(event) => handleFieldChange(field.key, event.target.value)}
              >
                <option value="">{t('action.tiktokSourcePlaceholder')}</option>
                {tiktokSources.map((source) => (
                  <option key={source.value} value={source.value}>
                    {source.label}
                  </option>
                ))}
                {typeof config[field.key] === 'string' &&
                (config[field.key] as string).length > 0 &&
                !tiktokSources.some((source) => source.value === config[field.key]) ? (
                  <option value={config[field.key] as string}>{config[field.key] as string}</option>
                ) : null}
              </Select>
            ) : entry.type === 'OBS_SWITCH_SCENE' && field.key === 'sceneName' ? (
              <Select
                key={field.key}
                label={t(`action.fields.${field.key}` as MessageKey)}
                hint={
                  obsScenes.length > 0
                    ? t(`action.fields.${field.key}` as MessageKey)
                    : t('action.sceneHintConnect')
                }
                value={typeof config[field.key] === 'string' ? (config[field.key] as string) : ''}
                onChange={(event) => handleFieldChange(field.key, event.target.value)}
              >
                <option value="">{t('action.scenePlaceholder')}</option>
                {obsScenes.map((scene) => (
                  <option key={scene} value={scene}>
                    {scene}
                  </option>
                ))}
                {typeof config[field.key] === 'string' &&
                (config[field.key] as string).length > 0 &&
                !obsScenes.includes(config[field.key] as string) ? (
                  <option value={config[field.key] as string}>{config[field.key] as string}</option>
                ) : null}
              </Select>
            ) : field.type === 'boolean' ? (
              <Toggle
                key={field.key}
                label={t(`action.fields.${field.key}` as MessageKey)}
                description={field.help}
                checked={config[field.key] === true}
                onChange={(checked) => handleFieldChange(field.key, checked)}
              />
            ) : (
              <Input
                key={field.key}
                label={t(`action.fields.${field.key}` as MessageKey)}
                placeholder={field.placeholder}
                hint={field.help}
                value={typeof config[field.key] === 'string' ? (config[field.key] as string) : ''}
                onChange={(event) => handleFieldChange(field.key, event.target.value)}
              />
            ),
          )}

          {entry.provider === 'TIKTOK' ? (
            <p className="rounded-control border border-border-subtle bg-surface-raised px-2.5 py-2 text-[11px] leading-relaxed text-content-subtle">
              {tiktokSnapshot?.state === 'CONNECTED'
                ? t('action.requiresObsConnected').replace('OBS', 'TikTok LIVE Studio')
                : t('action.providerDisconnected', {
                    provider: t('action.categories.TIKTOK'),
                  })}
            </p>
          ) : null}

          {entry.requiresObs ? (
            <p className="rounded-control border border-border-subtle bg-surface-raised px-2.5 py-2 text-[11px] leading-relaxed text-content-subtle">
              {obsState === 'CONNECTED'
                ? t('action.requiresObsConnected')
                : t('action.requiresObsDisconnected')}
            </p>
          ) : null}
        </>
      ) : (
        <p className="rounded-control border border-border-subtle bg-surface-raised px-2.5 py-2 text-[11px] leading-relaxed text-content-subtle">
          {t('action.chooseHint')}
        </p>
      )}

      {execution ? (
        <div
          role="status"
          className={cn(
            'flex items-start gap-2 rounded-control border px-2.5 py-2 text-[11px] leading-relaxed',
            execution.status === 'failed'
              ? 'border-danger/40 bg-danger-soft text-danger'
              : execution.status === 'success'
                ? 'border-success/40 bg-success/10 text-success'
                : 'border-border-subtle bg-surface-raised text-content-muted',
          )}
        >
          {execution.status === 'running' ? (
            <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin" aria-hidden />
          ) : execution.status === 'success' ? (
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          ) : (
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          )}
          <span>{execution.message}</span>
        </div>
      ) : null}

      <div className="space-y-2">
        <Button
          className="w-full"
          variant="primary"
          size="sm"
          icon={<Save className="size-3.5" aria-hidden />}
          disabled={busy || !dirty}
          loading={busy}
          onClick={handleSave}
        >
          {t('action.save')}
        </Button>
        <div className="flex gap-2">
          <Button
            className="flex-1"
            size="sm"
            icon={<Play className="size-3.5" aria-hidden />}
            disabled={!saved || !button.isEnabled || running}
            onClick={() => onRun(button.id)}
          >
            {t('action.runTest')}
          </Button>
          <Button
            className="flex-1"
            size="sm"
            variant="danger"
            icon={<Trash2 className="size-3.5" aria-hidden />}
            disabled={!saved || busy}
            onClick={() => onRemove(button.id)}
          >
            {t('action.remove')}
          </Button>
        </div>
        {!button.isEnabled ? (
          <p className="text-[11px] text-content-subtle">{t('action.disabledHint')}</p>
        ) : null}
      </div>
    </section>
  );
}
