import type { DeckSummary } from '@condeck/shared';
import { LayoutGrid, Plus } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface DeckListProps {
  decks: DeckSummary[];
  activeDeckId: string | null;
  busy: boolean;
  onSelect: (deckId: string) => void;
  onCreate: () => void;
}

export function DeckList({ decks, activeDeckId, busy, onSelect, onCreate }: DeckListProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border-subtle px-4 py-3">
        <p className="text-xs font-semibold tracking-wide text-content-muted uppercase">Decks</p>
        <button
          type="button"
          onClick={onCreate}
          disabled={busy}
          aria-label="Create deck"
          title="Create deck"
          className="grid size-7 place-items-center rounded-control text-content-muted transition-colors hover:bg-surface-hover hover:text-content disabled:opacity-50"
        >
          <Plus className="size-4" aria-hidden />
        </button>
      </div>

      <ul className="flex-1 overflow-y-auto p-2">
        {decks.length === 0 ? (
          <li className="px-2 py-6 text-center text-xs text-content-subtle">
            No decks yet. Create one to start building.
          </li>
        ) : (
          decks.map((deck) => {
            const active = deck.id === activeDeckId;
            return (
              <li key={deck.id}>
                <button
                  type="button"
                  onClick={() => onSelect(deck.id)}
                  aria-current={active ? 'true' : undefined}
                  className={cn(
                    'mb-1 flex w-full items-start gap-2 rounded-control px-2.5 py-2 text-left transition-colors',
                    active
                      ? 'bg-accent-soft text-accent'
                      : 'text-content-muted hover:bg-surface-hover hover:text-content',
                  )}
                >
                  <LayoutGrid className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{deck.name}</span>
                    <span className="mt-0.5 block text-[11px] opacity-80">
                      {deck.columns} × {deck.rows} · {deck.pageCount} page
                      {deck.pageCount === 1 ? '' : 's'} · {deck.buttonCount} button
                      {deck.buttonCount === 1 ? '' : 's'}
                    </span>
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
