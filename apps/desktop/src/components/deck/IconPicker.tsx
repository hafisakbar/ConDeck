import type { ButtonIcon } from '@condeck/shared';
import { Ban, ImagePlus, Loader2, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../../i18n';
import { resolveButtonIcon } from '../../lib/button-icons';
import { cn } from '../../lib/cn';
import { filterIcons, iconCategories, iconLibrary, type IconCategory } from '../../lib/icon-library';
import { useIconStore } from '../../stores/icon-store';
import { Button } from '../ui/Button';

export interface IconPickerProps {
  value: ButtonIcon | null;
  onChange: (value: ButtonIcon | null) => void;
}

/** Built-in catalogue plus the user's own images, with search in both tabs. */
export function IconPicker({ value, onChange }: IconPickerProps) {
  const t = useT();
  const icons = useIconStore((state) => state.icons);
  const status = useIconStore((state) => state.status);
  const error = useIconStore((state) => state.error);
  const load = useIconStore((state) => state.load);
  const upload = useIconStore((state) => state.upload);
  const remove = useIconStore((state) => state.remove);
  const clearError = useIconStore((state) => state.clearError);

  const [tab, setTab] = useState<'library' | 'mine'>('library');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<IconCategory | 'all'>('all');
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === 'idle') {
      void load();
    }
  }, [status, load]);

  const visible = useMemo(() => filterIcons(iconLibrary, query, category), [query, category]);
  const customVisible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return icons.filter((icon) => !needle || icon.name.toLowerCase().includes(needle));
  }, [icons, query]);

  async function handleFile(file: File | undefined): Promise<void> {
    if (!file) {
      return;
    }
    setUploading(true);
    const next = await upload(file);
    setUploading(false);
    if (next) {
      onChange(next);
    }
  }

  const errorText =
    error === 'invalid' ? t('icons.invalid') : error && error.length < 60 ? error : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-content-muted">{t('icons.title')}</p>
        <div className="flex items-center rounded-lg bg-canvas/70 p-0.5">
          {(['library', 'mine'] as const).map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => setTab(entry)}
              aria-pressed={tab === entry}
              className={cn(
                'rounded-md px-2 py-0.5 text-[10px] font-semibold transition-colors',
                tab === entry ? 'bg-surface-hover text-content' : 'text-content-subtle hover:text-content',
              )}
            >
              {entry === 'library' ? t('icons.builtIn') : t('icons.mine')}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-2.5 left-2.5 size-3.5 text-content-subtle" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('icons.search')}
          aria-label={t('common.search')}
          className="w-full rounded-control border border-border-subtle bg-surface-raised py-1.5 pr-2.5 pl-8 text-xs text-content placeholder:text-content-subtle focus:border-accent focus:outline-none"
        />
      </div>

      {tab === 'library' ? (
        <>
          <div className="flex flex-wrap gap-1">
            {(['all', ...iconCategories] as const).map((entry) => (
              <button
                key={entry}
                type="button"
                onClick={() => setCategory(entry)}
                aria-pressed={category === entry}
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors',
                  category === entry
                    ? 'bg-accent-soft text-accent'
                    : 'text-content-subtle hover:bg-surface-hover hover:text-content',
                )}
              >
                {t(`icons.categories.${entry}`)}
              </button>
            ))}
          </div>

          <div className="grid max-h-44 grid-cols-7 gap-1 overflow-y-auto rounded-control border border-border-subtle p-1.5">
            <button
              type="button"
              onClick={() => onChange(null)}
              aria-label={t('icons.noIcon')}
              aria-pressed={value === null}
              className={cn(
                'grid aspect-square place-items-center rounded border transition-colors',
                value === null
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-transparent text-content-muted hover:bg-surface-hover',
              )}
            >
              <Ban className="size-3.5" aria-hidden />
            </button>

            {visible.map((entry) => {
              const Icon = resolveButtonIcon(entry.name);
              if (!Icon) {
                return null;
              }
              const selected = value === entry.name;
              return (
                <button
                  key={entry.name}
                  type="button"
                  title={entry.name}
                  onClick={() => onChange(entry.name)}
                  aria-label={entry.name}
                  aria-pressed={selected}
                  className={cn(
                    'grid aspect-square place-items-center rounded border transition-colors',
                    selected
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-transparent text-content-muted hover:bg-surface-hover hover:text-content',
                  )}
                >
                  <Icon className="size-3.5" aria-hidden />
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-content-subtle">
            {visible.length === 0 ? t('icons.noResults') : t('icons.count', { count: visible.length })}
          </p>
        </>
      ) : (
        <div className="space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => {
              void handleFile(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          <Button
            size="sm"
            className="w-full"
            variant="secondary"
            loading={uploading}
            icon={<ImagePlus className="size-3.5" aria-hidden />}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? t('icons.uploading') : t('icons.upload')}
          </Button>

          {customVisible.length > 0 ? (
            <div className="grid max-h-40 grid-cols-6 gap-1 overflow-y-auto rounded-control border border-border-subtle p-1.5">
              {customVisible.map((icon) => {
                const selected = value === `custom:${icon.id}`;
                return (
                  <div key={icon.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => onChange(`custom:${icon.id}`)}
                      title={icon.name}
                      aria-label={icon.name}
                      aria-pressed={selected}
                      className={cn(
                        'grid aspect-square w-full place-items-center rounded border bg-surface-raised p-1 transition-colors',
                        selected ? 'border-accent ring-1 ring-accent/50' : 'border-border-subtle hover:border-border-strong',
                      )}
                    >
                      <img src={icon.dataUrl} alt="" className="max-h-full max-w-full object-contain" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void remove(icon.id);
                        if (selected) {
                          onChange(null);
                        }
                      }}
                      aria-label={t('icons.delete')}
                      title={t('icons.delete')}
                      className="absolute -top-1 -right-1 hidden size-4 place-items-center rounded-full bg-danger text-white group-hover:grid"
                    >
                      <Trash2 className="size-2.5" aria-hidden />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="rounded-control border border-dashed border-border-subtle px-2.5 py-3 text-center text-[10px] leading-relaxed text-content-subtle">
              {t('icons.noCustom')}
            </p>
          )}

          {uploading ? (
            <p className="flex items-center gap-1 text-[10px] text-content-subtle">
              <Loader2 className="size-3 animate-spin" aria-hidden /> {t('icons.uploading')}
            </p>
          ) : null}
        </div>
      )}

      {errorText ? (
        <button type="button" onClick={clearError} className="text-left text-[10px] text-danger">
          {errorText}
        </button>
      ) : null}
    </div>
  );
}
