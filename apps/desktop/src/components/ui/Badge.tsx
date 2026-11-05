import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

type BadgeTone = 'accent' | 'neutral' | 'success' | 'danger';

const toneClasses: Record<BadgeTone, string> = {
  accent: 'border-accent/40 bg-accent-soft text-accent',
  neutral: 'border-border-strong bg-surface-raised text-content-muted',
  success: 'border-success/40 bg-success/10 text-success',
  danger: 'border-danger/40 bg-danger-soft text-danger',
};

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        toneClasses[tone],
      )}
    >
      {children}
    </span>
  );
}
