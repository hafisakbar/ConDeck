import type { ReactNode } from 'react';
import { BrandLogo } from '../components/layout/BrandLogo';
import { Panel, PanelBody } from '../components/ui/Panel';
import { useT } from '../i18n';
import { useAppStore } from '../stores/app-store';

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-border-subtle py-3 last:border-b-0 sm:grid-cols-[180px_1fr] sm:items-baseline sm:gap-4">
      <dt className="text-xs text-content-subtle">{label}</dt>
      <dd className="min-w-0 text-xs break-all text-content">{children}</dd>
    </div>
  );
}

/** Settings is now purely informational; theme and language live in the top bar. */
export function SettingsPage() {
  const t = useT();
  const appInfo = useAppStore((state) => state.appInfo);
  const year = new Date().getFullYear();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Panel>
        <div className="flex items-start gap-4 border-b border-border-subtle px-5 py-5">
          <span className="grid size-12 shrink-0 place-items-center rounded-panel bg-accent-soft text-accent">
            <BrandLogo className="size-8" />
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-content">StreamKey</h1>
            <p className="mt-1 text-xs leading-relaxed text-content-muted">{t('settings.descriptionText')}</p>
            <p className="mt-2 text-[11px] text-content-subtle">{t('settings.copyright', { year })}</p>
          </div>
        </div>
        <PanelBody>
          <dl>
            <InfoRow label={t('settings.application')}>{appInfo?.name ?? 'StreamKey'}</InfoRow>
            <InfoRow label={t('settings.version')}>{appInfo?.version ?? '—'}</InfoRow>
            <InfoRow label={t('settings.platform')}>{appInfo?.platform ?? '—'}</InfoRow>
            <InfoRow label={t('settings.build')}>
              {appInfo
                ? t(appInfo.isPackaged ? 'settings.packaged' : 'settings.development')
                : '—'}
            </InfoRow>
            <InfoRow label={t('settings.database')}>{appInfo?.databasePath ?? '—'}</InfoRow>
            <InfoRow label={t('settings.logFile')}>{appInfo?.logPath ?? '—'}</InfoRow>
          </dl>
        </PanelBody>
      </Panel>
    </div>
  );
}
