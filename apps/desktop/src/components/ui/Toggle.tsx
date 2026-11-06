import { cn } from '../../lib/cn';

export interface ToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

export function Toggle({ label, description, checked, disabled, onChange }: ToggleProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-medium text-content-muted">{label}</p>
        {description ? <p className="mt-0.5 text-[11px] text-content-subtle">{description}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-60',
          checked ? 'bg-accent' : 'bg-border-strong',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-4 rounded-full bg-white transition-all',
            checked ? 'left-4.5' : 'left-0.5',
          )}
        />
      </button>
    </div>
  );
}
