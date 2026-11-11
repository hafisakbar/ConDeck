import { Languages, Moon, Sun } from 'lucide-react';
import { useT } from '../../i18n';
import { cn } from '../../lib/cn';
import { usePreferencesStore, type Locale } from '../../stores/preferences-store';

const LOCALES: ReadonlyArray<{ id: Locale; label: string }> = [
  { id: 'id', label: 'ID' },
  { id: 'en', label: 'EN' },
];

/** Global appearance and language switches, next to each other in the top bar. */
export function ThemeLanguageControls() {
  const t = useT();
  const theme = usePreferencesStore((state) => state.theme);
  const locale = usePreferencesStore((state) => state.locale);
  const toggleTheme = usePreferencesStore((state) => state.toggleTheme);
  const setLocale = usePreferencesStore((state) => state.setLocale);

  return (
    <div className="flex items-center gap-1">
      <div
        className="flex items-center gap-0.5 rounded-lg bg-canvas/70 p-0.5"
        role="group"
        aria-label={t('topbar.language')}
      >
        <Languages className="ml-1 size-3 text-content-subtle" aria-hidden />
        {LOCALES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setLocale(entry.id)}
            aria-pressed={locale === entry.id}
            className={cn(
              'rounded-md px-1.5 py-0.5 text-[10px] font-semibold transition-colors',
              locale === entry.id
                ? 'bg-surface-hover text-content'
                : 'text-content-subtle hover:text-content',
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? t('topbar.switchToLight') : t('topbar.switchToDark')}
        title={theme === 'dark' ? t('topbar.switchToLight') : t('topbar.switchToDark')}
        className="grid size-8 place-items-center rounded-lg text-content-subtle transition-colors hover:bg-surface-hover hover:text-content"
      >
        {theme === 'dark' ? (
          <Sun className="size-4" aria-hidden />
        ) : (
          <Moon className="size-4" aria-hidden />
        )}
      </button>
    </div>
  );
}
