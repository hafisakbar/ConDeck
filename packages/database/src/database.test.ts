import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type ConDeckDatabase } from './client';
import { activityLogs, actions, buttons, decks, pages, profiles } from './schema';
import {
  countProfiles,
  createProfile,
  getActiveProfile,
  listProfiles,
  setActiveProfile,
} from './repositories/profiles';
import { listRecentActivity, recordActivity } from './repositories/activity-logs';

let workDir: string;
let database: ConDeckDatabase;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'condeck-db-'));
  database = openDatabase({ filePath: join(workDir, 'condeck.db') });
});

afterEach(() => {
  database.close();
  rmSync(workDir, { recursive: true, force: true });
});

describe('database bootstrap', () => {
  it('creates every entity from DATABASE_DESIGN.md', () => {
    const rows = database.sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as Array<{ name: string }>;
    const tables = rows.map((row) => row.name);

    for (const table of [
      'activity_logs',
      'actions',
      'buttons',
      'device_sessions',
      'devices',
      'decks',
      'integrations',
      'media_assets',
      'pages',
      'profiles',
    ]) {
      expect(tables).toContain(table);
    }
  });

  it('enables foreign keys and WAL journaling', () => {
    expect(database.sqlite.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(String(database.sqlite.pragma('journal_mode', { simple: true }))).toBe('wal');
  });

  it('does not re-apply migrations when the database is reopened', () => {
    database.close();
    const applied: string[] = [];
    database = openDatabase({
      filePath: join(workDir, 'condeck.db'),
      onMigrationsApplied: (ids) => applied.push(...ids),
    });

    expect(applied).toEqual([]);
  });
});

describe('profiles', () => {
  it('persists a profile and makes the first profile active', () => {
    const created = createProfile(database.db, { name: 'Streaming' });

    expect(created.name).toBe('Streaming');
    expect(created.isActive).toBe(true);
    expect(countProfiles(database.db)).toBe(1);
    expect(getActiveProfile(database.db)?.id).toBe(created.id);
  });

  it('survives a reopen of the database file', () => {
    createProfile(database.db, { name: 'Gaming' });
    database.close();
    database = openDatabase({ filePath: join(workDir, 'condeck.db') });

    expect(listProfiles(database.db).map((profile) => profile.name)).toEqual(['Gaming']);
  });

  it('keeps exactly one active profile when activating another', () => {
    const first = createProfile(database.db, { name: 'Streaming' });
    const second = createProfile(database.db, { name: 'Gaming' });

    setActiveProfile(database.db, second.id);

    const active = listProfiles(database.db).filter((profile) => profile.isActive);
    expect(active).toHaveLength(1);
    expect(active[0]?.id).toBe(second.id);
    expect(active[0]?.id).not.toBe(first.id);
  });

  it('rejects activating a profile that does not exist', () => {
    expect(() => setActiveProfile(database.db, 'd5a9c1f4-0f8e-4d1a-9a1e-1c6e6b0f0000')).toThrowError(
      /Profile not found/,
    );
  });
});

describe('relational integrity', () => {
  function seedDeck(): { profileId: string; buttonId: string } {
    const profile = createProfile(database.db, { name: 'Streaming' });
    const deckId = 'c6f0f0e8-2f9c-4b4a-8f60-4b2c4a9e0a01';
    const pageId = 'c6f0f0e8-2f9c-4b4a-8f60-4b2c4a9e0a02';
    const buttonId = 'c6f0f0e8-2f9c-4b4a-8f60-4b2c4a9e0a03';

    database.db.insert(decks).values({ id: deckId, profileId: profile.id, name: 'Main Deck', columns: 3, rows: 3 }).run();
    database.db.insert(pages).values({ id: pageId, deckId, name: 'Main', position: 0 }).run();
    database.db
      .insert(buttons)
      .values({
        id: buttonId,
        pageId,
        position: 0,
        label: 'Go Live',
        backgroundColor: '#111318',
        textColor: '#f5f5f5',
      })
      .run();
    database.db
      .insert(actions)
      .values({
        id: 'c6f0f0e8-2f9c-4b4a-8f60-4b2c4a9e0a04',
        buttonId,
        actionType: 'OBS_START_STREAMING',
        configJson: '{}',
        position: 0,
      })
      .run();

    return { profileId: profile.id, buttonId };
  }

  it('cascades deletes from profile to buttons and actions', () => {
    const { profileId } = seedDeck();

    database.db.delete(profiles).where(eq(profiles.id, profileId)).run();

    expect(database.db.select().from(decks).all()).toHaveLength(0);
    expect(database.db.select().from(pages).all()).toHaveLength(0);
    expect(database.db.select().from(buttons).all()).toHaveLength(0);
    expect(database.db.select().from(actions).all()).toHaveLength(0);
  });

  it('rejects two buttons on the same page position', () => {
    const { profileId } = seedDeck();
    const pageId = database.db.select().from(pages).all()[0]?.id;
    expect(pageId).toBeDefined();

    expect(() => {
      database.db
        .insert(buttons)
        .values({
          id: 'c6f0f0e8-2f9c-4b4a-8f60-4b2c4a9e0a05',
          pageId: pageId ?? '',
          position: 0,
          label: 'Duplicate',
          backgroundColor: '#111318',
          textColor: '#f5f5f5',
        })
        .run();
    }).toThrowError(/UNIQUE|unique/);
    expect(profileId).toBeTruthy();
  });
});

describe('activity logs', () => {
  it('stores metadata as JSON and returns newest first', () => {
    recordActivity(database.db, { eventType: 'APP_STARTED', description: 'ConDeck started' });
    recordActivity(database.db, {
      eventType: 'PROFILE_CREATED',
      description: 'Created profile',
      metadata: { profileName: 'Streaming' },
    });

    const logs = listRecentActivity(database.db, 10);
    expect(logs.map((log) => log.eventType)).toEqual(['PROFILE_CREATED', 'APP_STARTED']);
    expect(logs[0]?.metadata).toEqual({ profileName: 'Streaming' });
  });

  it('ignores corrupt metadata instead of throwing', () => {
    database.db
      .insert(activityLogs)
      .values({
        id: '0f3a4f2a-1c5f-4a1e-9f4a-0b0c1d2e3f40',
        eventType: 'BROKEN',
        description: 'Corrupt metadata',
        metadataJson: '{not-json',
      })
      .run();

    expect(listRecentActivity(database.db)[0]?.metadata).toBeNull();
  });
});
