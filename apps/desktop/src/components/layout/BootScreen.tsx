import { Grid2x2 } from 'lucide-react';

export function BootScreen() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-canvas">
      <span className="grid size-12 place-items-center rounded-panel border border-border-subtle bg-surface text-accent">
        <Grid2x2 className="size-5" aria-hidden />
      </span>
      <div className="flex items-center gap-2 text-xs text-content-muted">
        <span
          aria-hidden
          className="size-3 animate-spin rounded-full border-2 border-content-muted border-t-transparent"
        />
        Starting ConDeck…
      </div>
    </div>
  );
}
