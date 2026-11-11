import {
  defaultButtonAppearance,
  type ActionCatalogEntry,
  type ActionType,
  type ButtonAppearance,
  type ButtonIconName,
  type DeckButtonWithAction,
} from '@condeck/shared';
import { Copy, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ExecutionState } from '../../stores/deck-store';
import { AppearanceEditor } from '../stream-deck/AppearanceEditor';
import { ActionEditor } from './ActionEditor';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Toggle } from '../ui/Toggle';
import { ColorField } from './ColorField';
import { IconPicker } from './IconPicker';

const HEX_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export interface ButtonPatch {
  label?: string;
  icon?: ButtonIconName | null;
  backgroundColor?: string;
  textColor?: string;
  appearance?: ButtonAppearance;
  isEnabled?: boolean;
  position?: number;
}

export interface ButtonInspectorProps {
  button: DeckButtonWithAction;
  pageButtons: DeckButtonWithAction[];
  columns: number;
  rows: number;
  busy: boolean;
  catalog: ActionCatalogEntry[];
  execution: ExecutionState | undefined;
  onClose: () => void;
  onSave: (patch: ButtonPatch) => void;
  onPreviewAppearance?: (appearance: ButtonAppearance | null) => void;
  onDuplicate: (position: number) => void;
  onDelete: () => void;
  onSaveAction: (buttonId: string, actionType: ActionType, config: Record<string, unknown>) => void;
  onRemoveAction: (buttonId: string) => void;
  onRunAction: (buttonId: string) => void;
}

export function ButtonInspector({
  button,
  pageButtons,
  columns,
  rows,
  busy,
  catalog,
  execution,
  onClose,
  onSave,
  onPreviewAppearance,
  onDuplicate,
  onDelete,
  onSaveAction,
  onRemoveAction,
  onRunAction,
}: ButtonInspectorProps) {
  const [label, setLabel] = useState(button.label);
  const [icon, setIcon] = useState<ButtonIconName | null>(button.icon);
  const [backgroundColor, setBackgroundColor] = useState(button.backgroundColor);
  const [textColor, setTextColor] = useState(button.textColor);
  const [appearance, setAppearance] = useState<ButtonAppearance>(
    button.appearance ?? defaultButtonAppearance(button.backgroundColor, button.textColor),
  );
  const [isEnabled, setIsEnabled] = useState(button.isEnabled);
  const [position, setPosition] = useState(button.position);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLabel(button.label);
    setIcon(button.icon);
    setBackgroundColor(button.backgroundColor);
    setTextColor(button.textColor);
    setAppearance(button.appearance ?? defaultButtonAppearance(button.backgroundColor, button.textColor));
    setIsEnabled(button.isEnabled);
    setPosition(button.position);
    setError(null);
  }, [button]);

  // A preview belongs to this open panel only; closing or switching button drops it.
  const previewRef = useRef(onPreviewAppearance);
  previewRef.current = onPreviewAppearance;
  useEffect(() => () => previewRef.current?.(null), [button.id]);

  const capacity = columns * rows;
  const occupied = useMemo(
    () => new Set(pageButtons.filter((entry) => entry.id !== button.id).map((entry) => entry.position)),
    [pageButtons, button.id],
  );

  const defaultAppearance = defaultButtonAppearance(button.backgroundColor, button.textColor);
  const appearanceDirty =
    JSON.stringify(appearance) !== JSON.stringify(button.appearance ?? defaultAppearance);

  const dirty =
    label.trim() !== button.label ||
    icon !== button.icon ||
    backgroundColor !== button.backgroundColor ||
    textColor !== button.textColor ||
    appearanceDirty ||
    isEnabled !== button.isEnabled ||
    position !== button.position;

  const freeSlot = Array.from({ length: capacity }, (_, index) => index).find(
    (index) => !occupied.has(index) && index !== button.position,
  );

  function handleSave() {
    if (label.trim().length === 0) {
      setError('Button label is required.');
      return;
    }
    if (!HEX_PATTERN.test(backgroundColor) || !HEX_PATTERN.test(textColor)) {
      setError('Colours must be valid hex values.');
      return;
    }
    onSave({
      label: label.trim(),
      icon,
      backgroundColor,
      textColor,
      appearance,
      isEnabled,
      position,
    });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-border-subtle px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-content">Button properties</h2>
          <p className="mt-0.5 text-[11px] text-content-subtle">
            Slot {button.position + 1}
            {position !== button.position ? ` → slot ${position + 1}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close properties"
          className="text-content-muted transition-colors hover:text-content"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-8 pt-4">
        <Input
          label="Label"
          value={label}
          maxLength={40}
          error={error ?? undefined}
          onChange={(event) => {
            setLabel(event.target.value);
            if (error) {
              setError(null);
            }
          }}
        />

        <IconPicker value={icon} onChange={setIcon} />

        <ColorField label="Background" value={backgroundColor} onChange={setBackgroundColor} />
        <ColorField label="Text colour" value={textColor} onChange={setTextColor} />

        <AppearanceEditor
          appearance={appearance}
          defaultAppearance={defaultAppearance}
          onChange={(next) => {
            setAppearance(next);
            onPreviewAppearance?.(next);
          }}
          onReset={() => {
            setAppearance(defaultAppearance);
            onPreviewAppearance?.(defaultAppearance);
          }}
        />

        <Select
          label="Move to slot"
          value={String(position)}
          onChange={(event) => setPosition(Number(event.target.value))}
        >
          {Array.from({ length: capacity }, (_, index) => index).map((index) => (
            <option key={index} value={index} disabled={occupied.has(index) && index !== button.position}>
              Slot {index + 1}
              {occupied.has(index) ? ' (occupied)' : index === button.position ? ' (current)' : ''}
            </option>
          ))}
        </Select>

        <Toggle
          label="Enabled"
          description="Disabled buttons stay visible but will not run an action."
          checked={isEnabled}
          onChange={setIsEnabled}
        />

        <ActionEditor
          button={button}
          catalog={catalog}
          busy={busy}
          execution={execution}
          onSave={onSaveAction}
          onRemove={onRemoveAction}
          onRun={onRunAction}
        />
      </div>

      <div className="space-y-2 border-t border-border-subtle px-4 py-3">
        <Button className="w-full" variant="primary" disabled={!dirty} loading={busy} onClick={handleSave}>
          Save changes
        </Button>
        <div className="flex gap-2">
          <Button
            className="flex-1"
            size="sm"
            icon={<Copy className="size-3.5" aria-hidden />}
            disabled={busy || freeSlot === undefined}
            onClick={() => {
              if (freeSlot !== undefined) {
                onDuplicate(freeSlot);
              }
            }}
          >
            Duplicate
          </Button>
          <Button
            className="flex-1"
            size="sm"
            variant="danger"
            icon={<Trash2 className="size-3.5" aria-hidden />}
            disabled={busy}
            onClick={onDelete}
          >
            Delete
          </Button>
        </div>
        {freeSlot === undefined ? (
          <p className="text-[11px] text-content-subtle">No free slot on this page to duplicate into.</p>
        ) : null}
      </div>
    </div>
  );
}
