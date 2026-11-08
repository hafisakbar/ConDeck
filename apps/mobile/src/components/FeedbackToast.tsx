import { useEffect } from 'react';
import type { ActionFeedback } from '../lib/remote-client';

export interface FeedbackToastProps {
  feedback: ActionFeedback;
  buttonLabel: string | null;
  onDismiss: () => void;
}

const TONE: Record<ActionFeedback['status'], string> = {
  started: 'border-border-strong bg-surface-raised text-content-muted',
  success: 'border-success/40 bg-surface-raised text-success',
  failed: 'border-danger/40 bg-danger-soft text-danger',
};

export function FeedbackToast({ feedback, buttonLabel, onDismiss }: FeedbackToastProps) {
  useEffect(() => {
    if (feedback.status === 'started') {
      return;
    }
    const timer = setTimeout(onDismiss, 3_500);
    return () => clearTimeout(timer);
  }, [feedback, onDismiss]);

  const title = buttonLabel ?? (feedback.status === 'failed' ? 'Action failed' : 'Action');

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-20"
    >
      <div
        className={`pointer-events-auto flex items-center gap-2.5 rounded-control border px-3.5 py-2.5 shadow-lg shadow-black/40 backdrop-blur ${TONE[feedback.status]}`}
      >
        {feedback.status === 'started' ? (
          <span
            aria-hidden
            className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold">{title}</p>
          <p className="truncate text-[11px] text-content-muted">{feedback.message}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="grid size-7 shrink-0 place-items-center rounded-full text-content-subtle active:text-content"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
