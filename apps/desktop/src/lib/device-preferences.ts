/**
 * Purely visual device preferences. Deck dimensions, pages and buttons stay in
 * SQLite; spacing, face size, zoom and the workspace mode are view settings and
 * live here so no schema migration is needed for a cosmetic control.
 */
export interface DevicePreferences {
  /** Multiplier for the button face size (0.82–1.16). */
  buttonScale: number;
  /** Gap between buttons, relative to the face size (0.05–0.42). */
  gapScale: number;
  /** User zoom on top of the automatic fit scale (0.55–1.6). */
  zoom: number;
}

export type WorkspaceMode = 'edit' | 'operate';

export const DEFAULT_DEVICE_PREFERENCES: DevicePreferences = {
  buttonScale: 1,
  gapScale: 0.22,
  zoom: 1,
};

const PREFERENCES_KEY = 'condeck.device.preferences';
const MODE_KEY = 'condeck.device.mode';

function readStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadDevicePreferences(): DevicePreferences {
  const storage = readStorage();
  if (!storage) {
    return DEFAULT_DEVICE_PREFERENCES;
  }
  try {
    const raw = storage.getItem(PREFERENCES_KEY);
    if (!raw) {
      return DEFAULT_DEVICE_PREFERENCES;
    }
    const parsed = JSON.parse(raw) as Partial<DevicePreferences>;
    return {
      buttonScale: Number.isFinite(parsed.buttonScale)
        ? (parsed.buttonScale as number)
        : DEFAULT_DEVICE_PREFERENCES.buttonScale,
      gapScale: Number.isFinite(parsed.gapScale)
        ? (parsed.gapScale as number)
        : DEFAULT_DEVICE_PREFERENCES.gapScale,
      zoom: Number.isFinite(parsed.zoom) ? (parsed.zoom as number) : DEFAULT_DEVICE_PREFERENCES.zoom,
    };
  } catch {
    return DEFAULT_DEVICE_PREFERENCES;
  }
}

export function saveDevicePreferences(preferences: DevicePreferences): void {
  readStorage()?.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
}

export function loadWorkspaceMode(): WorkspaceMode {
  return readStorage()?.getItem(MODE_KEY) === 'operate' ? 'operate' : 'edit';
}

export function saveWorkspaceMode(mode: WorkspaceMode): void {
  readStorage()?.setItem(MODE_KEY, mode);
}
