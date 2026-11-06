import { useEffect, useState } from 'react';
import { gridLimits, gridPresets, type GridPreset } from '@condeck/shared';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { Select } from '../ui/Select';

export interface DeckFormValues {
  name: string;
  columns: number;
  rows: number;
}

export interface DeckFormDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  initial?: DeckFormValues;
  busy: boolean;
  onClose: () => void;
  onSubmit: (values: DeckFormValues) => void;
}

const CUSTOM_PRESET = 'custom';

function presetIdFor(columns: number, rows: number): string {
  const match = gridPresets.find((preset) => preset.columns === columns && preset.rows === rows);
  return match ? match.id : CUSTOM_PRESET;
}

export function DeckFormDialog({ open, mode, initial, busy, onClose, onSubmit }: DeckFormDialogProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [columns, setColumns] = useState(initial?.columns ?? 3);
  const [rows, setRows] = useState(initial?.rows ?? 3);
  const [presetId, setPresetId] = useState(() => presetIdFor(initial?.columns ?? 3, initial?.rows ?? 3));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const nextColumns = initial?.columns ?? 3;
    const nextRows = initial?.rows ?? 3;
    setName(initial?.name ?? '');
    setColumns(nextColumns);
    setRows(nextRows);
    setPresetId(presetIdFor(nextColumns, nextRows));
    setError(null);
  }, [open, initial]);

  function handlePresetChange(value: string) {
    setPresetId(value);
    const preset: GridPreset | undefined = gridPresets.find((entry) => entry.id === value);
    if (preset) {
      setColumns(preset.columns);
      setRows(preset.rows);
    }
  }

  function handleSubmit() {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError('Deck name is required.');
      return;
    }
    if (columns < gridLimits.minColumns || columns > gridLimits.maxColumns) {
      setError(`Columns must be between ${gridLimits.minColumns} and ${gridLimits.maxColumns}.`);
      return;
    }
    if (rows < gridLimits.minRows || rows > gridLimits.maxRows) {
      setError(`Rows must be between ${gridLimits.minRows} and ${gridLimits.maxRows}.`);
      return;
    }

    onSubmit({ name: trimmed, columns, rows });
  }

  return (
    <Modal
      open={open}
      title={mode === 'create' ? 'New deck' : 'Deck settings'}
      description={
        mode === 'create'
          ? 'A deck holds pages of buttons. It starts with one page named "Main".'
          : 'Rename the deck or change its grid. Shrinking is refused while buttons would fall outside.'
      }
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={handleSubmit}>
            {mode === 'create' ? 'Create deck' : 'Save changes'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input
          label="Deck name"
          placeholder="Streaming layout"
          value={name}
          maxLength={60}
          autoFocus
          error={error ?? undefined}
          onChange={(event) => {
            setName(event.target.value);
            if (error) {
              setError(null);
            }
          }}
        />

        <Select label="Grid size" value={presetId} onChange={(event) => handlePresetChange(event.target.value)}>
          {gridPresets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
          <option value={CUSTOM_PRESET}>Custom</option>
        </Select>

        {presetId === CUSTOM_PRESET ? (
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Columns"
              type="number"
              min={gridLimits.minColumns}
              max={gridLimits.maxColumns}
              value={columns}
              onChange={(event) => setColumns(Number(event.target.value))}
            />
            <Input
              label="Rows"
              type="number"
              min={gridLimits.minRows}
              max={gridLimits.maxRows}
              value={rows}
              onChange={(event) => setRows(Number(event.target.value))}
            />
          </div>
        ) : (
          <p className="text-xs text-content-subtle">
            Current grid: {columns} × {rows} ({columns * rows} slots per page).
          </p>
        )}
      </div>
    </Modal>
  );
}
