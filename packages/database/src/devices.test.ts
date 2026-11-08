import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppError } from '@condeck/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type ConDeckDatabase } from './client';
import {
  countDevices,
  createDevice,
  endDeviceSession,
  endOpenSessions,
  getDevice,
  getDeviceCredential,
  listDevices,
  revokeDevice,
  startDeviceSession,
  touchDevice,
} from './repositories/devices';

let workDir: string;
let database: ConDeckDatabase;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'condeck-devices-'));
  database = openDatabase({ filePath: join(workDir, 'condeck.db') });
});

afterEach(() => {
  database.close();
  rmSync(workDir, { recursive: true, force: true });
});

function pairDevice(name = 'My phone') {
  return createDevice(database.db, {
    deviceName: name,
    deviceType: 'mobile',
    credentialHash: 'a'.repeat(64),
  });
}

describe('devices', () => {
  it('registers a paired device as authorised', () => {
    const device = pairDevice();

    expect(device.isAuthorized).toBe(true);
    expect(device.deviceName).toBe('My phone');
    expect(device.lastSeenAt).not.toBeNull();
    expect(listDevices(database.db)).toHaveLength(1);
  });

  it('keeps the credential hash out of the public device shape', () => {
    const device = pairDevice();
    expect(device).not.toHaveProperty('credentialHash');

    const credential = getDeviceCredential(database.db, device.id);
    expect(credential?.credentialHash).toBe('a'.repeat(64));
    expect(credential?.isAuthorized).toBe(true);
  });

  it('updates the last seen timestamp', () => {
    const device = pairDevice();
    const at = '2026-05-01T10:00:00.000Z';

    touchDevice(database.db, device.id, at);

    expect(getDevice(database.db, device.id)?.lastSeenAt).toBe(at);
  });
});

describe('device sessions', () => {
  it('counts online devices while a session is open', () => {
    const device = pairDevice();
    const sessionId = startDeviceSession(database.db, device.id);

    expect(countDevices(database.db)).toEqual({ paired: 1, online: 1 });

    endDeviceSession(database.db, sessionId);
    expect(countDevices(database.db)).toEqual({ paired: 1, online: 0 });
  });

  it('ignores an end call for an already closed session', () => {
    const device = pairDevice();
    const sessionId = startDeviceSession(database.db, device.id);

    endDeviceSession(database.db, sessionId);
    endDeviceSession(database.db, sessionId);

    expect(countDevices(database.db).online).toBe(0);
  });

  it('closes stale sessions of one device', () => {
    const device = pairDevice();
    const other = pairDevice('Tablet');
    startDeviceSession(database.db, device.id);
    startDeviceSession(database.db, device.id);
    startDeviceSession(database.db, other.id);

    endOpenSessions(database.db, device.id);

    expect(countDevices(database.db)).toEqual({ paired: 2, online: 1 });
  });
});

describe('revocation', () => {
  it('marks the device unauthorised and closes its live sessions', () => {
    const device = pairDevice();
    startDeviceSession(database.db, device.id);

    const revoked = revokeDevice(database.db, device.id);

    expect(revoked.isAuthorized).toBe(false);
    expect(getDevice(database.db, device.id)?.isAuthorized).toBe(false);
    expect(countDevices(database.db).online).toBe(0);
    expect(getDeviceCredential(database.db, device.id)?.isAuthorized).toBe(false);
  });

  it('rejects revoking a device that does not exist', () => {
    expect(() => revokeDevice(database.db, '9b2f3c1d-7b1e-4d3a-9c2b-1a2b3c4d5e6f')).toThrowError(
      AppError,
    );
  });
});
