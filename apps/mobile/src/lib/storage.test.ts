import { describe, expect, it } from 'vitest';
import {
  browserStorage,
  clearStoredDevice,
  readStoredDevice,
  writeStoredDevice,
  type StorageLike,
  type StoredDevice,
} from './storage';

const DEVICE_ID = '3f1b2a40-9c8d-4d1e-8f2a-1b2c3d4e5f60';

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

const device: StoredDevice = {
  host: '192.168.1.20',
  port: 43821,
  deviceId: DEVICE_ID,
  deviceCredential: 'credential-value-that-is-long-enough',
  deviceName: 'Pixel 8',
};

describe('device storage', () => {
  it('round-trips a paired device', () => {
    const storage = memoryStorage();
    writeStoredDevice(storage, device);
    expect(readStoredDevice(storage)).toEqual(device);
  });

  it('clears the stored device', () => {
    const storage = memoryStorage();
    writeStoredDevice(storage, device);
    clearStoredDevice(storage);
    expect(readStoredDevice(storage)).toBeNull();
  });

  it('returns null for missing, malformed and expired-looking data', () => {
    const storage = memoryStorage();
    expect(readStoredDevice(storage)).toBeNull();

    storage.setItem('condeck.remote.device.v1', 'not json');
    expect(readStoredDevice(storage)).toBeNull();

    storage.setItem('condeck.remote.device.v1', JSON.stringify({ ...device, port: 70000 }));
    expect(readStoredDevice(storage)).toBeNull();

    storage.setItem('condeck.remote.device.v1', JSON.stringify({ ...device, deviceId: 'nope' }));
    expect(readStoredDevice(storage)).toBeNull();

    storage.setItem('condeck.remote.device.v1', JSON.stringify({ ...device, deviceCredential: 'short' }));
    expect(readStoredDevice(storage)).toBeNull();
  });

  it('survives storage that throws', () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };

    expect(() => writeStoredDevice(broken, device)).not.toThrow();
    expect(() => clearStoredDevice(broken)).not.toThrow();
    expect(readStoredDevice(broken)).toBeNull();
    expect(readStoredDevice(null)).toBeNull();
  });

  it('returns null when the browser blocks local storage', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('blocked');
      },
    });

    try {
      expect(browserStorage()).toBeNull();
    } finally {
      if (descriptor) {
        Object.defineProperty(globalThis, 'localStorage', descriptor);
      } else {
        delete (globalThis as Record<string, unknown>).localStorage;
      }
    }
  });
});
