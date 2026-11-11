import { Menu, RefreshCw, X } from 'lucide-react';
import { useT } from '../../i18n';
import { getNavigationItem } from '../../lib/navigation';
import { obsToneByState } from '../../lib/obs';
import { useAppStore } from '../../stores/app-store';
import { useNavigationStore } from '../../stores/navigation-store';
import { StatusIndicator } from '../ui/StatusIndicator';
import { BrandLogo } from './BrandLogo';
import { ThemeLanguageControls } from './ThemeLanguageControls';

export interface TopBarProps {
  onOpenMenu: () => void;
}

/** Compact chrome: menu, current location, status lights, theme and language. */
export function TopBar({ onOpenMenu }: TopBarProps) {
  const t = useT();
  const view = useNavigationStore((state) => state.view);
  const summary = useAppStore((state) => state.summary);
  const error = useAppStore((state) => state.error);
  const dismissError = useAppStore((state) => state.dismissError);
  const refresh = useAppStore((state) => state.refresh);
  const item = getNavigationItem(view);
  const label = t(item.labelKey);
  const onlineDevices = summary?.devices.online ?? 0;

  return (
    <header className="relative z-30 flex h-14 shrink-0 items-center gap-3 px-3">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label={t('topbar.menu')}
        aria-haspopup="dialog"
        className="grid size-9 place-items-center rounded-xl text-content-muted transition-colors hover:bg-surface-hover hover:text-content"
      >
        <Menu className="size-4.5" aria-hidden />
      </button>

      <div className="flex min-w-0 items-center gap-2">
        <span className="grid size-6 place-items-center rounded-md bg-accent-soft text-accent">
          <BrandLogo className="size-4" />
        </span>
        <span className="text-sm font-semibold tracking-tight text-content">StreamKey</span>
        <span
          className="truncate text-[11px] text-content-subtle"
          aria-label={t('topbar.currentPage', { name: label })}
        >
          / {label}
        </span>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2.5">
        <StatusIndicator
          tone={summary ? obsToneByState[summary.obs.state] : 'offline'}
          label={`${t('topbar.obs')}: ${summary ? t(`obs.${summary.obs.state}`) : t('common.none')}`}
          className="hidden lg:flex"
        />
        <StatusIndicator
          tone={onlineDevices > 0 ? 'online' : 'offline'}
          label={t(onlineDevices === 1 ? 'topbar.remoteOne' : 'topbar.remoteMany', {
            count: onlineDevices,
          })}
          className="hidden xl:flex"
        />
        <ThemeLanguageControls />
        <button
          type="button"
          onClick={() => void refresh()}
          aria-label={t('topbar.refresh')}
          title={t('topbar.refresh')}
          className="grid size-8 place-items-center rounded-lg text-content-subtle transition-colors hover:bg-surface-hover hover:text-content"
        >
          <RefreshCw className="size-3.5" aria-hidden />
        </button>
      </div>

      {error ? (
        <div
          role="alert"
          className="absolute top-full left-1/2 z-40 flex w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 items-start justify-between gap-3 rounded-xl border border-danger/40 bg-danger-soft px-3 py-2 shadow-lg"
        >
          <p className="text-xs leading-relaxed text-danger">{error}</p>
          <button
            type="button"
            onClick={dismissError}
            aria-label={t('common.close')}
            className="shrink-0 text-danger/80 hover:text-danger"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      ) : null}
    </header>
  );
}
