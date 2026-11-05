import { join } from 'node:path';
import { openDatabase, type ConDeckDatabase } from '@condeck/database';
import { app } from 'electron';
import type { FileLogger } from '../logger';

let instance: ConDeckDatabase | null = null;

/** `%APPDATA%/condeck/condeck.db` on Windows. */
export function getDatabasePath(): string {
  return join(app.getPath('userData'), 'condeck.db');
}

export function initDatabase(logger: FileLogger): ConDeckDatabase {
  if (instance) {
    return instance;
  }
  const filePath = getDatabasePath();
  instance = openDatabase({
    filePath,
    onMigrationsApplied: (ids) => logger.info('Database migrations applied', { ids, filePath }),
  });
  logger.info('Database ready', { filePath });
  return instance;
}

export function getDatabase(): ConDeckDatabase {
  if (!instance) {
    throw new Error('Database has not been initialised yet.');
  }
  return instance;
}

export function closeDatabase(): void {
  instance?.close();
  instance = null;
}
