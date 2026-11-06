import type { ButtonIconName, DeckButton } from '@condeck/shared';
import { Copy, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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
  isEnabled?: boolean;
  position?: number;
}

export interface ButtonInspectorProps {
  button: DeckButton;
  pageButtons: DeckButton[];
  columns: number;
  rows: number;
  busy: boolean;
  onClose: () => void;
  onSave: (patch: ButtonPatch) => void;
  onDuplicate: (position: number) => void;
  onDelete: () => void;
}

export function ButtonInspector({
  button,
  pageButtons,
  columns,
  rows,
  busy,
  onClose,
  onSave,
  onDuplicate,
  onDelete,
}: ButtonInspectorProps) {
  const [label, setLabel] = useState(button.label);
  const [icon, setIcon] = useState<ButtonIconName | null>(button.icon);
  const [backgroundColor, setBackgroundColor] = useState(button.backgroundColor);
  const [textColor, setTextColor] = useState(button.textColor);
  const [isEnabled, setIsEnabled] = useState(button.isEnabled);
  const [position, setPosition] = useState(button.position);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLabel(button.label);
    setIcon(button.icon);
    setBackgroundColor(button.backgroundColor);
    setTextColor(button.textColor);
    setIsEnabled(button.isEnabled);
    setPosition(button.position);
    setError(null);
  }, [button]);

  const capacity = columns * rows;
  const occupied = useMemo(
    () => new Set(pageButtons.filter((entry) => entry.id !== button.id).map((entry) => entry.position)),
    [pageButtons, button.id],
  );

  const dirty =
    label.trim() !== button.label ||
    icon !== button.icon ||
    backgroundColor !== button.backgroundColor ||
    textColor !== button.textColor ||
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

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
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

        <p className="rounded-control border border-border-subtle bg-surface-raised px-3 py-2 text-[11px] leading-relaxed text-content-subtle">
          Action configuration arrives with the Action Engine in Phase 3. This phase stores the
          appearance only.
        </p>
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
