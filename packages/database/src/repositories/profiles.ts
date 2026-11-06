import { randomUUID } from 'node:crypto';
import { asc, count, desc, eq } from 'drizzle-orm';
import {
  AppError,
  type CreateProfileInput,
  type Profile,
  type UpdateProfileInput,
} from '@condeck/shared';
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

/** Renames a profile and/or replaces its description (PRD §5.7). */
export function updateProfile(db: ConDeckDb, input: UpdateProfileInput): Profile {
  return db.transaction((tx) => {
    const current = tx.select().from(profiles).where(eq(profiles.id, input.profileId)).get();
    if (!current) {
      throw new AppError('NOT_FOUND', 'Profile not found.');
    }

    const updated = tx
      .update(profiles)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined
          ? {
              description:
                input.description && input.description.length > 0 ? input.description : null,
            }
          : {}),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(profiles.id, current.id))
      .returning()
      .get();

    if (!updated) {
      throw new AppError('DATABASE_ERROR', 'Profile could not be updated.');
    }
    return toProfile(updated);
  });
}

/**
 * Deletes a profile. Decks, pages, buttons and actions are removed by the
 * database cascade (DATABASE_DESIGN.md §8). If the deleted profile was active,
 * the oldest remaining profile takes over so the app keeps a working context.
 */
export function deleteProfile(
  db: ConDeckDb,
  profileId: string,
): { profileId: string; remainingProfiles: number } {
  return db.transaction((tx) => {
    const target = tx.select().from(profiles).where(eq(profiles.id, profileId)).get();
    if (!target) {
      throw new AppError('NOT_FOUND', 'Profile not found.');
    }

    tx.delete(profiles).where(eq(profiles.id, profileId)).run();

    const [remaining] = tx.select({ value: count() }).from(profiles).all();
    const remainingProfiles = remaining?.value ?? 0;

    if (target.isActive && remainingProfiles > 0) {
      const next = tx.select().from(profiles).orderBy(asc(profiles.createdAt)).get();
      if (next) {
        tx.update(profiles)
          .set({ isActive: true, updatedAt: new Date().toISOString() })
          .where(eq(profiles.id, next.id))
          .run();
      }
    }

    return { profileId, remainingProfiles };
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
