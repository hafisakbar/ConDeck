import { Grid2x2, Menu, RefreshCw, X } from 'lucide-react';
import { getNavigationItem } from '../../lib/navigation';
import { obsLabelByState, obsToneByState } from '../../lib/obs';
import { useAppStore } from '../../stores/app-store';
import { useNavigationStore } from '../../stores/navigation-store';
import { StatusIndicator } from '../ui/StatusIndicator';

export interface TopBarProps {
  onOpenMenu: () => void;
}

/** Compact chrome: menu button, current location and two status lights. */
export function TopBar({ onOpenMenu }: TopBarProps) {
  const view = useNavigationStore((state) => state.view);
  const summary = useAppStore((state) => state.summary);
  const error = useAppStore((state) => state.error);
  const dismissError = useAppStore((state) => state.dismissError);
  const refresh = useAppStore((state) => state.refresh);
  const item = getNavigationItem(view);
  const onlineDevices = summary?.devices.online ?? 0;

  return (
    <header className="relative z-30 flex h-14 shrink-0 items-center gap-3 px-3">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open menu"
        aria-haspopup="dialog"
        className="grid size-9 place-items-center rounded-xl text-content-muted transition-colors hover:bg-surface-hover hover:text-content"
      >
        <Menu className="size-4.5" aria-hidden />
      </button>

      <div className="flex min-w-0 items-center gap-2">
        <span className="grid size-6 place-items-center rounded-md bg-accent-soft text-accent">
          <Grid2x2 className="size-3" aria-hidden />
        </span>
        <span className="text-sm font-semibold tracking-tight text-content">ConDeck</span>
        <span className="truncate text-[11px] text-content-subtle" aria-label={`Current page: ${item.label}`}>
          / {item.label}
        </span>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-4">
        <StatusIndicator
          tone={summary ? obsToneByState[summary.obs.state] : 'offline'}
          label={`OBS: ${summary ? obsLabelByState[summary.obs.state] : 'Unknown'}`}
          className="hidden sm:flex"
        />
        <StatusIndicator
          tone={onlineDevices > 0 ? 'online' : 'offline'}
          label={`${onlineDevices} remote ${onlineDevices === 1 ? 'device' : 'devices'}`}
          className="hidden md:flex"
        />
        <button
          type="button"
          onClick={() => void refresh()}
          aria-label="Refresh status"
          title="Refresh status"
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
            aria-label="Dismiss message"
            className="shrink-0 text-danger/80 hover:text-danger"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      ) : null}
    </header>
  );
}
