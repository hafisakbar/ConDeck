import type { ActivityLog } from '@condeck/shared';
import { ScrollText } from 'lucide-react';
import { useT } from '../../i18n';
import { formatDateTime, formatRelativeTime } from '../../lib/format';
import { EmptyState } from '../ui/EmptyState';

export interface ActivityListProps {
  logs: ActivityLog[];
  emptyTitle?: string;
  emptyDescription?: string;
}

export function ActivityList({ logs, emptyTitle, emptyDescription }: ActivityListProps) {
  const t = useT();

  if (logs.length === 0) {
    return (
      <EmptyState
        icon={ScrollText}
        title={emptyTitle ?? t('activity.emptyTitle')}
        description={emptyDescription ?? t('activity.emptyDescription')}
      />
    );
  }

  return (
    <ul className="divide-y divide-border-subtle">
      {logs.map((log) => (
        <li key={log.id} className="flex items-start justify-between gap-4 px-5 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm text-content">{log.description}</p>
            <p className="mt-0.5 font-mono text-[11px] text-content-subtle">{log.eventType}</p>
          </div>
          <time
            dateTime={log.createdAt}
            title={formatDateTime(log.createdAt)}
            className="shrink-0 text-[11px] text-content-subtle"
          >
            {formatRelativeTime(log.createdAt)}
          </time>
        </li>
      ))}
    </ul>
  );
}
