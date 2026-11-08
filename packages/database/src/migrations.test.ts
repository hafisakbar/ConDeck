import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase } from './client';
import { migrations, runMigrations } from './migrate';
import { createProfile, listProfiles } from './repositories/profiles';

const workDirs: string[] = [];

function workDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'condeck-migrations-'));
  workDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of workDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('database migrations', () => {
  it('applies every bundled migration exactly once and records it', () => {
    const sqlite = new Database(':memory:');
    const first = runMigrations(sqlite);
    const second = runMigrations(sqlite);

    expect(first).toEqual(migrations.map((migration) => migration.id));
    expect(second).toEqual([]);

    const rows = sqlite
      .prepare('SELECT id, applied_at FROM __condeck_migrations ORDER BY id')
      .all() as Array<{ id: string; applied_at: string }>;
    expect(rows.map((row) => row.id)).toEqual(first);
    expect(Number.isNaN(Date.parse(rows[0]?.applied_at ?? ''))).toBe(false);

    sqlite.close();
  });

  it('keeps user data across a close/reopen and never re-runs migrations', () => {
    const filePath = join(workDir(), 'condeck.db');
    const applied: string[] = [];

    const first = openDatabase({
      filePath,
      onMigrationsApplied: (ids) => applied.push(...ids),
    });
    createProfile(first.db, { name: 'Streaming' });
    first.close();

    const reopened = openDatabase({
      filePath,
      onMigrationsApplied: (ids) => applied.push(...ids),
    });

    expect(applied).toEqual(migrations.map((migration) => migration.id));
    expect(listProfiles(reopened.db).map((profile) => profile.name)).toEqual(['Streaming']);
    reopened.close();
  });

  it('creates the tables that older releases rely on', () => {
    const filePath = join(workDir(), 'condeck.db');
    const database = openDatabase({ filePath });

    const tables = (
      database.sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all() as Array<{ name: string }>
    ).map((row) => row.name);

    for (const table of ['profiles', 'decks', 'pages', 'buttons', 'actions', 'devices', 'device_sessions', 'integrations']) {
      expect(tables).toContain(table);
    }

    database.close();
  });

  it('rolls back a migration that fails halfway through', () => {
    const sqlite = new Database(':memory:');
    expect(() =>
      sqlite.transaction(() => {
        sqlite.exec('CREATE TABLE half_applied (id TEXT PRIMARY KEY)');
        sqlite.exec('THIS IS NOT SQL');
      })(),
    ).toThrow();

    const tables = (
      sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>
    ).map((row) => row.name);
    expect(tables).not.toContain('half_applied');

    sqlite.close();
  });
});
