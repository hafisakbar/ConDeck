import type { RemoteConnectionState } from '../lib/remote-client';

const LABELS: Record<RemoteConnectionState, string> = {
  idle: 'Offline',
  connecting: 'Connecting',
  reconnecting: 'Reconnecting',
  connected: 'Connected',
  error: 'Offline',
};

const TONES: Record<RemoteConnectionState, string> = {
  idle: 'bg-content-subtle',
  connecting: 'bg-warning',
  reconnecting: 'bg-warning',
  connected: 'bg-success',
  error: 'bg-danger',
};

export function ConnectionBadge({ state }: { state: RemoteConnectionState }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface px-2 py-1 text-[11px] font-medium text-content-muted">
      <span
        aria-hidden
        className={`size-1.5 rounded-full ${TONES[state]} ${state === 'connecting' || state === 'reconnecting' ? 'animate-pulse' : ''}`}
      />
      {LABELS[state]}
    </span>
  );
}
