import { cn } from '../../lib/cn';

export type StatusTone = 'online' | 'warning' | 'offline' | 'danger';

const dotClasses: Record<StatusTone, string> = {
  online: 'bg-success',
  warning: 'bg-warning',
  offline: 'bg-content-subtle',
  danger: 'bg-danger',
};

export interface StatusIndicatorProps {
  tone: StatusTone;
  label: string;
  className?: string;
}

export function StatusIndicator({ tone, label, className }: StatusIndicatorProps) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-xs text-content-muted', className)}>
      <span aria-hidden className={cn('size-2 rounded-full', dotClasses[tone])} />
      <span>{label}</span>
    </span>
  );
}
