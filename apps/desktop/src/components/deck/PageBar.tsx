import type { DeckPage } from '@condeck/shared';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface PageBarProps {
  pages: DeckPage[];
  activePageId: string | null;
  busy: boolean;
  onSelect: (pageId: string) => void;
  onAdd: () => void;
  onRename: () => void;
  onDelete: () => void;
}

export function PageBar({
  pages,
  activePageId,
  busy,
  onSelect,
  onAdd,
  onRename,
  onDelete,
}: PageBarProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-2">
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {pages.length === 0 ? (
          <p className="py-1 text-xs text-content-subtle">This deck has no pages yet.</p>
        ) : (
          pages.map((page) => {
            const active = page.id === activePageId;
            return (
              <button
                key={page.id}
                type="button"
                onClick={() => onSelect(page.id)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'shrink-0 rounded-control px-3 py-1.5 text-xs font-medium transition-colors',
                  active
                    ? 'bg-accent-soft text-accent'
                    : 'text-content-muted hover:bg-surface-hover hover:text-content',
                )}
              >
                {page.name}
              </button>
            );
          })
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onAdd}
          disabled={busy}
          aria-label="Add page"
          title="Add page"
          className="grid size-7 place-items-center rounded-control text-content-muted transition-colors hover:bg-surface-hover hover:text-content disabled:opacity-50"
        >
          <Plus className="size-3.5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onRename}
          disabled={busy || !activePageId}
          aria-label="Rename page"
          title="Rename page"
          className="grid size-7 place-items-center rounded-control text-content-muted transition-colors hover:bg-surface-hover hover:text-content disabled:opacity-50"
        >
          <Pencil className="size-3.5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={busy || !activePageId}
          aria-label="Delete page"
          title="Delete page"
          className="grid size-7 place-items-center rounded-control text-content-muted transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-50"
        >
          <Trash2 className="size-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
