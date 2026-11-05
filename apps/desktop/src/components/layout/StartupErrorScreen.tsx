import { TriangleAlert } from 'lucide-react';
import { Button } from '../ui/Button';

export interface StartupErrorScreenProps {
  message: string;
  onRetry: () => void;
}

export function StartupErrorScreen({ message, onRetry }: StartupErrorScreenProps) {
  return (
    <div className="flex h-screen items-center justify-center bg-canvas px-6">
      <div className="w-full max-w-lg rounded-panel border border-danger/40 bg-surface p-6">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-control bg-danger-soft text-danger">
            <TriangleAlert className="size-4" aria-hidden />
          </span>
          <h1 className="text-sm font-semibold text-content">ConDeck could not load its data</h1>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-content-muted">{message}</p>
        <p className="mt-2 text-xs leading-relaxed text-content-subtle">
          If this keeps happening, check the log file from the Electron user data folder.
        </p>
        <Button className="mt-4" variant="primary" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  );
}
