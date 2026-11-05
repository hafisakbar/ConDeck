import { RefreshCw, X } from 'lucide-react';
import { getNavigationItem } from '../../lib/navigation';
import { obsLabelByState, obsToneByState } from '../../lib/obs';
import { useAppStore } from '../../stores/app-store';
import { useNavigationStore } from '../../stores/navigation-store';
import { Button } from '../ui/Button';
import { StatusIndicator } from '../ui/StatusIndicator';

export function TopBar() {
  const view = useNavigationStore((state) => state.view);
  const summary = useAppStore((state) => state.summary);
  const error = useAppStore((state) => state.error);
  const dismissError = useAppStore((state) => state.dismissError);
  const refresh = useAppStore((state) => state.refresh);
  const item = getNavigationItem(view);

  const onlineDevices = summary?.devices.online ?? 0;

  return (
    <header className="border-b border-border-subtle bg-canvas px-8 py-4">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-content">{item.headline}</h1>
          <p className="mt-1 text-xs text-content-muted">{item.description}</p>
        </div>

        <div className="flex shrink-0 items-center gap-5">
          <StatusIndicator
            tone={summary ? obsToneByState[summary.obs.state] : 'offline'}
            label={`OBS: ${summary ? obsLabelByState[summary.obs.state] : 'Unknown'}`}
          />
          <StatusIndicator
            tone={onlineDevices > 0 ? 'online' : 'offline'}
            label={`${onlineDevices} remote ${onlineDevices === 1 ? 'device' : 'devices'} online`}
          />
          <Button
            size="sm"
            variant="ghost"
            icon={<RefreshCw className="size-3.5" aria-hidden />}
            onClick={() => void refresh()}
          >
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="mt-3 flex items-start justify-between gap-3 rounded-control border border-danger/40 bg-danger-soft px-3 py-2"
        >
          <p className="text-xs leading-relaxed text-danger">{error}</p>
          <button
            type="button"
            onClick={dismissError}
            aria-label="Dismiss message"
            className="text-danger/80 hover:text-danger"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      ) : null}
    </header>
  );
}
