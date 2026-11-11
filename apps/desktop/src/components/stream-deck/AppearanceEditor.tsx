import {
  buttonVisualStates,
  type ButtonAppearance,
  type ButtonAppearanceState,
  type ButtonVisualState,
} from '@condeck/shared';
import { RotateCcw } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { useT, type MessageKey } from '../../i18n';
import { cn } from '../../lib/cn';

const HEX_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const FIELDS: ReadonlyArray<{
  key: keyof Omit<ButtonAppearanceState, 'glowIntensity'>;
  labelKey: MessageKey;
}> = [
  { key: 'backgroundColor', labelKey: 'appearance.background' },
  { key: 'textColor', labelKey: 'appearance.textIcon' },
  { key: 'borderColor', labelKey: 'appearance.border' },
  { key: 'glowColor', labelKey: 'appearance.glow' },
];

const STATE_LABEL_KEYS: Record<ButtonVisualState, MessageKey> = {
  normal: 'appearance.normal',
  hover: 'appearance.hover',
  active: 'appearance.active',
  pressed: 'appearance.pressed',
};

function CompactColor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const inputId = useId();
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  function commit(next: string) {
    setDraft(next);
    if (HEX_PATTERN.test(next.trim())) {
      onChange(next.trim());
    }
  }

  const valid = HEX_PATTERN.test(draft);

  return (
    <div className="space-y-1">
      <label htmlFor={inputId} className="block text-[11px] font-medium text-content-muted">
        {label}
      </label>
      <div className="flex items-center gap-1.5">
        <input
          id={inputId}
          type="color"
          value={valid ? draft : '#000000'}
          onChange={(event) => commit(event.target.value)}
          aria-label={label}
          className="h-7 w-8 shrink-0 cursor-pointer rounded border border-border-strong bg-canvas"
        />
        <input
          type="text"
          value={draft}
          onChange={(event) => commit(event.target.value)}
          aria-invalid={valid ? undefined : true}
          className={cn(
            'h-7 w-full rounded-control border bg-canvas px-2 font-mono text-[11px] text-content',
            valid ? 'border-border-strong' : 'border-danger',
          )}
        />
      </div>
    </div>
  );
}

export interface AppearanceEditorProps {
  appearance: ButtonAppearance;
  defaultAppearance: ButtonAppearance;
  onChange: (appearance: ButtonAppearance) => void;
  onReset: () => void;
}

/**
 * Per-state colours of one key. Edits are applied to the 3D device immediately
 * through a preview draft; the panel decides when to persist them.
 */
export function AppearanceEditor({
  appearance,
  defaultAppearance,
  onChange,
  onReset,
}: AppearanceEditorProps) {
  const t = useT();
  const [state, setState] = useState<ButtonVisualState>('normal');
  const current = appearance[state];

  function patch(partial: Partial<ButtonAppearanceState>): void {
    onChange({ ...appearance, [state]: { ...current, ...partial } });
  }

  return (
    <section className="space-y-2.5 rounded-xl border border-border-subtle bg-canvas/40 p-2.5">
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold tracking-wide text-content-muted uppercase">
          {t('appearance.title')}
        </h3>
        <button
          type="button"
          onClick={onReset}
          title={t('appearance.resetAllHint')}
          className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] text-content-subtle transition-colors hover:bg-surface-hover hover:text-content"
        >
          <RotateCcw className="size-3" aria-hidden /> {t('common.reset')}
        </button>
      </header>

      <div className="grid grid-cols-4 gap-1 rounded-lg bg-canvas/70 p-0.5" role="tablist">
        {buttonVisualStates.map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={state === value}
            onClick={() => setState(value)}
            className={cn(
              'rounded-md px-1 py-1 text-[10px] font-medium transition-colors',
              state === value ? 'bg-accent-soft text-accent' : 'text-content-subtle hover:text-content',
            )}
          >
            {t(STATE_LABEL_KEYS[value])}
          </button>
        ))}
      </div>

      <div
        className="h-9 rounded-lg border"
        style={{
          backgroundColor: current.backgroundColor,
          borderColor: current.borderColor,
          boxShadow: `0 0 ${Math.round(current.glowIntensity * 22)}px ${current.glowColor}`,
        }}
        aria-hidden
      />

      <div className="grid grid-cols-2 gap-2">
        {FIELDS.map((field) => (
          <CompactColor
            key={field.key}
            label={t(field.labelKey)}
            value={current[field.key]}
            onChange={(value) => patch({ [field.key]: value })}
          />
        ))}
      </div>

      <label className="block space-y-1">
        <span className="flex items-center justify-between text-[11px] font-medium text-content-muted">
          {t('appearance.glowIntensity')}
          <span className="font-mono text-[10px] text-content-subtle">
            {Math.round(current.glowIntensity * 100)}%
          </span>
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(current.glowIntensity * 100)}
          onChange={(event) => patch({ glowIntensity: Number(event.target.value) / 100 })}
          className="w-full accent-accent"
        />
      </label>

      <button
        type="button"
        onClick={() => onChange({ ...appearance, [state]: defaultAppearance[state] })}
        className="w-full rounded-md border border-border-subtle px-2 py-1 text-[10px] text-content-subtle transition-colors hover:bg-surface-hover hover:text-content"
      >
        {t('appearance.resetState', { state: t(STATE_LABEL_KEYS[state]).toLowerCase() })}
      </button>
    </section>
  );
}
