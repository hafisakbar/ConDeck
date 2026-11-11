import { randomUUID } from 'node:crypto';
import { asc, eq, sql } from 'drizzle-orm';
import { AppError, type Sound, type SoundFormat } from '@condeck/shared';
import type { ConDeckDb } from '../client';
import { actions, buttons, sounds } from '../schema';

export interface CreateSoundInput {
  name: string;
  fileName: string;
  filePath: string;
  format: SoundFormat;
  mimeType: string;
  fileSize: number;
}

function toSound(row: typeof sounds.$inferSelect): Sound {
  return {
    id: row.id,
    name: row.name,
    fileName: row.fileName,
    format: row.format as SoundFormat,
    mimeType: row.mimeType,
    byteSize: row.fileSize,
    createdAt: row.createdAt,
  };
}

export function listSounds(db: ConDeckDb): Sound[] {
  return db.select().from(sounds).orderBy(asc(sounds.name)).all().map(toSound);
}

export function getSound(db: ConDeckDb, soundId: string): Sound | null {
  const row = db.select().from(sounds).where(eq(sounds.id, soundId)).get();
  return row ? toSound(row) : null;
}

/** Absolute path of the persisted file; never exposed to the renderer. */
export function getSoundFilePath(db: ConDeckDb, soundId: string): string | null {
  const row = db.select({ filePath: sounds.filePath }).from(sounds).where(eq(sounds.id, soundId)).get();
  return row?.filePath ?? null;
}

export function createSound(db: ConDeckDb, input: CreateSoundInput): Sound {
  const row = db
    .insert(sounds)
    .values({
      id: randomUUID(),
      name: input.name,
      fileName: input.fileName,
      filePath: input.filePath,
      format: input.format,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
    })
    .returning()
    .get();

  if (!row) {
    throw new AppError('DATABASE_ERROR', 'The sound could not be saved.');
  }
  return toSound(row);
}

export function deleteSound(db: ConDeckDb, soundId: string): void {
  const result = db.delete(sounds).where(eq(sounds.id, soundId)).run();
  if (result.changes === 0) {
    throw new AppError('NOT_FOUND', 'Sound not found.');
  }
}

export interface SoundUsage {
  count: number;
  buttonLabels: string[];
}

/**
 * Buttons that reference a sound. Deleting a file still in use would leave a
 * broken action, so the IPC layer refuses until those buttons are changed.
 */
export function soundUsage(db: ConDeckDb, soundId: string): SoundUsage {
  const rows = db
    .select({ label: buttons.label })
    .from(actions)
    .innerJoin(buttons, eq(buttons.id, actions.buttonId))
    .where(
      sql`${actions.actionType} = 'SOUNDBOARD_PLAY' and json_extract(${actions.configJson}, '$.soundId') = ${soundId}`,
    )
    .all();

  return { count: rows.length, buttonLabels: rows.map((row) => row.label) };
}
