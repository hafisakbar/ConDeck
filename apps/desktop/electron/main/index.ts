import { join } from 'node:path';
import { recordActivity } from '@condeck/database';
import type { AppInfo } from '@condeck/shared';
import { app, BrowserWindow } from 'electron';
import { registerIpcHandlers } from './ipc/handlers';
import { FileLogger } from './logger';
import { createActionPorts } from './services/action-ports';
import { createActionService } from './services/action.service';
import { closeDatabase, getDatabasePath, initDatabase } from './services/database.service';
import { createSafeStorageSecretStore } from './services/obs-secrets';
import { createObsService, type ObsService } from './services/obs.service';
import { createMainWindow } from './window';

const APP_USER_MODEL_ID = 'com.condeck.app';

let logger: FileLogger | null = null;
let obsService: ObsService | null = null;

function createLogger(): FileLogger {
  logger ??= new FileLogger(join(app.getPath('userData'), 'logs', 'condeck.log'));
  return logger;
}

function buildAppInfo(): AppInfo {
  const activeLogger = createLogger();
  return {
    name: 'ConDeck',
    version: app.getVersion(),
    platform: `${process.platform} ${process.arch}`,
    isPackaged: app.isPackaged,
    databasePath: getDatabasePath(),
    logPath: activeLogger.filePath,
  };
}

function bootstrap(): void {
  const activeLogger = createLogger();
  activeLogger.info('ConDeck starting', { version: app.getVersion(), packaged: app.isPackaged });

  const database = initDatabase(activeLogger);

  const broadcast = (channel: string, payload: unknown): void => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(channel, payload);
    }
  };

  const activeObsService = createObsService({
    db: database.db,
    secrets: createSafeStorageSecretStore(),
    onChange: (snapshot) => broadcast('obs:status', snapshot),
  });
  obsService = activeObsService;

  const actionPorts = createActionPorts({
    sendNavigation: (request) => broadcast('navigation:request', request),
    obs: activeObsService.getActionPort(),
  });

  registerIpcHandlers({
    logger: activeLogger,
    db: database.db,
    getAppInfo: buildAppInfo,
    actions: createActionService({ db: database.db, ports: actionPorts }),
    obs: activeObsService,
  });

  recordActivity(database.db, {
    eventType: 'APP_STARTED',
    description: `ConDeck ${app.getVersion()} started`,
  });

  createMainWindow({
    preloadPath: join(app.getAppPath(), 'dist-electron', 'preload', 'index.cjs'),
    indexPath: join(app.getAppPath(), 'dist', 'index.html'),
    devServerUrl: process.env.VITE_DEV_SERVER_URL,
  });

  activeLogger.info('Main window created');
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [window] = BrowserWindow.getAllWindows();
    if (window) {
      if (window.isMinimized()) {
        window.restore();
      }
      window.focus();
    }
  });

  app.setAppUserModelId(APP_USER_MODEL_ID);

  app.whenReady().then(
    () => {
      try {
        bootstrap();
      } catch (error) {
        createLogger().error('ConDeck failed to start', {
          error: error instanceof Error ? error.message : String(error),
        });
        app.quit();
      }
    },
    (error: unknown) => {
      createLogger().error('Electron failed to become ready', {
        error: error instanceof Error ? error.message : String(error),
      });
      app.quit();
    },
  );

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('before-quit', () => {
    logger?.info('ConDeck shutting down');
    void obsService?.dispose();
    closeDatabase();
  });
}
