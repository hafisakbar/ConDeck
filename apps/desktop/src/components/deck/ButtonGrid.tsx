import type { DeckButtonWithAction } from '@condeck/shared';
import { motion } from 'framer-motion';
import { CheckCircle2, Loader2, Play, Plus, TriangleAlert } from 'lucide-react';
import { cn } from '../../lib/cn';
import { resolveButtonIcon } from '../../lib/button-icons';
import type { ExecutionState } from '../../stores/deck-store';

const ariaPosition = (position: number): string => `slot ${position + 1}`;

interface ButtonTileProps {
  button: DeckButtonWithAction;
  selected: boolean;
  execution: ExecutionState | undefined;
  onSelect: () => void;
  onRun: () => void;
}

export function ButtonTile({ button, selected, execution, onSelect, onRun }: ButtonTileProps) {
  const Icon = resolveButtonIcon(button.icon);
  const running = execution?.status === 'running';

  return (
    <div
      className={cn(
        'group relative aspect-square w-full rounded-panel border transition-all',
        selected ? 'border-accent ring-2 ring-accent/40' : 'border-border-strong hover:border-accent/60',
        button.isEnabled ? '' : 'opacity-45',
      )}
      style={{ backgroundColor: button.backgroundColor, color: button.textColor }}
    >
      <motion.button
        type="button"
        onClick={onSelect}
        whileTap={{ scale: 0.97 }}
        aria-pressed={selected}
        aria-label={`${button.label}, ${ariaPosition(button.position)}${button.isEnabled ? '' : ', disabled'}${button.action ? ', has action' : ', no action'}`}
        className="flex h-full w-full flex-col items-center justify-center gap-1.5 rounded-panel p-2 text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {Icon ? <Icon className="size-5 shrink-0" aria-hidden /> : null}
        <span className="line-clamp-2 text-[11px] leading-tight font-medium break-words">
          {button.label}
        </span>
      </motion.button>

      {button.isEnabled ? null : (
        <span className="pointer-events-none absolute top-1 left-1 text-[9px] tracking-wide uppercase opacity-70">
          off
        </span>
      )}

      {execution && execution.status !== 'running' ? (
        <span
          className={cn(
            'pointer-events-none absolute top-1 right-1',
            execution.status === 'failed' ? 'text-danger' : 'text-success',
          )}
          title={execution.message}
        >
          {execution.status === 'failed' ? (
            <TriangleAlert className="size-3.5" aria-hidden />
          ) : (
            <CheckCircle2 className="size-3.5" aria-hidden />
          )}
        </span>
      ) : null}

      {button.action && button.isEnabled ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRun();
          }}
          aria-label={`Run ${button.label}`}
          title={running ? 'Running…' : 'Run action'}
          className="absolute right-1 bottom-1 flex size-5 items-center justify-center rounded-full bg-black/35 text-white transition-colors hover:bg-black/55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed"
          disabled={running}
        >
          {running ? (
            <Loader2 className="size-3 animate-spin" aria-hidden />
          ) : (
            <Play className="size-3" aria-hidden />
          )}
        </button>
      ) : null}
    </div>
  );
}

interface EmptySlotProps {
  position: number;
  onCreate: () => void;
}

export function EmptySlot({ position, onCreate }: EmptySlotProps) {
  return (
    <button
      type="button"
      onClick={onCreate}
      aria-label={`Add a button in ${ariaPosition(position)}`}
      className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-panel border border-dashed border-border-strong/70 text-content-subtle transition-colors hover:border-accent hover:text-accent"
    >
      <Plus className="size-4" aria-hidden />
      <span className="text-[10px]">Empty</span>
    </button>
  );
}

export interface ButtonGridProps {
  columns: number;
  rows: number;
  buttons: DeckButtonWithAction[];
  selectedButtonId: string | null;
  executions: Record<string, ExecutionState>;
  onSelectButton: (buttonId: string) => void;
  onCreateButton: (position: number) => void;
  onRunButton: (buttonId: string) => void;
}

export function ButtonGrid({
  columns,
  rows,
  buttons,
  selectedButtonId,
  executions,
  onSelectButton,
  onCreateButton,
  onRunButton,
}: ButtonGridProps) {
  const byPosition = new Map(buttons.map((button) => [button.position, button]));
  const cells = Array.from({ length: columns * rows }, (_, position) => position);

  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      aria-label={`Button grid, ${columns} by ${rows}`}
    >
      {cells.map((position) => {
        const button = byPosition.get(position);
        return button ? (
          <ButtonTile
            key={button.id}
            button={button}
            selected={button.id === selectedButtonId}
            execution={executions[button.id]}
            onSelect={() => onSelectButton(button.id)}
            onRun={() => onRunButton(button.id)}
          />
        ) : (
          <EmptySlot
            key={`empty-${position}`}
            position={position}
            onCreate={() => onCreateButton(position)}
          />
        );
      })}
    </div>
  );
}
