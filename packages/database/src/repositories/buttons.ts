import { randomUUID } from 'node:crypto';
import { and, eq, ne } from 'drizzle-orm';
import {
  AppError,
  DEFAULT_BUTTON_BACKGROUND,
  DEFAULT_BUTTON_TEXT_COLOR,
  type CreateButtonInput,
  type DeckButton,
  type DuplicateButtonInput,
  type UpdateButtonInput,
} from '@condeck/shared';
import type { ConDeckDb } from '../client';
import { buttons } from '../schema';
import { assertPositionInGrid, getPageGrid } from './grid';

type ButtonRow = typeof buttons.$inferSelect;

function toButton(row: ButtonRow): DeckButton {
  return {
    id: row.id,
    pageId: row.pageId,
    position: row.position,
    label: row.label,
    icon: (row.icon ?? null) as DeckButton['icon'],
    backgroundColor: row.backgroundColor,
    textColor: row.textColor,
    isEnabled: row.isEnabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** One slot holds at most one button (unique index buttons_page_position_unique). */
function assertSlotFree(db: ConDeckDb, pageId: string, position: number, ignoreButtonId?: string): void {
  const existing = db
    .select({ id: buttons.id })
    .from(buttons)
    .where(
      ignoreButtonId
        ? and(eq(buttons.pageId, pageId), eq(buttons.position, position), ne(buttons.id, ignoreButtonId))
        : and(eq(buttons.pageId, pageId), eq(buttons.position, position)),
    )
    .get();

  if (existing) {
    throw new AppError('CONFLICT', 'That grid slot already contains a button.');
  }
}

function requireButton(db: ConDeckDb, buttonId: string): ButtonRow {
  const row = db.select().from(buttons).where(eq(buttons.id, buttonId)).get();
  if (!row) {
    throw new AppError('NOT_FOUND', 'Button not found.');
  }
  return row;
}

export function createButton(db: ConDeckDb, input: CreateButtonInput): DeckButton {
  const grid = getPageGrid(db, input.pageId);
  assertPositionInGrid(input.position, grid);
  assertSlotFree(db, input.pageId, input.position);

  const row = db
    .insert(buttons)
    .values({
      id: randomUUID(),
      pageId: input.pageId,
      position: input.position,
      label: input.label,
      icon: input.icon ?? null,
      backgroundColor: input.backgroundColor ?? DEFAULT_BUTTON_BACKGROUND,
      textColor: input.textColor ?? DEFAULT_BUTTON_TEXT_COLOR,
      isEnabled: input.isEnabled ?? true,
    })
    .returning()
    .get();

  if (!row) {
    throw new AppError('DATABASE_ERROR', 'Button could not be created.');
  }
  return toButton(row);
}

/**
 * Updates appearance and/or moves the button to another slot of the same page.
 * The move is a single UPDATE, so the row can never be left in an invalid slot;
 * the unique index on (page_id, position) is the final guard.
 */
export function updateButton(db: ConDeckDb, input: UpdateButtonInput): DeckButton {
  const current = requireButton(db, input.buttonId);

  if (input.position !== undefined && input.position !== current.position) {
    const grid = getPageGrid(db, current.pageId);
    assertPositionInGrid(input.position, grid);
    assertSlotFree(db, current.pageId, input.position, current.id);
  }

  const updated = db
    .update(buttons)
    .set({
      ...(input.position !== undefined ? { position: input.position } : {}),
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.icon !== undefined ? { icon: input.icon } : {}),
      ...(input.backgroundColor !== undefined ? { backgroundColor: input.backgroundColor } : {}),
      ...(input.textColor !== undefined ? { textColor: input.textColor } : {}),
      ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(buttons.id, current.id))
    .returning()
    .get();

  if (!updated) {
    throw new AppError('DATABASE_ERROR', 'Button could not be updated.');
  }
  return toButton(updated);
}

export function deleteButton(db: ConDeckDb, buttonId: string): void {
  const result = db.delete(buttons).where(eq(buttons.id, buttonId)).run();
  if (result.changes === 0) {
    throw new AppError('NOT_FOUND', 'Button not found.');
  }
}

/** Copies a button's configuration into another free slot of the same page. */
export function duplicateButton(db: ConDeckDb, input: DuplicateButtonInput): DeckButton {
  const source = requireButton(db, input.buttonId);
  const grid = getPageGrid(db, source.pageId);
  assertPositionInGrid(input.position, grid);
  assertSlotFree(db, source.pageId, input.position);

  const row = db
    .insert(buttons)
    .values({
      id: randomUUID(),
      pageId: source.pageId,
      position: input.position,
      label: source.label,
      icon: source.icon,
      backgroundColor: source.backgroundColor,
      textColor: source.textColor,
      isEnabled: source.isEnabled,
    })
    .returning()
    .get();

  if (!row) {
    throw new AppError('DATABASE_ERROR', 'Button could not be duplicated.');
  }
  return toButton(row);
}
