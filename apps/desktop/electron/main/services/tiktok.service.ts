import type { TikTokPort } from '@condeck/action-engine';
import { getIntegrationByProvider, upsertIntegration, type ConDeckDb } from '@condeck/database';
import {
  AppError,
  emptyTikTokSnapshot,
  type SaveTikTokSettingsInput,
  type TikTokSnapshot,
  type TikTokTestResult,
} from '@condeck/shared';
import {
  createTikTokClient,
  type TikTokClient,
  type TikTokClientStatus,
} from '@condeck/tiktok-live-studio-integration';

const TIKTOK_PROVIDER = 'tiktok';
const TIKTOK_DISPLAY_NAME = 'TikTok LIVE Studio';

export interface TikTokServiceOptions {
  db: ConDeckDb;
  /** Overridable in tests. */
  client?: TikTokClient;
  onChange?: (snapshot: TikTokSnapshot) => void;
}

export interface TikTokService {
  getSnapshot(): TikTokSnapshot;
  saveSettings(input: SaveTikTokSettingsInput): TikTokSnapshot;
  connect(): Promise<TikTokSnapshot>;
  disconnect(): Promise<TikTokSnapshot>;
  testConnection(): Promise<TikTokTestResult>;
  /** Connects on startup when the integration is enabled and LIVE Studio is open. */
  initialize(): Promise<void>;
  getActionPort(): TikTokPort;
  dispose(): Promise<void>;
}

/**
 * Owns the single TikTok LIVE Studio connection and the saved preference.
 *
 * Nothing here touches the TikTok account: the integration only speaks to the
 * Socket.IO server of the locally installed LIVE Studio application.
 */
export function createTikTokService({
  db,
  client = createTikTokClient(),
  onChange,
}: TikTokServiceOptions): TikTokService {
  let lastStatus: TikTokClientStatus | null = null;

  function readRow() {
    return getIntegrationByProvider(db, TIKTOK_PROVIDER);
  }

  function isEnabled(): boolean {
    return readRow()?.isEnabled ?? true;
  }

  function buildSnapshot(): TikTokSnapshot {
    const enabled = isEnabled();
    const base = emptyTikTokSnapshot(enabled);

    if (!enabled) {
      return {
        ...base,
        message: 'The TikTok LIVE Studio integration is disabled.',
      };
    }

    const status = lastStatus ?? client.getStatus();
    return {
      ...base,
      state: status.state,
      message: status.message,
      found: status.found,
      version: status.version,
      port: status.port,
      sceneName: status.sceneName,
      scenes: status.scenes,
      micMuted: status.micMuted,
      audioMuted: status.audioMuted,
      recording: status.recording,
      streamStatus: status.streamStatus,
    };
  }

  function publish(): TikTokSnapshot {
    const snapshot = buildSnapshot();
    onChange?.(snapshot);
    return snapshot;
  }

  client.onChange((status) => {
    lastStatus = status;
    if (isEnabled()) {
      onChange?.(buildSnapshot());
    }
  });

  async function requireEnabled(): Promise<void> {
    if (!isEnabled()) {
      throw new AppError(
        'NOT_AVAILABLE',
        'The TikTok LIVE Studio integration is disabled. Enable it in Integrations first.',
      );
    }
  }

  return {
    getSnapshot: buildSnapshot,

    saveSettings(input) {
      upsertIntegration(db, {
        provider: TIKTOK_PROVIDER,
        displayName: TIKTOK_DISPLAY_NAME,
        host: null,
        port: null,
        credentialReference: null,
        isEnabled: input.isEnabled,
      });

      if (!input.isEnabled) {
        void client.disconnect();
      }

      return publish();
    },

    async connect() {
      await requireEnabled();
      await client.connect();
      return publish();
    },

    async disconnect() {
      await client.disconnect();
      return publish();
    },

    testConnection() {
      return client.test();
    },

    async initialize() {
      if (!isEnabled()) {
        return;
      }
      try {
        await client.connect();
      } catch {
        // A missing or closed LIVE Studio is a normal condition; the snapshot
        // already carries the actionable message.
      } finally {
        lastStatus = client.getStatus();
        publish();
      }
    },

    getActionPort() {
      return {
        isConnected: () => client.getStatus().state === 'CONNECTED',
        getState: () => client.getState(),
        switchScene: (sceneName) => client.switchScene(sceneName),
        setSourceVisible: (sceneName, sourceId, visible) =>
          client.setSourceVisible(sceneName, sourceId, visible),
        setMicMuted: (muted) => client.setMicMuted(muted),
        setAudioMuted: (muted) => client.setAudioMuted(muted),
        setRecording: (recording) => client.setRecording(recording),
      };
    },

    async dispose() {
      await client.dispose();
    },
  };
}
