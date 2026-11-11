import {
  actionCategories,
  type ActionCatalogEntry,
  type ActionType,
} from '@condeck/shared';
import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useT } from '../../i18n';
import { actionIcon } from '../../lib/action-icons';
import { cn } from '../../lib/cn';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';

export interface ActionPickerDialogProps {
  open: boolean;
  catalog: ActionCatalogEntry[];
  selected: ActionType | '';
  onSelect: (type: ActionType | '') => void;
  onClose: () => void;
}

/**
 * Categorised, searchable action browser. It replaces the old flat <select> and
 * only lists actions the catalog really exposes; choosing one closes the sheet
 * and leaves configuration to the editor below.
 */
export function ActionPickerDialog({
  open,
  catalog,
  selected,
  onSelect,
  onClose,
}: ActionPickerDialogProps) {
  const t = useT();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('ALL');

  const categories = useMemo(
    () => actionCategories.filter((entry) => catalog.some((item) => item.category === entry)),
    [catalog],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return catalog.filter((entry) => {
      if (category !== 'ALL' && entry.category !== category) {
        return false;
      }
      if (!needle) {
        return true;
      }
      const label = t(`action.types.${entry.type}.label`).toLowerCase();
      const description = t(`action.types.${entry.type}.description`).toLowerCase();
      return label.includes(needle) || description.includes(needle) || entry.type.toLowerCase().includes(needle);
    });
  }, [catalog, category, query, t]);

  function choose(type: ActionType | ''): void {
    onSelect(type);
    onClose();
  }

  return (
    <Modal
      open={open}
      title={selected ? t('action.change') : t('action.choose')}
      description={t('action.chooseHint')}
      onClose={onClose}
      size="lg"
    >
      <div className="space-y-3">
        <Input
          label={t('common.search')}
          placeholder={t('action.search')}
          value={query}
          autoFocus
          onChange={(event) => setQuery(event.target.value)}
        />

        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setCategory('ALL')}
            aria-pressed={category === 'ALL'}
            className={cn(
              'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
              category === 'ALL'
                ? 'bg-accent-soft text-accent'
                : 'text-content-muted hover:bg-surface-hover hover:text-content',
            )}
          >
            {t('action.all')}
          </button>
          {categories.map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => setCategory(entry)}
              aria-pressed={category === entry}
              className={cn(
                'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                category === entry
                  ? 'bg-accent-soft text-accent'
                  : 'text-content-muted hover:bg-surface-hover hover:text-content',
              )}
            >
              {t(`action.categories.${entry}`)}
            </button>
          ))}
        </div>

        <div className="max-h-[42vh] space-y-1 overflow-y-auto pr-1">
          <button
            type="button"
            onClick={() => choose('')}
            className={cn(
              'flex w-full items-start gap-3 rounded-control border px-3 py-2 text-left transition-colors',
              selected === ''
                ? 'border-accent/60 bg-accent-soft/40'
                : 'border-border-subtle hover:bg-surface-hover',
            )}
          >
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-border-subtle text-content-subtle">
              <Search className="size-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-medium text-content">{t('action.noAction')}</span>
              <span className="mt-0.5 block text-[11px] text-content-subtle">{t('action.chooseHint')}</span>
            </span>
          </button>

          {visible.map((entry) => {
            const Icon = actionIcon(entry.type);
            const active = selected === entry.type;
            return (
              <button
                key={entry.type}
                type="button"
                onClick={() => choose(entry.type)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-control border px-3 py-2 text-left transition-colors',
                  active
                    ? 'border-accent/60 bg-accent-soft/40'
                    : 'border-border-subtle hover:bg-surface-hover',
                )}
              >
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-border-subtle text-accent">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="text-xs font-medium text-content">
                      {t(`action.types.${entry.type}.label`)}
                    </span>
                    <span className="rounded bg-surface-raised px-1 py-0.5 text-[9px] tracking-wide text-content-subtle uppercase">
                      {t(`action.categories.${entry.category}`)}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-content-muted">
                    {t(`action.types.${entry.type}.description`)}
                  </span>
                </span>
              </button>
            );
          })}

          {visible.length === 0 ? (
            <p className="px-1 py-6 text-center text-xs text-content-subtle">{t('action.empty')}</p>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
