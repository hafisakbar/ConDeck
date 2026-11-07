import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { ConDeckDb } from '../client';
import { integrations } from '../schema';

export type IntegrationRow = typeof integrations.$inferSelect;

export function getIntegrationByProvider(db: ConDeckDb, provider: string): IntegrationRow | null {
  return db.select().from(integrations).where(eq(integrations.provider, provider)).get() ?? null;
}

export interface UpsertIntegrationInput {
  provider: string;
  displayName: string;
  host: string | null;
  port: number | null;
  /** Name of the safeStorage-protected secret; never the secret itself. */
  credentialReference: string | null;
  isEnabled: boolean;
}

/**
 * Creates or updates one integration (DATABASE_DESIGN.md §4.6). The provider is
 * unique, so saving the OBS settings twice updates the same row instead of
 * stacking configurations.
 */
export function upsertIntegration(db: ConDeckDb, input: UpsertIntegrationInput): IntegrationRow {
  const row = db
    .insert(integrations)
    .values({
      id: randomUUID(),
      provider: input.provider,
      displayName: input.displayName,
      host: input.host,
      port: input.port,
      credentialReference: input.credentialReference,
      isEnabled: input.isEnabled,
    })
    .onConflictDoUpdate({
      target: integrations.provider,
      set: {
        displayName: input.displayName,
        host: input.host,
        port: input.port,
        credentialReference: input.credentialReference,
        isEnabled: input.isEnabled,
        updatedAt: new Date().toISOString(),
      },
    })
    .returning()
    .get();

  if (!row) {
    throw new Error('The integration could not be saved.');
  }
  return row;
}
