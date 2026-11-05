import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { runMigrations } from './migrate';

export type ConDeckDb = BetterSQLite3Database<typeof schema>;

export interface ConDeckDatabase {
  readonly db: ConDeckDb;
  readonly sqlite: Database.Database;
  close(): void;
}

export interface OpenDatabaseOptions {
  /** Absolute path to the SQLite file. Use `:memory:` for tests. */
  filePath: string;
  /** Log applied migrations; used by the desktop main process. */
  onMigrationsApplied?: (ids: string[]) => void;
}

/**
 * Opens (or creates) the ConDeck SQLite database, enables the pragmas required
 * by DATABASE_DESIGN.md (foreign keys, WAL) and runs pending migrations.
 */
export function openDatabase({ filePath, onMigrationsApplied }: OpenDatabaseOptions): ConDeckDatabase {
  if (filePath !== ':memory:') {
    mkdirSync(dirname(filePath), { recursive: true });
  }

  const sqlite = new Database(filePath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');

  const applied = runMigrations(sqlite);
  if (applied.length > 0) {
    onMigrationsApplied?.(applied);
  }

  const db = drizzle(sqlite, { schema });

  return {
    db,
    sqlite,
    close() {
      sqlite.close();
    },
  };
}
