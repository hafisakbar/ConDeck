import { eq } from 'drizzle-orm';
import { AppError } from '@condeck/shared';
import type { ConDeckDb } from '../client';
import { decks, pages } from '../schema';

export interface PageGrid {
  deckId: string;
  columns: number;
  rows: number;
}

/** Resolves the grid a page belongs to (page → deck). */
export function getPageGrid(db: ConDeckDb, pageId: string): PageGrid {
  const row = db
    .select({ deckId: pages.deckId, columns: decks.columns, rows: decks.rows })
    .from(pages)
    .innerJoin(decks, eq(decks.id, pages.deckId))
    .where(eq(pages.id, pageId))
    .get();

  if (!row) {
    throw new AppError('NOT_FOUND', 'Page not found.');
  }
  return row;
}

/** DATABASE_DESIGN.md §7: a button position must stay inside the grid. */
export function assertPositionInGrid(position: number, grid: { columns: number; rows: number }): void {
  const capacity = grid.columns * grid.rows;
  if (position < 0 || position >= capacity) {
    throw new AppError(
      'INVALID_INPUT',
      `Position ${position} is outside the ${grid.columns} × ${grid.rows} grid.`,
    );
  }
}
