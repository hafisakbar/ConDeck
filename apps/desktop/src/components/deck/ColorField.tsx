import { useId, useState } from 'react';
import { cn } from '../../lib/cn';

const SWATCHES = [
  '#1b2030',
  '#0f172a',
  '#211c3d',
  '#3d1d24',
  '#123a2b',
  '#1d3348',
  '#3d331d',
  '#2b2b33',
  '#7c5cff',
  '#e35663',
  '#34c17b',
  '#d8a13a',
  '#e8ebf2',
  '#0a0c11',
];

const HEX_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function ColorField({ label, value, onChange }: ColorFieldProps) {
  const inputId = useId();
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);

  function commit(next: string) {
    setDraft(next);
    if (HEX_PATTERN.test(next.trim())) {
      setError(null);
      onChange(next.trim());
    } else {
      setError('Use a hex colour such as #1b2030.');
    }
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-xs font-medium text-content-muted">
        {label}
      </label>

      <div className="flex items-center gap-2">
        <input
          id={inputId}
          type="color"
          value={HEX_PATTERN.test(draft) ? draft : '#000000'}
          onChange={(event) => commit(event.target.value)}
          aria-label={`${label} picker`}
          className="h-8 w-9 shrink-0 cursor-pointer rounded border border-border-strong bg-canvas"
        />
        <input
          type="text"
          value={draft}
          onChange={(event) => commit(event.target.value)}
          aria-invalid={error ? true : undefined}
          className={cn(
            'h-8 w-full rounded-control border bg-canvas px-2 font-mono text-xs text-content',
            error ? 'border-danger' : 'border-border-strong',
          )}
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SWATCHES.map((swatch) => (
          <button
            key={swatch}
            type="button"
            aria-label={`Use ${swatch}`}
            onClick={() => commit(swatch)}
            style={{ backgroundColor: swatch }}
            className={cn(
              'size-5 rounded border transition-transform hover:scale-110',
              value.toLowerCase() === swatch.toLowerCase() ? 'border-accent' : 'border-border-strong',
            )}
          />
        ))}
      </div>

      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
