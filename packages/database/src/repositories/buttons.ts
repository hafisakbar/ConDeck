import { randomUUID } from 'node:crypto';
import { and, asc, eq, ne } from 'drizzle-orm';
import {
  AppError,
  DEFAULT_BUTTON_BACKGROUND,
  DEFAULT_BUTTON_TEXT_COLOR,
  buttonAppearanceSchema,
  type ActionRecord,
  type ButtonAppearance,
  type CreateButtonInput,
  type DeckButtonWithAction,
  type DuplicateButtonInput,
  type UpdateButtonInput,
} from '@condeck/shared';
import type { ConDeckDb } from '../client';
import { actions, buttons } from '../schema';
import { getButtonAction } from './actions';
import { assertPositionInGrid, getPageGrid } from './grid';

type ButtonRow = typeof buttons.$inferSelect;

/** Stored JSON is untrusted input: an invalid value degrades to "no appearance". */
export function readAppearanceJson(value: string | null): ButtonAppearance | null {
  if (!value) {
    return null;
  }
  try {
    const parsed = buttonAppearanceSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function writeAppearanceJson(appearance: ButtonAppearance | null | undefined): string | null | undefined {
  if (appearance === undefined) {
    return undefined;
  }
  if (appearance === null) {
    return null;
  }
  const parsed = buttonAppearanceSchema.safeParse(appearance);
  if (!parsed.success) {
    throw new AppError('INVALID_INPUT', 'Button appearance must define normal, hover, active and pressed colours.');
  }
  return JSON.stringify(parsed.data);
}

function toButton(row: ButtonRow, action: ActionRecord | null): DeckButtonWithAction {
  return {
    id: row.id,
    pageId: row.pageId,
    position: row.position,
    label: row.label,
    icon: (row.icon ?? null) as DeckButtonWithAction['icon'],
    backgroundColor: row.backgroundColor,
    textColor: row.textColor,
    appearance: readAppearanceJson(row.appearanceJson),
    isEnabled: row.isEnabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    action,
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

export function createButton(db: ConDeckDb, input: CreateButtonInput): DeckButtonWithAction {
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
      appearanceJson: writeAppearanceJson(input.appearance) ?? null,
      isEnabled: input.isEnabled ?? true,
    })
    .returning()
    .get();

  if (!row) {
    throw new AppError('DATABASE_ERROR', 'Button could not be created.');
  }
  return toButton(row, null);
}

/**
 * Updates appearance and/or moves the button to another slot of the same page.
 * The move is a single UPDATE, so the row can never be left in an invalid slot;
 * the unique index on (page_id, position) is the final guard.
 */
export function updateButton(db: ConDeckDb, input: UpdateButtonInput): DeckButtonWithAction {
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
      ...(input.appearance !== undefined
        ? { appearanceJson: writeAppearanceJson(input.appearance) ?? null }
        : {}),
      ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(buttons.id, current.id))
    .returning()
    .get();

  if (!updated) {
    throw new AppError('DATABASE_ERROR', 'Button could not be updated.');
  }
  return toButton(updated, getButtonAction(db, updated.id));
}

export function deleteButton(db: ConDeckDb, buttonId: string): void {
  const result = db.delete(buttons).where(eq(buttons.id, buttonId)).run();
  if (result.changes === 0) {
    throw new AppError('NOT_FOUND', 'Button not found.');
  }
}

/** Copies a button and its configured action into another free slot of the page. */
export function duplicateButton(
  db: ConDeckDb,
  input: DuplicateButtonInput,
): DeckButtonWithAction {
  const source = requireButton(db, input.buttonId);
  const grid = getPageGrid(db, source.pageId);
  assertPositionInGrid(input.position, grid);
  assertSlotFree(db, source.pageId, input.position);

  const row = db.transaction((tx) => {
    const copy = tx
      .insert(buttons)
      .values({
        id: randomUUID(),
        pageId: source.pageId,
        position: input.position,
        label: source.label,
        icon: source.icon,
        backgroundColor: source.backgroundColor,
        textColor: source.textColor,
        appearanceJson: source.appearanceJson,
        isEnabled: source.isEnabled,
      })
      .returning()
      .get();

    if (!copy) {
      throw new AppError('DATABASE_ERROR', 'Button could not be duplicated.');
    }

    const sourceAction = tx
      .select()
      .from(actions)
      .where(eq(actions.buttonId, source.id))
      .orderBy(asc(actions.position))
      .get();

    if (sourceAction) {
      tx.insert(actions)
        .values({
          id: randomUUID(),
          buttonId: copy.id,
          actionType: sourceAction.actionType,
          configJson: sourceAction.configJson,
          position: sourceAction.position,
        })
        .run();
    }

    return copy;
  });

  return toButton(row, getButtonAction(db, row.id));
}
