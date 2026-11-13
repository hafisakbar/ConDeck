import {
  getActiveProfile,
  getDeckDetail,
  getIntegrationByProvider,
  listDecks,
  recordActivity,
  revokeDevice as revokeDeviceRecord,
  upsertIntegration,
  type ConDeckDb,
} from '@condeck/database';
import {
  AppError,
  remoteDefaultPort,
  type ActionExecutionResult,
  type DeckDetail,
  type Device,
  type ObsSnapshot,
  type RemotePairing,
  type RemoteServerStatus,
  type SaveRemoteSettingsInput,
  type TikTokSnapshot,
} from '@condeck/shared';
import { createRemoteServer, type RemoteActivityEvent, type RemoteServerLogger } from './remote-server.service';

const REMOTE_PROVIDER = 'remote';

export interface RemoteServiceOptions {
  db: ConDeckDb;
  executeAction: (buttonId: string) => Promise<ActionExecutionResult>;
  getObsSnapshot: () => ObsSnapshot | null;
  getTikTokSnapshot?: () => TikTokSnapshot | null;
  /** Directory with the built mobile app, or null when it is not available. */
  mobileAssetsDir?: string | null;
  onStatusChange?: (status: RemoteServerStatus) => void;
  logger?: RemoteServerLogger;
  /** Tests only: force the port the server binds instead of the stored one. */
  portOverride?: number;
}

export interface RemoteService {
  /** Starts the server when the saved settings allow it. Never throws. */
  initialize(): Promise<void>;
  getStatus(): RemoteServerStatus;
  saveSettings(input: SaveRemoteSettingsInput): Promise<RemoteServerStatus>;
  start(): Promise<RemoteServerStatus>;
  stop(): Promise<RemoteServerStatus>;
  createPairing(): Promise<RemotePairing>;
  revokeDevice(deviceId: string): Device;
  notifyDeckChanged(): void;
  notifyObsStatus(): void;
  notifyTikTokStatus(): void;
  dispose(): Promise<void>;
}

interface StoredSettings {
  port: number;
  isEnabled: boolean;
}

/**
 * Owns the single remote server of a running ConDeck instance.
 *
 * Settings live in the existing integrations table (provider `remote`), so no
 * migration is needed and the database keeps its "no secrets, configuration
 * only" rule.
 */
export function createRemoteService({
  db,
  executeAction,
  getObsSnapshot,
  getTikTokSnapshot,
  mobileAssetsDir = null,
  onStatusChange,
  logger,
  portOverride,
}: RemoteServiceOptions): RemoteService {
  function readSettings(): StoredSettings {
    const row = getIntegrationByProvider(db, REMOTE_PROVIDER);
    return {
      port: row?.port ?? remoteDefaultPort,
      isEnabled: row?.isEnabled ?? true,
    };
  }

  let settings = readSettings();

  function describeActivity(event: RemoteActivityEvent): void {
    recordActivity(db, {
      eventType: event.eventType,
      description: event.description,
      deviceId: event.deviceId ?? null,
      ...(event.metadata ? { metadata: event.metadata } : {}),
    });
  }

  function buildServer(): ReturnType<typeof createRemoteServer> {
    return createRemoteServer({
      db,
      executeAction,
      getActiveDeck: resolveActiveDeck,
      getObsSnapshot,
      ...(getTikTokSnapshot ? { getTikTokSnapshot } : {}),
      mobileAssetsDir,
      port: portOverride ?? settings.port,
      ...(logger ? { logger } : {}),
      onStatusChange: (status) => onStatusChange?.(withSettings(status)),
      onActivity: describeActivity,
    });
  }

  let server = buildServer();

  function resolveActiveDeck(): DeckDetail | null {
    const profile = getActiveProfile(db);
    if (!profile) {
      return null;
    }

    const [deck] = listDecks(db, profile.id);
    if (!deck) {
      return null;
    }

    return getDeckDetail(db, deck.id);
  }

  function withSettings(status: RemoteServerStatus): RemoteServerStatus {
    return { ...status, isEnabled: settings.isEnabled };
  }

  function getStatus(): RemoteServerStatus {
    return withSettings(server.getStatus());
  }

  async function start(): Promise<RemoteServerStatus> {
    if (!settings.isEnabled) {
      throw new AppError(
        'INVALID_INPUT',
        'The remote server is turned off. Enable it before starting it.',
      );
    }
    await server.start();
    return getStatus();
  }

  async function stop(): Promise<RemoteServerStatus> {
    await server.stop();
    return getStatus();
  }

  return {
    async initialize() {
      if (!settings.isEnabled) {
        logger?.info('Remote server disabled in settings');
        return;
      }

      try {
        await server.start();
      } catch (error) {
        logger?.warn('Remote server did not start', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },

    getStatus,

    async saveSettings(input) {
      const row = upsertIntegration(db, {
        provider: REMOTE_PROVIDER,
        displayName: 'Remote',
        host: null,
        port: input.port,
        credentialReference: null,
        isEnabled: input.isEnabled,
      });

      settings = { port: row.port ?? remoteDefaultPort, isEnabled: row.isEnabled };

      // The bound port cannot change in place, so the server is rebuilt.
      await server.stop();
      server = buildServer();

      if (input.isEnabled) {
        try {
          await server.start();
        } catch (error) {
          logger?.warn('Remote server could not restart on the new port', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      recordActivity(db, {
        eventType: 'REMOTE_SETTINGS_SAVED',
        description: `Remote server settings saved (port ${input.port}, ${input.isEnabled ? 'enabled' : 'disabled'})`,
        metadata: { port: input.port, isEnabled: input.isEnabled },
      });

      return getStatus();
    },

    start,
    stop,

    async createPairing() {
      const pairing = await server.createPairing();
      logger?.info('Pairing QR created');
      return pairing;
    },

    revokeDevice(deviceId) {
      const device = revokeDeviceRecord(db, deviceId);
      server.disconnectDevice(deviceId);
      describeActivity({
        eventType: 'DEVICE_REVOKED',
        description: `Access for device "${device.deviceName}" was revoked`,
        deviceId: device.id,
      });
      logger?.info('Remote device revoked', { deviceId });
      return device;
    },

    notifyDeckChanged() {
      server.notifyDeckChanged();
    },

    notifyObsStatus() {
      server.broadcastObsStatus();
    },

    notifyTikTokStatus() {
      server.broadcastTikTokStatus();
    },

    dispose() {
      return server.stop();
    },
  };
}
