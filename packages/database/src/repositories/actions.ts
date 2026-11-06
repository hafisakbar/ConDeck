import { randomUUID } from 'node:crypto';
import { asc, eq, inArray } from 'drizzle-orm';
import {
  AppError,
  parseActionConfig,
  type ActionRecord,
  type ActionType,
  type SetActionInput,
} from '@condeck/shared';
import type { ConDeckDb } from '../client';
import { actions, buttons, decks, pages } from '../schema';

/**
 * Phase 3 restricts a button to one action: the PRD lists multi-action as a
 * later feature. The schema keeps the `position` column so a future release can
 * add more rows without a migration (DATABASE_DESIGN.md §4.5).
 */
const CONFIGURED_ACTION_POSITION = 0;

type ActionRow = typeof actions.$inferSelect;

/** A broken config blob must not prevent the deck from loading. */
function readConfig(configJson: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(configJson);
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

function toActionRecord(row: ActionRow): ActionRecord {
  return {
    id: row.id,
    buttonId: row.buttonId,
    actionType: row.actionType as ActionType,
    config: readConfig(row.configJson),
    position: row.position,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export interface ActionTarget {
  buttonId: string;
  buttonLabel: string;
  pageId: string;
  deckId: string;
  isEnabled: boolean;
}

/** Resolves everything the engine needs to execute a button's action. */
export function getActionTarget(db: ConDeckDb, buttonId: string): ActionTarget {
  const row = db
    .select({
      buttonId: buttons.id,
      buttonLabel: buttons.label,
      isEnabled: buttons.isEnabled,
      pageId: pages.id,
      deckId: decks.id,
    })
    .from(buttons)
    .innerJoin(pages, eq(pages.id, buttons.pageId))
    .innerJoin(decks, eq(decks.id, pages.deckId))
    .where(eq(buttons.id, buttonId))
    .get();

  if (!row) {
    throw new AppError('NOT_FOUND', 'Button not found.');
  }
  return row;
}

export function getButtonAction(db: ConDeckDb, buttonId: string): ActionRecord | null {
  const row = db
    .select()
    .from(actions)
    .where(eq(actions.buttonId, buttonId))
    .orderBy(asc(actions.position))
    .get();

  return row ? toActionRecord(row) : null;
}

/** Attaches actions to a page's buttons in one query (deck detail). */
export function actionsByButtonIds(
  db: ConDeckDb,
  buttonIds: readonly string[],
): Map<string, ActionRecord> {
  if (buttonIds.length === 0) {
    return new Map();
  }

  const rows = db
    .select()
    .from(actions)
    .where(inArray(actions.buttonId, [...buttonIds]))
    .orderBy(asc(actions.position))
    .all();

  const byButton = new Map<string, ActionRecord>();
  for (const row of rows) {
    // Only the first action is used in Phase 3; later positions are ignored.
    if (!byButton.has(row.buttonId)) {
      byButton.set(row.buttonId, toActionRecord(row));
    }
  }
  return byButton;
}

/**
 * Saves (or replaces) the action of one button. The configuration is validated
 * against the action type's schema before anything is written.
 */
export function setButtonAction(db: ConDeckDb, input: SetActionInput): ActionRecord {
  const config = parseActionConfig(input.actionType, input.config);

  return db.transaction((tx) => {
    const button = tx
      .select({ id: buttons.id })
      .from(buttons)
      .where(eq(buttons.id, input.buttonId))
      .get();

    if (!button) {
      throw new AppError('NOT_FOUND', 'Button not found.');
    }

    tx.delete(actions).where(eq(actions.buttonId, input.buttonId)).run();

    const row = tx
      .insert(actions)
      .values({
        id: randomUUID(),
        buttonId: input.buttonId,
        actionType: input.actionType,
        configJson: JSON.stringify(config),
        position: CONFIGURED_ACTION_POSITION,
      })
      .returning()
      .get();

    if (!row) {
      throw new AppError('DATABASE_ERROR', 'The action could not be saved.');
    }
    return toActionRecord(row);
  });
}

/** Removes the action of a button and returns the type that was removed. */
export function deleteButtonAction(db: ConDeckDb, buttonId: string): ActionType {
  return db.transaction((tx) => {
    const existing = tx
      .select()
      .from(actions)
      .where(eq(actions.buttonId, buttonId))
      .orderBy(asc(actions.position))
      .get();

    if (!existing) {
      throw new AppError('NOT_FOUND', 'This button has no action to remove.');
    }

    tx.delete(actions).where(eq(actions.buttonId, buttonId)).run();
    return existing.actionType as ActionType;
  });
}
