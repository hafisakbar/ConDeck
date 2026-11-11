import type { DeckDetail } from '@condeck/shared';
import { LayoutTemplate, Maximize2, Minus, Plus, RotateCcw } from 'lucide-react';
import { useT } from '../../i18n';
import { cn } from '../../lib/cn';
import type { WorkspaceMode } from '../../lib/device-preferences';
import { Button } from '../ui/Button';

export interface DeviceToolbarProps {
  detail: DeckDetail;
  mode: WorkspaceMode;
  zoomPercent: number;
  onModeChange: (mode: WorkspaceMode) => void;
  onOpenLayout: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onFit: () => void;
}

/**
 * Compact strip for the device. ConDeck uses one deck with one page, so the
 * strip shows their names instead of selectors and create/delete controls.
 */
export function DeviceToolbar({
  detail,
  mode,
  zoomPercent,
  onModeChange,
  onOpenLayout,
  onZoomIn,
  onZoomOut,
  onResetView,
  onFit,
}: DeviceToolbarProps) {
  const t = useT();
  const page = detail.pages[0] ?? null;

  return (
    <div className="pointer-events-auto flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-1.5 rounded-2xl border border-border-strong bg-surface/95 px-2 py-1.5 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.55)] backdrop-blur-md">
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <LayoutTemplate className="size-3.5 text-accent" aria-hidden />
        <span className="max-w-40 truncate text-xs font-medium text-content">{detail.deck.name}</span>
        <span className="text-[10px] text-content-subtle">
          {t('deck.grid', { columns: detail.deck.columns, rows: detail.deck.rows })}
        </span>
      </div>

      <span className="h-5 w-px bg-border-subtle" aria-hidden />

      {page ? (
        <span className="px-2 text-[11px] font-medium text-content-muted">{page.name}</span>
      ) : null}

      <span className="h-5 w-px bg-border-subtle" aria-hidden />

      <div className="flex items-center rounded-xl bg-canvas/70 p-0.5" role="group" aria-label={t('deck.edit')}>
        {(['edit', 'operate'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onModeChange(value)}
            aria-pressed={mode === value}
            className={cn(
              'rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors',
              mode === value
                ? value === 'operate'
                  ? 'bg-success/15 text-success'
                  : 'bg-accent-soft text-accent'
                : 'text-content-subtle hover:text-content',
            )}
          >
            {value === 'edit' ? t('deck.edit') : t('deck.live')}
          </button>
        ))}
      </div>

      <Button
        size="sm"
        variant="ghost"
        className="px-2"
        onClick={onOpenLayout}
        icon={<LayoutTemplate className="size-3.5" aria-hidden />}
        title={t('layout.title')}
      >
        {t('deck.layout')}
      </Button>

      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={onZoomOut}
          aria-label={t('deck.zoomOut')}
          className="grid size-6 place-items-center rounded-lg text-content-subtle transition-colors hover:bg-surface-hover hover:text-content"
        >
          <Minus className="size-3.5" aria-hidden />
        </button>
        <span className="w-9 text-center text-[10px] tabular-nums text-content-subtle">{zoomPercent}%</span>
        <button
          type="button"
          onClick={onZoomIn}
          aria-label={t('deck.zoomIn')}
          className="grid size-6 place-items-center rounded-lg text-content-subtle transition-colors hover:bg-surface-hover hover:text-content"
        >
          <Plus className="size-3.5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onResetView}
          aria-label={t('deck.resetView')}
          title={t('deck.resetView')}
          className="ml-0.5 grid size-6 place-items-center rounded-lg text-content-subtle transition-colors hover:bg-surface-hover hover:text-content"
        >
          <RotateCcw className="size-3" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onFit}
          aria-label={t('deck.fit')}
          title={t('deck.fit')}
          className="grid size-6 place-items-center rounded-lg text-content-subtle transition-colors hover:bg-surface-hover hover:text-content"
        >
          <Maximize2 className="size-3" aria-hidden />
        </button>
      </div>
    </div>
  );
}
