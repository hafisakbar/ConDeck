import {
  customIconId,
  defaultButtonAppearance,
  type DeckButtonWithAction,
  type ObsSnapshot,
} from '@condeck/shared';
import { Plus } from 'lucide-react';
import { useEffect } from 'react';
import { isButtonActive } from '../../lib/button-status';
import { resolveButtonIcon } from '../../lib/button-icons';
import { cn } from '../../lib/cn';
import type { ExecutionState } from '../../stores/deck-store';
import { useIconStore } from '../../stores/icon-store';

export interface StreamDeckFallbackProps {
  columns: number;
  rows: number;
  buttons: DeckButtonWithAction[];
  selectedButtonId: string | null;
  executions: Record<string, ExecutionState>;
  obs: ObsSnapshot | null;
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
  obs,
  onSelect,
  onActivate,
}: StreamDeckFallbackProps) {
  const sources = useIconStore((state) => state.sources);
  const status = useIconStore((state) => state.status);
  const load = useIconStore((state) => state.load);

  useEffect(() => {
    if (status === 'idle' && buttons.some((button) => customIconId(button.icon))) {
      void load();
    }
  }, [buttons, status, load]);

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
            const customId = button ? customIconId(button.icon) : null;
            const customSource = customId ? (sources[customId] ?? null) : null;
            const execution = button ? executions[button.id] : undefined;
            const selected = button !== null && button.id === selectedButtonId;
            const palette = button
              ? ((button.appearance ?? defaultButtonAppearance(button.backgroundColor, button.textColor))[
                  button !== null && isButtonActive(button, obs) ? 'active' : 'normal'
                ])
              : null;
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
                  button && palette
                    ? {
                        backgroundColor: palette.backgroundColor,
                        color: palette.textColor,
                        borderColor: palette.borderColor,
                        boxShadow: `0 0 ${Math.round(palette.glowIntensity * 18)}px ${palette.glowColor}`,
                        opacity: button.isEnabled ? 1 : 0.5,
                      }
                    : undefined
                }
              >
                {button ? (
                  <>
                    {Icon ? (
                      <Icon className="size-5" aria-hidden />
                    ) : customSource ? (
                      <img src={customSource} alt="" className="size-5 object-contain" />
                    ) : null}
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
