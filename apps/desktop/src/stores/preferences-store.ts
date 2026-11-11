import { create } from 'zustand';

export type ThemeMode = 'dark' | 'light';
export type Locale = 'id' | 'en';

interface PreferencesState {
  theme: ThemeMode;
  locale: Locale;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setLocale: (locale: Locale) => void;
}

const STORAGE_KEY = 'condeck.preferences';

function readPreferences(): { theme: ThemeMode; locale: Locale } {
  try {
    const raw = typeof window === 'undefined' ? null : window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<{ theme: ThemeMode; locale: Locale }>) : {};
    return {
      theme: parsed.theme === 'light' ? 'light' : 'dark',
      locale: parsed.locale === 'en' ? 'en' : 'id',
    };
  } catch {
    return { theme: 'dark', locale: 'id' };
  }
}

/** Theme and language are attributes on <html>, so every component follows them. */
export function applyTheme(theme: ThemeMode): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function applyLocale(locale: Locale): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.documentElement.lang = locale;
}

function persist(theme: ThemeMode, locale: Locale): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme, locale }));
  } catch {
    // Storage is optional (private mode); the UI keeps working without it.
  }
}

const initial = readPreferences();
applyTheme(initial.theme);
applyLocale(initial.locale);

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  theme: initial.theme,
  locale: initial.locale,

  setTheme(theme) {
    applyTheme(theme);
    persist(theme, get().locale);
    set({ theme });
  },

  toggleTheme() {
    get().setTheme(get().theme === 'dark' ? 'light' : 'dark');
  },

  setLocale(locale) {
    applyLocale(locale);
    persist(get().theme, locale);
    set({ locale });
  },
}));
