import { useT } from '../../i18n';
import { BrandLogo } from './BrandLogo';

export function BootScreen() {
  const t = useT();
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-canvas">
      <span className="grid size-12 place-items-center rounded-panel border border-border-subtle bg-surface text-accent">
        <BrandLogo className="size-8" />
      </span>
      <div className="flex items-center gap-2 text-xs text-content-muted">
        <span
          aria-hidden
          className="size-3 animate-spin rounded-full border-2 border-content-muted border-t-transparent"
        />
        {t('boot.starting')}
      </div>
    </div>
  );
}
