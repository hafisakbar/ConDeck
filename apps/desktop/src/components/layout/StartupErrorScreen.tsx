import { TriangleAlert } from 'lucide-react';
import { useT } from '../../i18n';
import { Button } from '../ui/Button';

export interface StartupErrorScreenProps {
  message: string;
  onRetry: () => void;
}

export function StartupErrorScreen({ message, onRetry }: StartupErrorScreenProps) {
  const t = useT();
  return (
    <div className="flex h-screen items-center justify-center bg-canvas px-6">
      <div className="w-full max-w-lg rounded-panel border border-danger/40 bg-surface p-6">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-control bg-danger-soft text-danger">
            <TriangleAlert className="size-4" aria-hidden />
          </span>
          <h1 className="text-sm font-semibold text-content">{t('boot.errorTitle')}</h1>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-content-muted">{message}</p>
        <p className="mt-2 text-xs leading-relaxed text-content-subtle">
          {t('boot.errorHint')}
        </p>
        <Button className="mt-4" variant="primary" onClick={onRetry}>
          {t('boot.retry')}
        </Button>
      </div>
    </div>
  );
}
