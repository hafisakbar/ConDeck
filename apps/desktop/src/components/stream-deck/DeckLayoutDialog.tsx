import { gridLimits, type DeckDetail } from '@condeck/shared';
import { Minus, Plus, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useT } from '../../i18n';
import {
  BUTTON_GAP_LIMITS,
  BUTTON_SIZE_LIMITS,
  planGridShrink,
  type RemovedButton,
} from './grid-layout';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

export interface LayoutDraft {
  columns: number;
  rows: number;
  buttonScale: number;
  gapScale: number;
}

export interface DeckLayoutDialogProps {
  open: boolean;
  detail: DeckDetail | null;
  initial: { buttonScale: number; gapScale: number };
  busy: boolean;
  onClose: () => void;
  onApply: (draft: LayoutDraft, removed: RemovedButton[]) => void;
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-content-muted">{label}</p>
      <div className="flex items-center gap-1 rounded-control border border-border-strong bg-canvas px-1">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`- ${label}`}
          className="grid size-7 place-items-center rounded text-content-muted transition-colors hover:bg-surface-hover hover:text-content disabled:opacity-35"
        >
          <Minus className="size-3.5" aria-hidden />
        </button>
        <span className="flex-1 text-center text-sm font-semibold tabular-nums text-content">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`+ ${label}`}
          className="grid size-7 place-items-center rounded text-content-muted transition-colors hover:bg-surface-hover hover:text-content disabled:opacity-35"
        >
          <Plus className="size-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}

/**
 * Grid shape, key size and gap. Rows/columns persist on the deck row; size and
 * gap are device preferences. Shrinking never silently drops buttons: the
 * occupied slots are listed and require a second, explicit confirmation.
 */
export function DeckLayoutDialog({
  open,
  detail,
  initial,
  busy,
  onClose,
  onApply,
}: DeckLayoutDialogProps) {
  const t = useT();
  const [columns, setColumns] = useState(detail?.deck.columns ?? 3);
  const [rows, setRows] = useState(detail?.deck.rows ?? 3);
  const [buttonScale, setButtonScale] = useState(initial.buttonScale);
  const [gapScale, setGapScale] = useState(initial.gapScale);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setColumns(detail?.deck.columns ?? 3);
    setRows(detail?.deck.rows ?? 3);
    setButtonScale(initial.buttonScale);
    setGapScale(initial.gapScale);
    setConfirming(false);
    // Resetting only when the dialog opens is intentional: the draft belongs to this session.
  }, [open]);

  const removed = detail ? planGridShrink(detail.pages, columns, rows) : [];
  const changed =
    columns !== (detail?.deck.columns ?? columns) ||
    rows !== (detail?.deck.rows ?? rows) ||
    buttonScale !== initial.buttonScale ||
    gapScale !== initial.gapScale;
  const used = detail?.pages[0]?.buttons.length ?? 0;

  function submit(): void {
    if (removed.length > 0 && !confirming) {
      setConfirming(true);
      return;
    }
    onApply({ columns, rows, buttonScale, gapScale }, removed);
  }

  return (
    <Modal
      open={open}
      title={t('layout.title')}
      description={t('layout.description')}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('layout.cancel')}
          </Button>
          <Button
            variant={removed.length > 0 ? 'danger' : 'primary'}
            loading={busy}
            disabled={!changed}
            onClick={submit}
          >
            {removed.length > 0
              ? confirming
                ? t('layout.removeAndApply', { count: removed.length })
                : t('layout.reviewRemoval')
              : t('layout.apply')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Stepper
            label={t('layout.columns')}
            value={columns}
            min={gridLimits.minColumns}
            max={gridLimits.maxColumns}
            onChange={setColumns}
          />
          <Stepper
            label={t('layout.rows')}
            value={rows}
            min={gridLimits.minRows}
            max={gridLimits.maxRows}
            onChange={setRows}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-content-muted">{t('layout.keySize')}</p>
            <span className="text-[11px] tabular-nums text-content-subtle">
              {Math.round(buttonScale * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={BUTTON_SIZE_LIMITS.min}
            max={BUTTON_SIZE_LIMITS.max}
            step={0.02}
            value={buttonScale}
            onChange={(event) => setButtonScale(Number(event.target.value))}
            aria-label={t('layout.keySize')}
            className="w-full accent-accent"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-content-muted">{t('layout.keySpacing')}</p>
            <span className="text-[11px] tabular-nums text-content-subtle">
              {Math.round(gapScale * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={BUTTON_GAP_LIMITS.min}
            max={BUTTON_GAP_LIMITS.max}
            step={0.01}
            value={gapScale}
            onChange={(event) => setGapScale(Number(event.target.value))}
            aria-label={t('layout.keySpacing')}
            className="w-full accent-accent"
          />
        </div>

        <p className="text-[11px] text-content-subtle">
          {t('layout.summary', { columns, rows, slots: columns * rows })} ·{' '}
          {t('deck.slotsUsed', { used, total: columns * rows })}
        </p>

        {removed.length > 0 ? (
          <div
            role="alert"
            className="space-y-1.5 rounded-control border border-danger/40 bg-danger-soft px-3 py-2.5"
          >
            <p className="flex items-center gap-1.5 text-xs font-semibold text-danger">
              <TriangleAlert className="size-3.5" aria-hidden />
              {removed.length === 1
                ? t('layout.wouldDelete', { count: removed.length })
                : t('layout.wouldDeletePlural', { count: removed.length })}
            </p>
            <ul className="space-y-0.5 text-[11px] text-danger/90">
              {removed.slice(0, 5).map((entry) => (
                <li key={entry.buttonId}>
                  {t('layout.removedLine', {
                    label: entry.label,
                    slot: entry.position + 1,
                    page: entry.pageName,
                  })}
                </li>
              ))}
              {removed.length > 5 ? <li>{t('layout.more', { count: removed.length - 5 })}</li> : null}
            </ul>
            <p className="text-[11px] text-danger/80">
              {confirming ? t('layout.confirmHint') : t('layout.reviewHint')}
            </p>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
