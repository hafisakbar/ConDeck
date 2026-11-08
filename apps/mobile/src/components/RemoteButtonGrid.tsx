import type { RemoteButton, RemotePage } from '@condeck/websocket-protocol';
import type { ActionFeedback } from '../lib/remote-client';

export interface RemoteButtonGridProps {
  page: RemotePage;
  columns: number;
  rows: number;
  feedback: ActionFeedback | null;
  onPress: (buttonId: string) => void;
}

function feedbackRing(button: RemoteButton, feedback: ActionFeedback | null): string {
  if (feedback === null || feedback.buttonId !== button.id) {
    return '';
  }
  if (feedback.status === 'started') {
    return 'ring-2 ring-accent ring-offset-2 ring-offset-canvas animate-pulse';
  }
  if (feedback.status === 'success') {
    return 'ring-2 ring-success ring-offset-2 ring-offset-canvas';
  }
  return 'ring-2 ring-danger ring-offset-2 ring-offset-canvas';
}

export function RemoteButtonGrid({ page, columns, rows, feedback, onPress }: RemoteButtonGridProps) {
  const cells = Math.max(columns * rows, page.buttons.length);
  const byPosition = new Map(page.buttons.map((button) => [button.position, button]));

  return (
    <div
      className="grid h-full gap-1.5"
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
      }}
    >
      {Array.from({ length: cells }, (_, index) => {
        const button = byPosition.get(index);

        if (!button) {
          return (
            <div
              key={`empty-${index}`}
              aria-hidden
              className="rounded-panel border border-dashed border-border-subtle/50"
            />
          );
        }

        const isUsable = button.isEnabled && button.hasAction;

        return (
          <button
            key={button.id}
            type="button"
            aria-label={button.label || 'Unnamed button'}
            aria-disabled={!isUsable}
            onClick={() => {
              if (isUsable) {
                onPress(button.id);
              }
            }}
            style={{ backgroundColor: button.backgroundColor, color: button.textColor }}
            className={`flex h-full w-full min-h-14 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-panel px-1.5 py-2 text-center transition-transform duration-75 active:scale-[0.97] ${feedbackRing(
              button,
              feedback,
            )} ${isUsable ? '' : 'opacity-45'}`}
          >
            {button.icon ? (
              <span aria-hidden className="text-xl leading-none">
                {button.icon}
              </span>
            ) : null}
            <span className="line-clamp-2 text-[11px] font-semibold leading-tight break-words">
              {button.label}
            </span>
            {isUsable ? null : (
              <span className="text-[9px] font-medium uppercase tracking-wide opacity-70">No action</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
