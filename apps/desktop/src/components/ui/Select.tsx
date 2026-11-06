import { useId, type SelectHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: string;
  error?: string;
}

export function Select({ label, hint, error, id, className, children, ...rest }: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <div className="space-y-1.5">
      <label htmlFor={selectId} className="block text-xs font-medium text-content-muted">
        {label}
      </label>
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        className={cn(
          'h-10 w-full rounded-control border bg-canvas px-3 text-sm text-content',
          'transition-colors focus:border-accent focus:outline-none',
          error ? 'border-danger' : 'border-border-strong',
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-content-subtle">{hint}</p>
      ) : null}
    </div>
  );
}
