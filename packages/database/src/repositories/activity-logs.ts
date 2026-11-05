import { randomUUID } from 'node:crypto';
import { desc } from 'drizzle-orm';
import type { ActivityLog } from '@condeck/shared';
import type { ConDeckDb } from '../client';
import { activityLogs } from '../schema';

type ActivityLogRow = typeof activityLogs.$inferSelect;

function parseMetadata(raw: string | null): Record<string, unknown> | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function toActivityLog(row: ActivityLogRow): ActivityLog {
  return {
    id: row.id,
    deviceId: row.deviceId,
    eventType: row.eventType,
    description: row.description,
    metadata: parseMetadata(row.metadataJson),
    createdAt: row.createdAt,
  };
}

export function listRecentActivity(db: ConDeckDb, limit = 20): ActivityLog[] {
  return db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt)).limit(limit).all().map(toActivityLog);
}

export interface RecordActivityInput {
  eventType: string;
  description: string;
  deviceId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Appends an activity log entry. Metadata must never contain credentials; callers
 * are responsible for passing only non-sensitive fields.
 */
export function recordActivity(db: ConDeckDb, input: RecordActivityInput): ActivityLog {
  const row = db
    .insert(activityLogs)
    .values({
      id: randomUUID(),
      deviceId: input.deviceId ?? null,
      eventType: input.eventType,
      description: input.description,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
    })
    .returning()
    .get();

  return toActivityLog(row);
}
