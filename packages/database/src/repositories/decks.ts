import { count, eq } from 'drizzle-orm';
import type { ConDeckDb } from '../client';
import { decks } from '../schema';

export function countDecks(db: ConDeckDb, profileId?: string): number {
  const query = db.select({ value: count() }).from(decks);
  const [row] = profileId ? query.where(eq(decks.profileId, profileId)).all() : query.all();
  return row?.value ?? 0;
}
