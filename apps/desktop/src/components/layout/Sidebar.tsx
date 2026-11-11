import { useT } from '../../i18n';
import { BrandLogo } from './BrandLogo';
import { cn } from '../../lib/cn';
import { navigationItems } from '../../lib/navigation';
import { useAppStore } from '../../stores/app-store';
import { useNavigationStore } from '../../stores/navigation-store';

export function Sidebar() {
  const t = useT();
  const view = useNavigationStore((state) => state.view);
  const setView = useNavigationStore((state) => state.setView);
  const version = useAppStore((state) => state.appInfo?.version);

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border-subtle bg-surface">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="grid size-9 place-items-center rounded-control bg-accent-soft text-accent">
          <BrandLogo className="size-6" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-content">StreamKey</p>
          <p className="truncate text-[11px] text-content-subtle">{t('app.tagline')}</p>
        </div>
      </div>

      <nav aria-label="Main navigation" className="flex-1 px-3">
        <ul className="space-y-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === view;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setView(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-control px-3 py-2 text-left text-sm transition-colors',
                    isActive
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
    </aside>
  );
}
