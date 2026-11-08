import type { RemotePage } from '@condeck/websocket-protocol';

export interface PageTabsProps {
  pages: RemotePage[];
  activeIndex: number;
  onChange: (index: number) => void;
}

export function PageTabs({ pages, activeIndex, onChange }: PageTabsProps) {
  if (pages.length <= 1) {
    return null;
  }

  return (
    <div
      role="tablist"
      aria-label="Deck pages"
      className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]"
    >
      {pages.map((page, index) => {
        const isActive = index === activeIndex;
        return (
          <button
            key={page.id}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onChange(index)}
            className={`h-9 shrink-0 rounded-full border px-3.5 text-xs font-medium transition-colors ${
              isActive
                ? 'border-accent bg-accent-soft text-content'
                : 'border-border-subtle bg-surface text-content-muted active:text-content'
            }`}
          >
            {page.name}
          </button>
        );
      })}
    </div>
  );
}
