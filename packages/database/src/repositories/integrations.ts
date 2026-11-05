import { eq } from 'drizzle-orm';
import type { ConDeckDb } from '../client';
import { integrations } from '../schema';

export type IntegrationRow = typeof integrations.$inferSelect;

export function getIntegrationByProvider(db: ConDeckDb, provider: string): IntegrationRow | null {
  return db.select().from(integrations).where(eq(integrations.provider, provider)).get() ?? null;
}
