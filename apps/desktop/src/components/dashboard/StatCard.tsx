import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Panel } from '../ui/Panel';

export interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  detail?: ReactNode;
}

export function StatCard({ icon: Icon, label, value, detail }: StatCardProps) {
  return (
    <Panel className="p-4">
      <div className="flex items-center gap-2 text-content-subtle">
        <Icon className="size-3.5" aria-hidden />
        <p className="text-[11px] font-medium tracking-wide uppercase">{label}</p>
      </div>
      <p className="mt-2 truncate text-xl font-semibold text-content" title={value}>
        {value}
      </p>
      {detail ? <div className="mt-1.5 text-xs text-content-muted">{detail}</div> : null}
    </Panel>
  );
}
