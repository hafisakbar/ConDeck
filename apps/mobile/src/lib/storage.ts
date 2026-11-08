/**
 * The phone keeps its own device credential. It is the only secret the remote
 * holds, and the desktop only stores its hash (API_WEBSOCKET_CONTRACT.md §5).
 */
export interface StoredDevice {
  host: string;
  port: number;
  deviceId: string;
  deviceCredential: string;
  deviceName: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const STORAGE_KEY = 'condeck.remote.device.v1';

function isStoredDevice(value: unknown): value is StoredDevice {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.host === 'string' &&
    record.host.length > 0 &&
    typeof record.port === 'number' &&
    Number.isInteger(record.port) &&
    record.port > 0 &&
    record.port <= 65535 &&
    typeof record.deviceId === 'string' &&
    /^[0-9a-f-]{36}$/i.test(record.deviceId) &&
    typeof record.deviceCredential === 'string' &&
    record.deviceCredential.length >= 20 &&
    typeof record.deviceName === 'string'
  );
}

export function readStoredDevice(storage: StorageLike | null): StoredDevice | null {
  if (!storage) {
    return null;
  }

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    return isStoredDevice(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeStoredDevice(storage: StorageLike | null, device: StoredDevice): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(device));
  } catch {
    // Private browsing can refuse writes; the device simply pairs again later.
  }
}

export function clearStoredDevice(storage: StorageLike | null): void {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clean up.
  }
}

/** localStorage when the browser allows it, otherwise null. */
export function browserStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
