import { randomUUID } from 'node:crypto';
import { asc, count, eq, inArray, max } from 'drizzle-orm';
import {
  AppError,
  defaultGrid,
  type ActionRecord,
  type CreateDeckInput,
  type Deck,
  type DeckButtonWithAction,
  type DeckDetail,
  type DeckPageWithButtons,
  type DeckSummary,
  type UpdateDeckInput,
} from '@condeck/shared';
import type { ConDeckDb } from '../client';
import { buttons, decks, pages } from '../schema';
import { actionsByButtonIds } from './actions';

type DeckRow = typeof decks.$inferSelect;
type PageRow = typeof pages.$inferSelect;
type ButtonRow = typeof buttons.$inferSelect;

const DEFAULT_PAGE_NAME = 'Main';

function toDeck(row: DeckRow): Deck {
  return {
    id: row.id,
    profileId: row.profileId,
    name: row.name,
    columns: row.columns,
    rows: row.rows,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
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
    isEnabled: row.isEnabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    action,
  };
}

function toPage(page: PageRow, pageButtons: DeckButtonWithAction[]): DeckPageWithButtons {
  return {
    id: page.id,
    deckId: page.deckId,
    name: page.name,
    position: page.position,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
    buttons: pageButtons.sort((a, b) => a.position - b.position),
  };
}

export function countDecks(db: ConDeckDb, profileId?: string): number {
  const query = db.select({ value: count() }).from(decks);
  const [row] = profileId ? query.where(eq(decks.profileId, profileId)).all() : query.all();
  return row?.value ?? 0;
}

export function listDecks(db: ConDeckDb, profileId: string): DeckSummary[] {
  const deckRows = db
    .select()
    .from(decks)
    .where(eq(decks.profileId, profileId))
    .orderBy(asc(decks.name))
    .all();

  if (deckRows.length === 0) {
    return [];
  }

  const deckIds = deckRows.map((row) => row.id);

  const pageCounts = db
    .select({ deckId: pages.deckId, value: count() })
    .from(pages)
    .where(inArray(pages.deckId, deckIds))
    .groupBy(pages.deckId)
    .all();

  const buttonCounts = db
    .select({ deckId: pages.deckId, value: count() })
    .from(buttons)
    .innerJoin(pages, eq(pages.id, buttons.pageId))
    .where(inArray(pages.deckId, deckIds))
    .groupBy(pages.deckId)
    .all();

  const pageCountByDeck = new Map(pageCounts.map((row) => [row.deckId, row.value]));
  const buttonCountByDeck = new Map(buttonCounts.map((row) => [row.deckId, row.value]));

  return deckRows.map((row) => ({
    ...toDeck(row),
    pageCount: pageCountByDeck.get(row.id) ?? 0,
    buttonCount: buttonCountByDeck.get(row.id) ?? 0,
  }));
}

export function getDeck(db: ConDeckDb, deckId: string): Deck {
  const row = db.select().from(decks).where(eq(decks.id, deckId)).get();
  if (!row) {
    throw new AppError('NOT_FOUND', 'Deck not found.');
  }
  return toDeck(row);
}

/** Full configuration of one deck: pages in order, each with its buttons. */
export function getDeckDetail(db: ConDeckDb, deckId: string): DeckDetail {
  const deck = getDeck(db, deckId);

  const pageRows = db
    .select()
    .from(pages)
    .where(eq(pages.deckId, deckId))
    .orderBy(asc(pages.position))
    .all();

  const pageIds = pageRows.map((row) => row.id);
  const buttonRows =
    pageIds.length === 0
      ? []
      : db
          .select()
          .from(buttons)
          .where(inArray(buttons.pageId, pageIds))
          .orderBy(asc(buttons.position))
          .all();

  const actionByButton = actionsByButtonIds(
    db,
    buttonRows.map((row) => row.id),
  );

  const buttonsByPage = new Map<string, DeckButtonWithAction[]>();
  for (const row of buttonRows) {
    const list = buttonsByPage.get(row.pageId) ?? [];
    list.push(toButton(row, actionByButton.get(row.id) ?? null));
    buttonsByPage.set(row.pageId, list);
  }

  return {
    deck,
    pages: pageRows.map((row) => toPage(row, buttonsByPage.get(row.id) ?? [])),
  };
}

/**
 * Creates a deck with one default page so the canvas is usable immediately.
 * Wrapped in a transaction so a deck never exists without a page.
 */
export function createDeck(db: ConDeckDb, input: CreateDeckInput): DeckDetail {
  const deckId = randomUUID();

  db.transaction((tx) => {
    tx.insert(decks)
      .values({
        id: deckId,
        profileId: input.profileId,
        name: input.name,
        columns: input.columns ?? defaultGrid.columns,
        rows: input.rows ?? defaultGrid.rows,
      })
      .run();

    tx.insert(pages)
      .values({
        id: randomUUID(),
        deckId,
        name: DEFAULT_PAGE_NAME,
        position: 0,
      })
      .run();
  });

  return getDeckDetail(db, deckId);
}

/** Renames and/or resizes a deck. Shrinking is refused while buttons would fall outside. */
export function updateDeck(db: ConDeckDb, input: UpdateDeckInput): Deck {
  return db.transaction((tx) => {
    const current = tx.select().from(decks).where(eq(decks.id, input.deckId)).get();
    if (!current) {
      throw new AppError('NOT_FOUND', 'Deck not found.');
    }

    const columns = input.columns ?? current.columns;
    const rows = input.rows ?? current.rows;

    if (columns !== current.columns || rows !== current.rows) {
      const capacity = columns * rows;
      const deckPageIds = tx
        .select({ id: pages.id })
        .from(pages)
        .where(eq(pages.deckId, current.id))
        .all()
        .map((row) => row.id);

      const outside = deckPageIds.length
        ? tx
            .select({ position: buttons.position })
            .from(buttons)
            .where(inArray(buttons.pageId, deckPageIds))
            .all()
            .filter((button) => button.position >= capacity)
        : [];

      if (outside.length > 0) {
        throw new AppError(
          'CONFLICT',
          `${outside.length} button${outside.length === 1 ? '' : 's'} would sit outside a ${columns} × ${rows} grid. Move or delete them first.`,
        );
      }
    }

    const updated = tx
      .update(decks)
      .set({
        name: input.name ?? current.name,
        columns,
        rows,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(decks.id, current.id))
      .returning()
      .get();

    if (!updated) {
      throw new AppError('DATABASE_ERROR', 'Deck could not be updated.');
    }
    return toDeck(updated);
  });
}

/** Deletes a deck; pages, buttons and actions follow the database cascade. */
export function deleteDeck(db: ConDeckDb, deckId: string): void {
  const result = db.delete(decks).where(eq(decks.id, deckId)).run();
  if (result.changes === 0) {
    throw new AppError('NOT_FOUND', 'Deck not found.');
  }
}

/** Highest page position in a deck, used to append new pages. */
export function nextPagePosition(db: ConDeckDb, deckId: string): number {
  const [row] = db
    .select({ value: max(pages.position) })
    .from(pages)
    .where(eq(pages.deckId, deckId))
    .all();
  return row?.value === null || row?.value === undefined ? 0 : row.value + 1;
}
