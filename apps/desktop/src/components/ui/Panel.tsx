import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cn('rounded-panel border border-border-subtle bg-surface', className)}>
      {children}
    </section>
  );
}

export interface PanelHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function PanelHeader({ title, description, action, className }: PanelHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b border-border-subtle px-5 py-4', className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-content">{title}</h2>
        {description ? <p className="mt-1 text-xs text-content-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function PanelBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('px-5 py-4', className)}>{children}</div>;
}
