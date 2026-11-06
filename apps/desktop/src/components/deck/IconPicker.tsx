import { buttonIconNames, type ButtonIconName } from '@condeck/shared';
import { Ban } from 'lucide-react';
import { resolveButtonIcon } from '../../lib/button-icons';
import { cn } from '../../lib/cn';

export interface IconPickerProps {
  value: ButtonIconName | null;
  onChange: (value: ButtonIconName | null) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-content-muted">Icon</p>
      <div className="grid max-h-40 grid-cols-7 gap-1 overflow-y-auto rounded-control border border-border-subtle p-1.5">
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="No icon"
          aria-pressed={value === null}
          className={cn(
            'grid aspect-square place-items-center rounded border transition-colors',
            value === null
              ? 'border-accent bg-accent-soft text-accent'
              : 'border-transparent text-content-muted hover:bg-surface-hover',
          )}
        >
          <Ban className="size-3.5" aria-hidden />
        </button>

        {buttonIconNames.map((name) => {
          const Icon = resolveButtonIcon(name);
          if (!Icon) {
            return null;
          }
          const selected = value === name;
          return (
            <button
              key={name}
              type="button"
              onClick={() => onChange(name)}
              aria-label={name}
              aria-pressed={selected}
              title={name}
              className={cn(
                'grid aspect-square place-items-center rounded border transition-colors',
                selected
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-transparent text-content-muted hover:bg-surface-hover hover:text-content',
              )}
            >
              <Icon className="size-3.5" aria-hidden />
            </button>
          );
        })}
      </div>
    </div>
  );
}
