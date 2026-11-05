import { and, count, desc, eq, isNull } from 'drizzle-orm';
import type { Device } from '@condeck/shared';
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
