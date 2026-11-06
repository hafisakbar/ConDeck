import { randomUUID } from 'node:crypto';
import { asc, eq } from 'drizzle-orm';
import {
  AppError,
  type CreatePageInput,
  type DeckDetail,
  type DeckPage,
  type UpdatePageInput,
} from '@condeck/shared';
import type { ConDeckDb } from '../client';
import { pages } from '../schema';
import { getDeckDetail, nextPagePosition } from './decks';

type PageRow = typeof pages.$inferSelect;

function toPage(row: PageRow): DeckPage {
  return {
    id: row.id,
    deckId: row.deckId,
    name: row.name,
    position: row.position,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Appends a page to the end of the deck (position = highest + 1). */
export function createPage(db: ConDeckDb, input: CreatePageInput): DeckDetail {
  const position = nextPagePosition(db, input.deckId);

  db.insert(pages)
    .values({
      id: randomUUID(),
      deckId: input.deckId,
      name: input.name,
      position,
    })
    .run();

  return getDeckDetail(db, input.deckId);
}

export function updatePage(db: ConDeckDb, input: UpdatePageInput): DeckPage {
  const updated = db
    .update(pages)
    .set({ name: input.name, updatedAt: new Date().toISOString() })
    .where(eq(pages.id, input.pageId))
    .returning()
    .get();

  if (!updated) {
    throw new AppError('NOT_FOUND', 'Page not found.');
  }
  return toPage(updated);
}

/**
 * Deletes a page and renumbers the remaining pages of the deck so positions stay
 * contiguous. The renumbering runs in two phases to respect the unique index on
 * (deck_id, position) — a direct shift could collide with the row being moved.
 */
export function deletePage(db: ConDeckDb, pageId: string): DeckDetail {
  const deckId = db.transaction((tx) => {
    const target = tx.select().from(pages).where(eq(pages.id, pageId)).get();
    if (!target) {
      throw new AppError('NOT_FOUND', 'Page not found.');
    }

    tx.delete(pages).where(eq(pages.id, pageId)).run();

    const remaining = tx
      .select()
      .from(pages)
      .where(eq(pages.deckId, target.deckId))
      .orderBy(asc(pages.position))
      .all();

    const now = new Date().toISOString();
    const offset = remaining.length + 1000;

    for (const row of remaining) {
      tx.update(pages)
        .set({ position: row.position + offset })
        .where(eq(pages.id, row.id))
        .run();
    }
    remaining.forEach((row, index) => {
      tx.update(pages)
        .set({ position: index, updatedAt: now })
        .where(eq(pages.id, row.id))
        .run();
    });

    return target.deckId;
  });

  return getDeckDetail(db, deckId);
}
