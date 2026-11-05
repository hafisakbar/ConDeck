import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createProfile, integrations, openDatabase, recordActivity, type ConDeckDatabase } from '@condeck/database';
import type { AppInfo } from '@condeck/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildDashboardSummary } from './dashboard.service';

const appInfo: AppInfo = {
  name: 'ConDeck',
  version: '0.1.0-test',
  platform: 'win32 x64',
  isPackaged: false,
  databasePath: 'C:/tmp/condeck.db',
  logPath: 'C:/tmp/condeck.log',
};

let workDir: string;
let database: ConDeckDatabase;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'condeck-dashboard-'));
  database = openDatabase({ filePath: join(workDir, 'condeck.db') });
});

afterEach(() => {
  database.close();
  rmSync(workDir, { recursive: true, force: true });
});

describe('buildDashboardSummary', () => {
  it('describes a fresh install without pretending OBS or devices exist', () => {
    const summary = buildDashboardSummary({ db: database.db, appInfo });

    expect(summary.profile.total).toBe(0);
    expect(summary.profile.active).toBeNull();
    expect(summary.deck.total).toBe(0);
    expect(summary.devices).toEqual({ paired: 0, online: 0 });
    expect(summary.obs.state).toBe('NOT_CONFIGURED');
    expect(summary.activity).toEqual([]);
  });

  it('returns the active profile and the newest activity first', () => {
    createProfile(database.db, { name: 'Streaming' });
    recordActivity(database.db, { eventType: 'APP_STARTED', description: 'ConDeck started' });

    const summary = buildDashboardSummary({ db: database.db, appInfo });

    expect(summary.profile.total).toBe(1);
    expect(summary.profile.active?.name).toBe('Streaming');
    expect(summary.activity[0]?.eventType).toBe('APP_STARTED');
    expect(summary.app).toEqual(appInfo);
  });

  it('reports a disabled OBS integration instead of a connection', () => {
    database.db
      .insert(integrations)
      .values({
        id: '2c8c2f9e-8a4b-4c1a-9e1f-6a5b4c3d2e10',
        provider: 'obs',
        displayName: 'OBS Studio',
        host: '127.0.0.1',
        port: 4455,
        isEnabled: false,
      })
      .run();

    const summary = buildDashboardSummary({ db: database.db, appInfo });

    expect(summary.obs.state).toBe('DISABLED');
  });
});
