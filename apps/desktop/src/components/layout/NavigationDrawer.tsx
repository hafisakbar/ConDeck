import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect } from 'react';
import { useT } from '../../i18n';
import { cn } from '../../lib/cn';
import { navigationItems, type ViewId } from '../../lib/navigation';
import { useAppStore } from '../../stores/app-store';
import { BrandLogo } from './BrandLogo';

export interface NavigationDrawerProps {
  open: boolean;
  view: ViewId;
  onSelect: (view: ViewId) => void;
  onClose: () => void;
}

/**
 * Floating drawer that replaces the permanent sidebar. It overlays the stage,
 * closes on selection, outside click or Escape, and reuses the existing routes.
 */
export function NavigationDrawer({ open, view, onSelect, onClose }: NavigationDrawerProps) {
  const t = useT();
  const version = useAppStore((state) => state.appInfo?.version);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="drawer"
          className="fixed inset-0 z-40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.16 }}
        >
          <button
            type="button"
            aria-label={t('common.close')}
            onClick={onClose}
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px] dark:bg-black/55"
          />

          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={t('topbar.menu')}
            initial={{ x: -28, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 0.61, 0.36, 1] }}
            className="absolute top-3 bottom-3 left-3 flex w-72 flex-col overflow-hidden rounded-2xl border border-border-strong bg-surface shadow-[0_30px_80px_-20px_rgba(0,0,0,0.85)]"
          >
            <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="grid size-9 place-items-center rounded-[10px] bg-accent-soft text-accent">
                  <BrandLogo className="size-6" />
                </span>
                <div>
                  <p className="text-sm font-semibold tracking-tight text-content">StreamKey</p>
                  <p className="text-[11px] text-content-subtle">{t('app.tagline')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t('common.close')}
                className="grid size-7 place-items-center rounded-lg text-content-muted transition-colors hover:bg-surface-hover hover:text-content"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3">
              <ul className="space-y-0.5">
                {navigationItems.map((item) => {
                  const Icon = item.icon;
                  const active = item.id === view;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onSelect(item.id);
                          onClose();
                        }}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
                          active
                            ? 'bg-accent-soft text-accent'
                            : 'text-content-muted hover:bg-surface-hover hover:text-content',
                        )}
                      >
                        <Icon className="size-4 shrink-0" aria-hidden />
                        <span className="truncate">{t(item.labelKey)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="border-t border-border-subtle px-5 py-3">
              <p className="text-[11px] text-content-subtle">
                {t('settings.version')} {version ?? '—'}
              </p>
            </div>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
