import { describe, expect, it } from 'vitest';
import { openDatabase } from './client';
import { getIntegrationByProvider, upsertIntegration } from './repositories/integrations';
import { integrations } from './schema';

function setup() {
  return openDatabase({ filePath: ':memory:' });
}

describe('upsertIntegration', () => {
  it('creates the OBS row once and reads it back', () => {
    const database = setup();

    const row = upsertIntegration(database.db, {
      provider: 'obs',
      displayName: 'OBS Studio',
      host: '127.0.0.1',
      port: 4455,
      credentialReference: null,
      isEnabled: true,
    });

    expect(row.host).toBe('127.0.0.1');
    expect(row.port).toBe(4455);
    expect(getIntegrationByProvider(database.db, 'obs')?.id).toBe(row.id);
    database.close();
  });

  it('updates the same row instead of stacking configurations', () => {
    const database = setup();
    const first = upsertIntegration(database.db, {
      provider: 'obs',
      displayName: 'OBS Studio',
      host: '127.0.0.1',
      port: 4455,
      credentialReference: null,
      isEnabled: true,
    });

    const second = upsertIntegration(database.db, {
      provider: 'obs',
      displayName: 'OBS Studio',
      host: '192.168.1.20',
      port: 4460,
      credentialReference: 'safeStorage:v1:abc',
      isEnabled: false,
    });

    const rows = database.db.select().from(integrations).all();
    expect(rows).toHaveLength(1);
    expect(second.id).toBe(first.id);
    expect(second.host).toBe('192.168.1.20');
    expect(second.port).toBe(4460);
    expect(second.credentialReference).toBe('safeStorage:v1:abc');
    expect(second.isEnabled).toBe(false);
    database.close();
  });

  it('can clear the stored password reference', () => {
    const database = setup();
    upsertIntegration(database.db, {
      provider: 'obs',
      displayName: 'OBS Studio',
      host: '127.0.0.1',
      port: 4455,
      credentialReference: 'safeStorage:v1:abc',
      isEnabled: true,
    });

    upsertIntegration(database.db, {
      provider: 'obs',
      displayName: 'OBS Studio',
      host: '127.0.0.1',
      port: 4455,
      credentialReference: null,
      isEnabled: true,
    });

    expect(getIntegrationByProvider(database.db, 'obs')?.credentialReference).toBeNull();
    database.close();
  });
});
