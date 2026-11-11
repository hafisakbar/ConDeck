import { randomUUID } from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import { AppError, type CreateCustomIconInput, type CustomIcon } from '@condeck/shared';
import type { ConDeckDb } from '../client';
import { customIcons } from '../schema';

export function toCustomIcon(row: typeof customIcons.$inferSelect): CustomIcon {
  return {
    id: row.id,
    name: row.name,
    mimeType: row.mimeType as CustomIcon['mimeType'],
    byteSize: row.byteSize,
    createdAt: row.createdAt,
    dataUrl: `data:${row.mimeType};base64,${row.data}`,
  };
}

export function listCustomIcons(db: ConDeckDb): CustomIcon[] {
  return db.select().from(customIcons).orderBy(desc(customIcons.createdAt)).all().map(toCustomIcon);
}

export function getCustomIcon(db: ConDeckDb, iconId: string): CustomIcon | null {
  const row = db.select().from(customIcons).where(eq(customIcons.id, iconId)).get();
  return row ? toCustomIcon(row) : null;
}

/** Bytes are validated by the IPC layer before reaching this function. */
export function createCustomIcon(
  db: ConDeckDb,
  input: Pick<CreateCustomIconInput, 'name'> & {
    mimeType: CustomIcon['mimeType'];
    base64: string;
    byteSize: number;
  },
): CustomIcon {
  const row = db
    .insert(customIcons)
    .values({
      id: randomUUID(),
      name: input.name,
      mimeType: input.mimeType,
      data: input.base64,
      byteSize: input.byteSize,
    })
    .returning()
    .get();

  if (!row) {
    throw new AppError('DATABASE_ERROR', 'The icon could not be saved.');
  }
  return toCustomIcon(row);
}

export function deleteCustomIcon(db: ConDeckDb, iconId: string): void {
  const result = db.delete(customIcons).where(eq(customIcons.id, iconId)).run();
  if (result.changes === 0) {
    throw new AppError('NOT_FOUND', 'Icon not found.');
  }
}
