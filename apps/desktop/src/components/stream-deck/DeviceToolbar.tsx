import type { DeckDetail, DeckSummary } from '@condeck/shared';
import {
  ChevronDown,
  LayoutTemplate,
  Maximize2,
  Minus,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/cn';
import type { WorkspaceMode } from '../../lib/device-preferences';
import { Button } from '../ui/Button';

export interface DeviceToolbarProps {
  decks: DeckSummary[];
  detail: DeckDetail;
  activePageId: string | null;
  mode: WorkspaceMode;
  zoomPercent: number;
  busy: boolean;
  onSelectDeck: (deckId: string) => void;
  onCreateDeck: () => void;
  onEditDeck: () => void;
  onDeleteDeck: () => void;
  onSelectPage: (pageId: string) => void;
  onAddPage: () => void;
  onRenamePage: () => void;
  onDeletePage: () => void;
  onModeChange: (mode: WorkspaceMode) => void;
  onOpenLayout: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onFit: () => void;
}

/** Compact control strip for the device: deck, pages, mode, layout and zoom. */
export function DeviceToolbar({
  decks,
  detail,
  activePageId,
  mode,
  zoomPercent,
  busy,
  onSelectDeck,
  onCreateDeck,
  onEditDeck,
  onDeleteDeck,
  onSelectPage,
  onAddPage,
  onRenamePage,
  onDeletePage,
  onModeChange,
  onOpenLayout,
  onZoomIn,
  onZoomOut,
  onResetView,
  onFit,
}: DeviceToolbarProps) {
  const [deckMenuOpen, setDeckMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!deckMenuOpen) {
      return;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setDeckMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    return () => window.removeEventListener('mousedown', onPointerDown);
  }, [deckMenuOpen]);

  const pages = detail.pages;

  return (
    <div className="pointer-events-auto flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-1.5 rounded-2xl border border-border-strong bg-surface/95 px-2 py-1.5 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.9)] backdrop-blur-md">
      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setDeckMenuOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={deckMenuOpen}
          className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-medium text-content transition-colors hover:bg-surface-hover"
        >
          <LayoutTemplate className="size-3.5 text-accent" aria-hidden />
          <span className="max-w-40 truncate">{detail.deck.name}</span>
          <span className="text-[10px] text-content-subtle">
            {detail.deck.columns}×{detail.deck.rows}
          </span>
          <ChevronDown className="size-3 text-content-subtle" aria-hidden />
        </button>

        {deckMenuOpen ? (
          <div
            role="menu"
            className="absolute bottom-full left-0 mb-2 w-64 overflow-hidden rounded-xl border border-border-strong bg-surface-raised py-1 shadow-xl"
          >
            <p className="px-3 py-1.5 text-[10px] tracking-wide text-content-subtle uppercase">Decks</p>
            {decks.map((deck) => (
              <button
                key={deck.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  onSelectDeck(deck.id);
                  setDeckMenuOpen(false);
                }}
                className={cn(
                  'flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs transition-colors',
                  deck.id === detail.deck.id
                    ? 'bg-accent-soft text-accent'
                    : 'text-content-muted hover:bg-surface-hover hover:text-content',
                )}
              >
                <span className="truncate">{deck.name}</span>
                <span className="shrink-0 text-[10px] opacity-70">
                  {deck.columns}×{deck.rows}
                </span>
              </button>
            ))}
            <div className="my-1 border-t border-border-subtle" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setDeckMenuOpen(false);
                onCreateDeck();
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-content-muted transition-colors hover:bg-surface-hover hover:text-content"
            >
              <Plus className="size-3.5" aria-hidden /> New deck…
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setDeckMenuOpen(false);
                onEditDeck();
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-content-muted transition-colors hover:bg-surface-hover hover:text-content"
            >
              <Pencil className="size-3.5" aria-hidden /> Rename deck…
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setDeckMenuOpen(false);
                onDeleteDeck();
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-danger transition-colors hover:bg-danger-soft"
            >
              <Trash2 className="size-3.5" aria-hidden /> Delete deck…
            </button>
          </div>
        ) : null}
      </div>

      <span className="h-5 w-px bg-border-subtle" aria-hidden />

      <div className="flex min-w-0 max-w-[34vw] items-center gap-0.5 overflow-x-auto">
        {pages.map((page) => (
          <button
            key={page.id}
            type="button"
            onClick={() => onSelectPage(page.id)}
            aria-current={page.id === activePageId ? 'page' : undefined}
            className={cn(
              'shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors',
              page.id === activePageId
                ? 'bg-surface-hover text-content'
                : 'text-content-subtle hover:text-content',
            )}
          >
            {page.name}
          </button>
        ))}
        <button
          type="button"
          onClick={onAddPage}
          disabled={busy}
          aria-label="Add page"
          title="Add page"
          className="grid size-6 shrink-0 place-items-center rounded-lg text-content-subtle transition-colors hover:bg-surface-hover hover:text-content disabled:opacity-50"
        >
          <Plus className="size-3.5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onRenamePage}
          disabled={busy || !activePageId}
          aria-label="Rename page"
          title="Rename page"
          className="grid size-6 shrink-0 place-items-center rounded-lg text-content-subtle transition-colors hover:bg-surface-hover hover:text-content disabled:opacity-40"
        >
          <Pencil className="size-3" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onDeletePage}
          disabled={busy || !activePageId}
          aria-label="Delete page"
          title="Delete page"
          className="grid size-6 shrink-0 place-items-center rounded-lg text-content-subtle transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-40"
        >
          <Trash2 className="size-3" aria-hidden />
        </button>
      </div>

      <span className="h-5 w-px bg-border-subtle" aria-hidden />

      <div className="flex items-center rounded-xl bg-canvas/70 p-0.5" role="group" aria-label="Workspace mode">
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
            {value === 'edit' ? 'Edit' : 'Live'}
          </button>
        ))}
      </div>

      <Button
        size="sm"
        variant="ghost"
        className="px-2"
        onClick={onOpenLayout}
        icon={<LayoutTemplate className="size-3.5" aria-hidden />}
        title="Deck layout"
      >
        Layout
      </Button>

      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={onZoomOut}
          aria-label="Zoom out"
          className="grid size-6 place-items-center rounded-lg text-content-subtle transition-colors hover:bg-surface-hover hover:text-content"
        >
          <Minus className="size-3.5" aria-hidden />
        </button>
        <span className="w-9 text-center text-[10px] tabular-nums text-content-subtle">{zoomPercent}%</span>
        <button
          type="button"
          onClick={onZoomIn}
          aria-label="Zoom in"
          className="grid size-6 place-items-center rounded-lg text-content-subtle transition-colors hover:bg-surface-hover hover:text-content"
        >
          <Plus className="size-3.5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onResetView}
          aria-label="Reset view"
          title="Reset view"
          className="ml-0.5 grid size-6 place-items-center rounded-lg text-content-subtle transition-colors hover:bg-surface-hover hover:text-content"
        >
          <RotateCcw className="size-3" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onFit}
          aria-label="Fit to screen"
          title="Fit to screen"
          className="grid size-6 place-items-center rounded-lg text-content-subtle transition-colors hover:bg-surface-hover hover:text-content"
        >
          <Maximize2 className="size-3" aria-hidden />
        </button>
      </div>
    </div>
  );
}
