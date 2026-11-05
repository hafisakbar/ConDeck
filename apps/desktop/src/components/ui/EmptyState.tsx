import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, children }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <span className="grid size-11 place-items-center rounded-panel border border-border-subtle bg-surface-raised text-content-muted">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium text-content">{title}</p>
        <p className="mx-auto max-w-md text-xs leading-relaxed text-content-muted">{description}</p>
      </div>
      {children ? <div className="pt-1">{children}</div> : null}
    </div>
  );
}
