import {
  actionConfigIssue,
  defaultActionConfig,
  type ActionCatalogEntry,
  type ActionType,
  type DeckButtonWithAction,
} from '@condeck/shared';
import { CheckCircle2, Loader2, Play, Save, TriangleAlert, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '../../lib/cn';
import type { ExecutionState } from '../../stores/deck-store';
import { useObsStore } from '../../stores/obs-store';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Toggle } from '../ui/Toggle';

const CATEGORY_LABELS: Record<string, string> = {
  OBS: 'OBS Studio',
  SYSTEM: 'System',
  NAVIGATION: 'Navigation',
};

/** Stable empty array so the store selector never returns a new reference. */
const NO_SCENES: string[] = [];

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
  const [actionType, setActionType] = useState<ActionType | ''>(button.action?.actionType ?? '');
  const [config, setConfig] = useState<Record<string, unknown>>(button.action?.config ?? {});
  const [error, setError] = useState<string | null>(null);
  const obsSnapshot = useObsStore((state) => state.snapshot);
  const obsState = obsSnapshot?.state ?? null;
  const obsScenes = obsSnapshot?.scenes ?? NO_SCENES;

  useEffect(() => {
    setActionType(button.action?.actionType ?? '');
    setConfig(button.action?.config ?? {});
    setError(null);
  }, [button]);

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
      setError('Choose an action type first.');
      return;
    }
    const issue = actionConfigIssue(actionType, config);
    if (issue) {
      setError(issue);
      return;
    }
    onSave(button.id, actionType, config);
  }

  const categories = [...new Set(catalog.map((item) => item.category))];

  return (
    <section className="space-y-3 border-t border-border-subtle pt-3" aria-label="Button action">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-content uppercase">Action</h3>
        {saved ? (
          <span className="text-[11px] text-content-subtle">Runs on press</span>
        ) : (
          <span className="text-[11px] text-content-subtle">Not configured</span>
        )}
      </div>

      <Select
        label="Action type"
        value={actionType}
        error={error ?? undefined}
        onChange={(event) => handleTypeChange(event.target.value)}
      >
        <option value="">No action</option>
        {categories.map((category) => (
          <optgroup key={category} label={CATEGORY_LABELS[category] ?? category}>
            {catalog
              .filter((item) => item.category === category)
              .map((item) => (
                <option key={item.type} value={item.type}>
                  {item.label}
                </option>
              ))}
          </optgroup>
        ))}
      </Select>

      {catalog.length === 0 ? (
        <p className="text-[11px] text-content-subtle">Loading the action catalog…</p>
      ) : null}

      {entry ? (
        <>
          <p className="text-[11px] leading-relaxed text-content-subtle">{entry.description}</p>

          {entry.fields.map((field) =>
            entry.type === 'OBS_SWITCH_SCENE' && field.key === 'sceneName' ? (
              <Select
                key={field.key}
                label={field.label}
                hint={
                  obsScenes.length > 0
                    ? field.help
                    : 'Connect to OBS in Integrations to pick a scene from a list.'
                }
                value={typeof config[field.key] === 'string' ? (config[field.key] as string) : ''}
                onChange={(event) => handleFieldChange(field.key, event.target.value)}
              >
                <option value="">Choose a scene…</option>
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
                label={field.label}
                description={field.help}
                checked={config[field.key] === true}
                onChange={(checked) => handleFieldChange(field.key, checked)}
              />
            ) : (
              <Input
                key={field.key}
                label={field.label}
                placeholder={field.placeholder}
                hint={field.help}
                value={typeof config[field.key] === 'string' ? (config[field.key] as string) : ''}
                onChange={(event) => handleFieldChange(field.key, event.target.value)}
              />
            ),
          )}

          {entry.requiresObs ? (
            <p className="rounded-control border border-border-subtle bg-surface-raised px-2.5 py-2 text-[11px] leading-relaxed text-content-subtle">
              {obsState === 'CONNECTED'
                ? 'OBS is connected. This action runs through the connection configured in Integrations.'
                : 'OBS is not connected. The action still saves, but pressing the button reports the connection error until you connect in Integrations.'}
            </p>
          ) : null}
        </>
      ) : (
        <p className="rounded-control border border-border-subtle bg-surface-raised px-2.5 py-2 text-[11px] leading-relaxed text-content-subtle">
          Choose an action to make this button do something. Without an action it is only a label on
          the deck.
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
          Save action
        </Button>
        <div className="flex gap-2">
          <Button
            className="flex-1"
            size="sm"
            icon={<Play className="size-3.5" aria-hidden />}
            disabled={!saved || !button.isEnabled || running}
            onClick={() => onRun(button.id)}
          >
            Run test
          </Button>
          <Button
            className="flex-1"
            size="sm"
            variant="danger"
            icon={<Trash2 className="size-3.5" aria-hidden />}
            disabled={!saved || busy}
            onClick={() => onRemove(button.id)}
          >
            Remove
          </Button>
        </div>
        {!button.isEnabled ? (
          <p className="text-[11px] text-content-subtle">
            This button is disabled, so its action will not run.
          </p>
        ) : null}
      </div>
    </section>
  );
}
