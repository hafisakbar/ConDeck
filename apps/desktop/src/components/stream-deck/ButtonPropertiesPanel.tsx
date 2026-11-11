import type {
  ActionCatalogEntry,
  ActionType,
  ButtonAppearance,
  DeckButtonWithAction,
} from '@condeck/shared';
import { motion, useReducedMotion } from 'framer-motion';
import { Plus, X } from 'lucide-react';
import { useEffect } from 'react';
import type { ExecutionState } from '../../stores/deck-store';
import { Button } from '../ui/Button';
import { ButtonInspector, type ButtonPatch } from '../deck/ButtonInspector';

export interface ButtonPropertiesPanelProps {
  slot: { position: number; buttonId: string | null } | null;
  button: DeckButtonWithAction | null;
  pageButtons: DeckButtonWithAction[];
  columns: number;
  rows: number;
  busy: boolean;
  catalog: ActionCatalogEntry[];
  execution: ExecutionState | undefined;
  onClose: () => void;
  onCreate: (position: number) => void;
  onSave: (patch: ButtonPatch) => void;
  onPreviewAppearance: (appearance: ButtonAppearance | null) => void;
  onDuplicate: (position: number) => void;
  onDelete: () => void;
  onSaveAction: (buttonId: string, actionType: ActionType, config: Record<string, unknown>) => void;
  onRemoveAction: (buttonId: string) => void;
  onRunAction: (buttonId: string) => void;
}

/**
 * Floating properties sheet. Hidden until a key or empty slot is clicked, so the
 * stage stays clean and the device is never squeezed by a permanent side panel.
 */
export function ButtonPropertiesPanel({
  slot,
  button,
  pageButtons,
  columns,
  rows,
  busy,
  catalog,
  execution,
  onClose,
  onCreate,
  onSave,
  onPreviewAppearance,
  onDuplicate,
  onDelete,
  onSaveAction,
  onRemoveAction,
  onRunAction,
}: ButtonPropertiesPanelProps) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!slot) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [slot, onClose]);

  if (!slot) {
    return null;
  }

  return (
    <motion.aside
      role="dialog"
      aria-modal="false"
      aria-label={button ? 'Button properties' : 'Add button'}
      initial={reduceMotion ? false : { x: 24, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 0.61, 0.36, 1] }}
      className="pointer-events-auto absolute top-4 right-4 bottom-4 z-30 flex w-[21.5rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-border-strong bg-surface/97 shadow-[0_30px_80px_-24px_rgba(0,0,0,0.9)] backdrop-blur-md"
    >
      {button ? (
        <ButtonInspector
          button={button}
          pageButtons={pageButtons}
          columns={columns}
          rows={rows}
          busy={busy}
          catalog={catalog}
          execution={execution}
          onClose={onClose}
          onSave={onSave}
          onPreviewAppearance={onPreviewAppearance}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onSaveAction={onSaveAction}
          onRemoveAction={onRemoveAction}
          onRunAction={onRunAction}
        />
      ) : (
        <>
          <div className="flex items-start justify-between gap-3 border-b border-border-subtle px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-content">Add button</h2>
              <p className="mt-0.5 text-[11px] text-content-subtle">Slot {slot.position + 1}</p>
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

          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <span className="grid size-12 place-items-center rounded-2xl border border-dashed border-border-strong text-content-subtle">
              <Plus className="size-5" aria-hidden />
            </span>
            <p className="text-xs leading-relaxed text-content-muted">
              This slot is empty. Add a button, then give it a label, icon and an action. Nothing
              runs until you press it in Live mode.
            </p>
          </div>

          <div className="border-t border-border-subtle px-4 py-3">
            <Button
              className="w-full"
              variant="primary"
              loading={busy}
              icon={<Plus className="size-3.5" aria-hidden />}
              onClick={() => onCreate(slot.position)}
            >
              Add button here
            </Button>
          </div>
        </>
      )}
    </motion.aside>
  );
}
