import { randomUUID } from 'node:crypto';
import { count, desc, eq } from 'drizzle-orm';
import { AppError, type CreateProfileInput, type Profile } from '@condeck/shared';
import type { ConDeckDb } from '../client';
import { profiles } from '../schema';

type ProfileRow = typeof profiles.$inferSelect;

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function listProfiles(db: ConDeckDb): Profile[] {
  return db
    .select()
    .from(profiles)
    .orderBy(desc(profiles.isActive), profiles.name)
    .all()
    .map(toProfile);
}

export function getActiveProfile(db: ConDeckDb): Profile | null {
  const row = db.select().from(profiles).where(eq(profiles.isActive, true)).get();
  return row ? toProfile(row) : null;
}

export function countProfiles(db: ConDeckDb): number {
  const [row] = db.select({ value: count() }).from(profiles).all();
  return row?.value ?? 0;
}

/**
 * Creates a profile. The very first profile automatically becomes active so a
 * fresh install can be used immediately (PRD §6.1 onboarding).
 */
export function createProfile(db: ConDeckDb, input: CreateProfileInput): Profile {
  const id = randomUUID();
  const isFirstProfile = countProfiles(db) === 0;

  return db.transaction((tx) => {
    const row = tx
      .insert(profiles)
      .values({
        id,
        name: input.name,
        description: input.description && input.description.length > 0 ? input.description : null,
        isActive: isFirstProfile,
      })
      .returning()
      .get();

    if (!row) {
      throw new AppError('DATABASE_ERROR', 'Profile could not be created.');
    }
    return toProfile(row);
  });
}

/** Marks one profile as active and every other profile as inactive, atomically. */
export function setActiveProfile(db: ConDeckDb, profileId: string): Profile {
  return db.transaction((tx) => {
    const target = tx.select().from(profiles).where(eq(profiles.id, profileId)).get();
    if (!target) {
      throw new AppError('NOT_FOUND', 'Profile not found.');
    }

    const now = new Date().toISOString();
    tx.update(profiles).set({ isActive: false, updatedAt: now }).where(eq(profiles.isActive, true)).run();
    const updated = tx
      .update(profiles)
      .set({ isActive: true, updatedAt: now })
      .where(eq(profiles.id, profileId))
      .returning()
      .get();

    if (!updated) {
      throw new AppError('DATABASE_ERROR', 'Active profile could not be updated.');
    }
    return toProfile(updated);
  });
}
