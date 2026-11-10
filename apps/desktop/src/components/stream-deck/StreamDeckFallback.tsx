import type { DeckButtonWithAction } from '@condeck/shared';
import { Plus } from 'lucide-react';
import { resolveButtonIcon } from '../../lib/button-icons';
import { cn } from '../../lib/cn';
import type { ExecutionState } from '../../stores/deck-store';

export interface StreamDeckFallbackProps {
  columns: number;
  rows: number;
  buttons: DeckButtonWithAction[];
  selectedButtonId: string | null;
  executions: Record<string, ExecutionState>;
  onSelect: (position: number, buttonId: string | null) => void;
  onActivate: (buttonId: string) => void;
}

/**
 * WebGL is not available (old GPU, remote desktop, disabled graphics). The deck
 * stays fully usable as a flat device instead of showing an empty canvas.
 */
export function StreamDeckFallback({
  columns,
  rows,
  buttons,
  selectedButtonId,
  executions,
  onSelect,
  onActivate,
}: StreamDeckFallbackProps) {
  const byPosition = new Map(buttons.map((button) => [button.position, button]));
  const slots = Array.from({ length: columns * rows }, (_, position) => position);

  return (
    <div className="flex h-full w-full items-center justify-center overflow-auto p-10">
      <div className="rounded-[28px] border border-white/10 bg-gradient-to-b from-[#1b1e24] to-[#111318] p-5 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.9)]">
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(64px, 1fr))` }}
        >
          {slots.map((position) => {
            const button = byPosition.get(position) ?? null;
            const Icon = button ? resolveButtonIcon(button.icon) : null;
            const execution = button ? executions[button.id] : undefined;
            const selected = button !== null && button.id === selectedButtonId;
            return (
              <button
                key={button?.id ?? `empty-${position}`}
                type="button"
                aria-label={button ? `${button.label}, slot ${position + 1}` : `Empty slot ${position + 1}`}
                onClick={() => {
                  if (!button) {
                    onSelect(position, null);
                    return;
                  }
                  if (button.isEnabled && button.action) {
                    onActivate(button.id);
                  }
                  onSelect(position, button.id);
                }}
                className={cn(
                  'relative flex aspect-square w-20 flex-col items-center justify-center gap-1 rounded-xl border text-center transition-all',
                  selected ? 'border-accent ring-2 ring-accent/50' : 'border-white/10 hover:border-white/25',
                )}
                style={
                  button
                    ? { backgroundColor: button.backgroundColor, color: button.textColor, opacity: button.isEnabled ? 1 : 0.5 }
                    : undefined
                }
              >
                {button ? (
                  <>
                    {Icon ? <Icon className="size-5" aria-hidden /> : null}
                    <span className="line-clamp-2 px-1 text-[10px] leading-tight font-medium break-words">
                      {button.label}
                    </span>
                    {execution ? (
                      <span
                        className={cn(
                          'absolute top-1 right-1 size-1.5 rounded-full',
                          execution.status === 'failed'
                            ? 'bg-danger'
                            : execution.status === 'success'
                              ? 'bg-success'
                              : 'bg-white',
                        )}
                      />
                    ) : null}
                  </>
                ) : (
                  <Plus className="size-4 text-white/30" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-4 text-center text-[10px] tracking-[0.3em] text-white/25 uppercase">ConDeck</p>
      </div>
    </div>
  );
}
