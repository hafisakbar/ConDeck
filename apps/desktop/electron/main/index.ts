import { existsSync } from 'node:fs';
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
import { createSoundService } from './services/sound.service';
import { createRemoteService, type RemoteService } from './services/remote.service';
import { createTikTokService, type TikTokService } from './services/tiktok.service';
import { createMainWindow } from './window';

// Kept stable so Windows treats this as the same installed application.
const APP_USER_MODEL_ID = 'com.condeck.app';

/*
 * The rename must not move the application data. Electron derives `userData`
 * from the product name, so point it at the folder the previous name used
 * before anything reads the database, sounds or custom icons.
 */
app.setName('StreamKey');
app.setPath('userData', join(app.getPath('appData'), 'ConDeck'));

let logger: FileLogger | null = null;
let obsService: ObsService | null = null;
let remoteService: RemoteService | null = null;
let tiktokService: TikTokService | null = null;

function createLogger(): FileLogger {
  logger ??= new FileLogger(join(app.getPath('userData'), 'logs', 'condeck.log'));
  return logger;
}

/**
 * The mobile PWA is served from its build output. Packaged builds ship it in
 * `resources/mobile`; a development checkout uses `apps/mobile/dist`.
 */
function resolveMobileAssetsDir(): string | null {
  const candidates: string[] = [];
  if (process.env.CONDECK_MOBILE_DIR) {
    candidates.push(process.env.CONDECK_MOBILE_DIR);
  }
  candidates.push(
    app.isPackaged
      ? join(process.resourcesPath, 'mobile')
      : join(app.getAppPath(), '..', 'mobile', 'dist'),
  );

  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'index.html'))) {
      return candidate;
    }
  }
  return null;
}

function buildAppInfo(): AppInfo {
  const activeLogger = createLogger();
  return {
    name: 'StreamKey',
    version: app.getVersion(),
    platform: `${process.platform} ${process.arch}`,
    isPackaged: app.isPackaged,
    databasePath: getDatabasePath(),
    logPath: activeLogger.filePath,
  };
}

function bootstrap(): void {
  const activeLogger = createLogger();
  activeLogger.info('StreamKey starting', { version: app.getVersion(), packaged: app.isPackaged });

  const database = initDatabase(activeLogger);

  const broadcast = (channel: string, payload: unknown): void => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(channel, payload);
    }
  };

  const activeObsService = createObsService({
    db: database.db,
    secrets: createSafeStorageSecretStore(),
    onChange: (snapshot) => {
      broadcast('obs:status', snapshot);
      remoteService?.notifyObsStatus();
    },
  });
  obsService = activeObsService;

  const activeTikTokService = createTikTokService({
    db: database.db,
    onChange: (snapshot) => {
      broadcast('tiktok:status', snapshot);
      remoteService?.notifyTikTokStatus();
    },
  });
  tiktokService = activeTikTokService;

  const soundService = createSoundService({
    db: database.db,
    soundsDir: join(app.getPath('userData'), 'sounds'),
    broadcast,
    logger: activeLogger,
  });

  const actionPorts = createActionPorts({
    sendNavigation: (request) => broadcast('navigation:request', request),
    obs: activeObsService.getActionPort(),
    tiktok: activeTikTokService.getActionPort(),
    soundboard: {
      play: async (soundId, mode) => soundService.play(soundId, mode).name,
    },
  });

  const actions = createActionService({ db: database.db, ports: actionPorts });

  const activeRemoteService = createRemoteService({
    db: database.db,
    executeAction: (buttonId) => actions.execute(buttonId),
    getObsSnapshot: () => activeObsService.getSnapshot(),
    getTikTokSnapshot: () => activeTikTokService.getSnapshot(),
    mobileAssetsDir: resolveMobileAssetsDir(),
    logger: activeLogger,
    onStatusChange: (status) => broadcast('remote:status', status),
  });
  remoteService = activeRemoteService;

  registerIpcHandlers({
    logger: activeLogger,
    db: database.db,
    getAppInfo: buildAppInfo,
    actions,
    sounds: soundService,
    obs: activeObsService,
    tiktok: activeTikTokService,
    remote: activeRemoteService,
  });

  recordActivity(database.db, {
    eventType: 'APP_STARTED',
    description: `StreamKey ${app.getVersion()} started`,
  });

  createMainWindow({
    preloadPath: join(app.getAppPath(), 'dist-electron', 'preload', 'index.cjs'),
    indexPath: join(app.getAppPath(), 'dist', 'index.html'),
    devServerUrl: process.env.VITE_DEV_SERVER_URL,
  });

  activeLogger.info('Main window created');

  void activeRemoteService.initialize();
  void activeTikTokService.initialize();
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
        createLogger().error('StreamKey failed to start', {
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
    logger?.info('StreamKey shutting down');
    void remoteService?.dispose();
    void obsService?.dispose();
    void tiktokService?.dispose();
    closeDatabase();
  });
}
