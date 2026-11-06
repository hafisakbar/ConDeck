import { Plus } from 'lucide-react';
import type { DeckButton } from '@condeck/shared';
import { motion } from 'framer-motion';
import { cn } from '../../lib/cn';
import { resolveButtonIcon } from '../../lib/button-icons';

const ariaPosition = (position: number): string => `slot ${position + 1}`;

interface ButtonTileProps {
  button: DeckButton;
  selected: boolean;
  onSelect: () => void;
}

export function ButtonTile({ button, selected, onSelect }: ButtonTileProps) {
  const Icon = resolveButtonIcon(button.icon);

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileTap={{ scale: 0.97 }}
      aria-pressed={selected}
      aria-label={`${button.label}, ${ariaPosition(button.position)}${button.isEnabled ? '' : ', disabled'}`}
      className={cn(
        'group relative flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-panel border p-2 text-center transition-all',
        selected ? 'border-accent ring-2 ring-accent/40' : 'border-border-strong hover:border-accent/60',
        button.isEnabled ? '' : 'opacity-45',
      )}
      style={{ backgroundColor: button.backgroundColor, color: button.textColor }}
    >
      {Icon ? <Icon className="size-5 shrink-0" aria-hidden /> : null}
      <span className="line-clamp-2 text-[11px] leading-tight font-medium break-words">{button.label}</span>
      {button.isEnabled ? null : (
        <span className="absolute top-1 right-1 text-[9px] tracking-wide uppercase opacity-70">off</span>
      )}
    </motion.button>
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
  buttons: DeckButton[];
  selectedButtonId: string | null;
  onSelectButton: (buttonId: string) => void;
  onCreateButton: (position: number) => void;
}

export function ButtonGrid({
  columns,
  rows,
  buttons,
  selectedButtonId,
  onSelectButton,
  onCreateButton,
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
            onSelect={() => onSelectButton(button.id)}
          />
        ) : (
          <EmptySlot key={`empty-${position}`} position={position} onCreate={() => onCreateButton(position)} />
        );
      })}
    </div>
  );
}
