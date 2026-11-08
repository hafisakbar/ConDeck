import { randomUUID } from 'node:crypto';
import { and, count, desc, eq, isNull } from 'drizzle-orm';
import { AppError, type Device } from '@condeck/shared';
import type { ConDeckDb } from '../client';
import { deviceSessions, devices } from '../schema';

type DeviceRow = typeof devices.$inferSelect;

function toDevice(row: DeviceRow): Device {
  return {
    id: row.id,
    deviceName: row.deviceName,
    deviceType: row.deviceType,
    lastSeenAt: row.lastSeenAt,
    isAuthorized: row.isAuthorized,
    createdAt: row.createdAt,
  };
}

export function listDevices(db: ConDeckDb): Device[] {
  return db.select().from(devices).orderBy(desc(devices.createdAt)).all().map(toDevice);
}

export function countDevices(db: ConDeckDb): { paired: number; online: number } {
  const [paired] = db.select({ value: count() }).from(devices).all();
  const [online] = db
    .select({ value: count() })
    .from(deviceSessions)
    .where(and(eq(deviceSessions.sessionStatus, 'connected'), isNull(deviceSessions.disconnectedAt)))
    .all();

  return { paired: paired?.value ?? 0, online: online?.value ?? 0 };
}

export interface CreateDeviceInput {
  deviceName: string;
  deviceType: string;
  /** SHA-256 of the credential; the credential itself never reaches the database. */
  credentialHash: string;
}

/** Registers a freshly paired device (DATABASE_DESIGN.md §4.7). */
export function createDevice(db: ConDeckDb, input: CreateDeviceInput): Device {
  const now = new Date().toISOString();
  const row = db
    .insert(devices)
    .values({
      id: randomUUID(),
      deviceName: input.deviceName,
      deviceType: input.deviceType,
      credentialHash: input.credentialHash,
      lastSeenAt: now,
      isAuthorized: true,
      createdAt: now,
    })
    .returning()
    .get();

  if (!row) {
    throw new AppError('DATABASE_ERROR', 'The device could not be registered.');
  }
  return toDevice(row);
}

export function getDevice(db: ConDeckDb, deviceId: string): Device | null {
  const row = db.select().from(devices).where(eq(devices.id, deviceId)).get();
  return row ? toDevice(row) : null;
}

/** Credential material for one device; callers verify it without exposing it. */
export interface DeviceCredentialRecord {
  id: string;
  deviceName: string;
  isAuthorized: boolean;
  credentialHash: string;
}

export function getDeviceCredential(
  db: ConDeckDb,
  deviceId: string,
): DeviceCredentialRecord | null {
  const row = db
    .select({
      id: devices.id,
      deviceName: devices.deviceName,
      isAuthorized: devices.isAuthorized,
      credentialHash: devices.credentialHash,
    })
    .from(devices)
    .where(eq(devices.id, deviceId))
    .get();
  return row ?? null;
}

export function touchDevice(
  db: ConDeckDb,
  deviceId: string,
  at: string = new Date().toISOString(),
): void {
  db.update(devices).set({ lastSeenAt: at }).where(eq(devices.id, deviceId)).run();
}

/** Opens a session row when a paired device authenticates (§4.8). */
export function startDeviceSession(
  db: ConDeckDb,
  deviceId: string,
  at: string = new Date().toISOString(),
): string {
  const sessionId = randomUUID();
  db.insert(deviceSessions)
    .values({
      id: sessionId,
      deviceId,
      sessionStatus: 'connected',
      connectedAt: at,
      lastActivityAt: at,
    })
    .run();
  return sessionId;
}

export function endDeviceSession(
  db: ConDeckDb,
  sessionId: string,
  at: string = new Date().toISOString(),
): void {
  db.update(deviceSessions)
    .set({ sessionStatus: 'disconnected', disconnectedAt: at, lastActivityAt: at })
    .where(and(eq(deviceSessions.id, sessionId), isNull(deviceSessions.disconnectedAt)))
    .run();
}

/** Closes every socket-less session of a device, e.g. after a crash. */
export function endOpenSessions(
  db: ConDeckDb,
  deviceId: string,
  at: string = new Date().toISOString(),
): void {
  db.update(deviceSessions)
    .set({ sessionStatus: 'disconnected', disconnectedAt: at, lastActivityAt: at })
    .where(and(eq(deviceSessions.deviceId, deviceId), isNull(deviceSessions.disconnectedAt)))
    .run();
}

/**
 * Revokes a device permanently. Any live connection is closed by the remote
 * server; open sessions are marked disconnected here so the counts stay honest.
 */
export function revokeDevice(db: ConDeckDb, deviceId: string): Device {
  return db.transaction((tx) => {
    const current = tx.select().from(devices).where(eq(devices.id, deviceId)).get();
    if (!current) {
      throw new AppError('NOT_FOUND', 'Device not found.');
    }

    const now = new Date().toISOString();
    tx.update(devices)
      .set({ isAuthorized: false, lastSeenAt: now })
      .where(eq(devices.id, deviceId))
      .run();
    tx.update(deviceSessions)
      .set({ sessionStatus: 'disconnected', disconnectedAt: now, lastActivityAt: now })
      .where(and(eq(deviceSessions.deviceId, deviceId), isNull(deviceSessions.disconnectedAt)))
      .run();

    return toDevice({ ...current, isAuthorized: false, lastSeenAt: now });
  });
}
