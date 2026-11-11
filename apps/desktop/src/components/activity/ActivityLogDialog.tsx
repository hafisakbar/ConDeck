import type { ActivityLog } from '@condeck/shared';
import { ScrollText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useT } from '../../i18n';
import { getBridge, toErrorMessage, unwrap } from '../../lib/desktop-bridge';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Modal } from '../ui/Modal';
import { ActivityList } from './ActivityList';

const PAGE_SIZE = 8;

export interface ActivityLogDialogProps {
  open: boolean;
  initialLogs: ActivityLog[];
  onClose: () => void;
}

/**
 * Temporary full view of the activity log. It never becomes a tab: it fetches
 * the newest 100 entries when opened, pages through them locally and closes back
 * to the dashboard.
 */
export function ActivityLogDialog({ open, initialLogs, onClose }: ActivityLogDialogProps) {
  const t = useT();
  const [logs, setLogs] = useState<ActivityLog[]>(initialLogs);
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setPage(0);
    setError(null);
    setLogs(initialLogs);
    let cancelled = false;
    void (async () => {
      try {
        const fetched = await unwrap(getBridge().listActivity({ limit: 100 }));
        if (!cancelled) {
          setLogs(fetched);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(toErrorMessage(loadError));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Only refetch when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pageCount = Math.max(1, Math.ceil(logs.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const visible = logs.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  const from = logs.length === 0 ? 0 : current * PAGE_SIZE + 1;
  const to = Math.min(logs.length, (current + 1) * PAGE_SIZE);

  return (
    <Modal open={open} title={t('activity.allTitle')} onClose={onClose} size="lg">
      <div className="space-y-3">
        <p className="text-xs text-content-muted">
          {t('activity.allDescription', { count: logs.length })}
        </p>

        <div className="max-h-[52vh] overflow-y-auto rounded-control border border-border-subtle">
          {visible.length > 0 ? (
            <ActivityList logs={visible} />
          ) : (
            <EmptyState
              icon={ScrollText}
              title={t('activity.emptyTitle')}
              description={t('activity.emptyDescription')}
            />
          )}
        </div>

        {error ? <p className="text-xs text-danger">{error}</p> : null}

        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-content-subtle">
            {t('activity.eventsOnPage', { from, to, total: logs.length })}
          </p>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              disabled={current === 0}
              onClick={() => setPage((value) => Math.max(0, value - 1))}
            >
              {t('common.previous')}
            </Button>
            <span className="text-[11px] tabular-nums text-content-subtle">
              {current + 1} / {pageCount}
            </span>
            <Button
              size="sm"
              variant="ghost"
              disabled={current >= pageCount - 1}
              onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
            >
              {t('common.next')}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
