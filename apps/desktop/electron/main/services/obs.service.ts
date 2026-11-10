import type { ObsPort } from '@condeck/action-engine';
import { getIntegrationByProvider, upsertIntegration, type ConDeckDb } from '@condeck/database';
import { createObsClient, type ObsClient } from '@condeck/obs-integration';
import {
  AppError,
  OBS_DEFAULT_HOST,
  OBS_DEFAULT_PORT,
  type ObsSnapshot,
  type ObsStatus,
  type ObsTestResult,
  type SaveObsSettingsInput,
} from '@condeck/shared';
import { isSecretReference, type SecretStore } from './obs-secrets';

const OBS_PROVIDER = 'obs';
const OBS_DISPLAY_NAME = 'OBS Studio';

export interface ObsServiceOptions {
  db: ConDeckDb;
  secrets: SecretStore;
  /** Creates a client; overridable in tests. */
  createClient?: () => ObsClient;
  /** Called with every live snapshot so the desktop can push it to windows. */
  onChange?: (snapshot: ObsSnapshot) => void;
}

export interface ObsService {
  getSnapshot(): ObsSnapshot;
  saveSettings(input: SaveObsSettingsInput): ObsSnapshot;
  connect(): Promise<ObsSnapshot>;
  disconnect(): Promise<ObsSnapshot>;
  testConnection(input: SaveObsSettingsInput): Promise<ObsTestResult>;
  listScenes(): Promise<string[]>;
  /** Dashboard summary projection of the live state. */
  getStatus(): ObsStatus;
  /** Action-engine port so OBS actions use the same connection. */
  getActionPort(): ObsPort;
  dispose(): Promise<void>;
}

/**
 * Owns the OBS connection and the saved integration settings.
 *
 * Every state change produced by OBS (scene switched in OBS itself, stream
 * started, connection lost) reaches the renderer through `onChange`, so the UI
 * reflects OBS rather than the last thing ConDeck asked for.
 */
export function createObsService({
  db,
  secrets,
  createClient = () => createObsClient(),
  onChange,
}: ObsServiceOptions): ObsService {
  const client = createClient();
  let lastError: string | null = null;

  client.subscribe(() => {
    onChange?.(buildSnapshot());
  });

  function readRow() {
    return getIntegrationByProvider(db, OBS_PROVIDER);
  }

  function buildSnapshot(): ObsSnapshot {
    const row = readRow();
    const status = client.snapshot();

    if (!row) {
      return {
        state: 'NOT_CONFIGURED',
        message: null,
        host: null,
        port: null,
        isEnabled: false,
        hasPassword: false,
        sceneName: null,
        scenes: [],
        isStreaming: false,
        isRecording: false,
        mutedInputs: {},
      };
    }

    const base = {
      host: row.host ?? OBS_DEFAULT_HOST,
      port: row.port ?? OBS_DEFAULT_PORT,
      isEnabled: row.isEnabled,
      hasPassword: isSecretReference(row.credentialReference),
    };

    if (!row.isEnabled) {
      return {
        ...base,
        state: 'DISABLED',
        message: null,
        sceneName: null,
        scenes: [],
        isStreaming: false,
        isRecording: false,
        mutedInputs: {},
      };
    }

    if (!client.isConnected()) {
      return {
        ...base,
        state: 'DISCONNECTED',
        message: lastError,
        sceneName: null,
        scenes: [],
        isStreaming: false,
        isRecording: false,
        mutedInputs: {},
      };
    }

    return {
      ...base,
      state: 'CONNECTED',
      message: null,
      sceneName: status.sceneName,
      scenes: status.scenes,
      isStreaming: status.isStreaming,
      isRecording: status.isRecording,
      mutedInputs: status.mutedInputs,
    };
  }

  function resolveSavedPassword(): string | null {
    const row = readRow();
    if (!row || !isSecretReference(row.credentialReference)) {
      return null;
    }
    return secrets.decrypt(row.credentialReference);
  }

  function resolvePasswordForSave(input: SaveObsSettingsInput): string | null {
    const row = readRow();

    if (input.password === undefined) {
      return row?.credentialReference ?? null;
    }
    if (input.password === '') {
      return null;
    }
    if (!secrets.isAvailable()) {
      throw new AppError(
        'NOT_AVAILABLE',
        'This system has no secure credential store, so the OBS password cannot be saved. Enable the OS keyring, or leave the OBS password empty.',
      );
    }
    return secrets.encrypt(input.password);
  }

  function requireRow() {
    const row = readRow();
    if (!row) {
      throw new AppError(
        'NOT_AVAILABLE',
        'OBS has not been configured yet. Set the host and port in Integrations first.',
      );
    }
    if (!row.isEnabled) {
      throw new AppError(
        'NOT_AVAILABLE',
        'The OBS integration is disabled. Enable it in Integrations before connecting.',
      );
    }
    return row;
  }

  function address(row: { host: string | null; port: number | null }): {
    host: string;
    port: number;
  } {
    return { host: row.host ?? OBS_DEFAULT_HOST, port: row.port ?? OBS_DEFAULT_PORT };
  }

  return {
    getSnapshot: buildSnapshot,

    saveSettings(input) {
      if (client.isConnected()) {
        // The address or password changed, so the live connection is stale.
        void client.disconnect();
      }

      const credentialReference = resolvePasswordForSave(input);
      upsertIntegration(db, {
        provider: OBS_PROVIDER,
        displayName: OBS_DISPLAY_NAME,
        host: input.host,
        port: input.port,
        credentialReference,
        isEnabled: input.isEnabled,
      });

      lastError = null;
      const snapshot = buildSnapshot();
      onChange?.(snapshot);
      return snapshot;
    },

    async connect() {
      const row = requireRow();
      const { host, port } = address(row);
      const password = resolveSavedPassword();

      try {
        await client.connect({ host, port, password });
        lastError = null;
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Could not connect to OBS.';
        onChange?.(buildSnapshot());
        throw error;
      }

      const snapshot = buildSnapshot();
      onChange?.(snapshot);
      return snapshot;
    },

    async disconnect() {
      await client.disconnect();
      lastError = null;
      const snapshot = buildSnapshot();
      onChange?.(snapshot);
      return snapshot;
    },

    async testConnection(input) {
      const host = input.host;
      const port = input.port;

      let password: string | null;
      try {
        password =
          input.password === undefined
            ? resolveSavedPassword()
            : input.password === ''
              ? null
              : input.password;
      } catch (error) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : 'The saved password could not be read.',
          scenes: [],
        };
      }

      const probe = createClient();
      try {
        await probe.connect({ host, port, password });
        const scenes = await probe.listScenes();
        const status = probe.snapshot();
        const suffix = status.sceneName ? ` Current scene: “${status.sceneName}”.` : '';
        return {
          ok: true,
          message: `Connected to OBS at ${host}:${port}.${suffix}`,
          scenes,
        };
      } catch (error) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : 'Could not connect to OBS.',
          scenes: [],
        };
      } finally {
        await probe.disconnect();
      }
    },

    async listScenes() {
      return client.listScenes();
    },

    getStatus() {
      const snapshot = buildSnapshot();
      switch (snapshot.state) {
        case 'CONNECTED':
          return {
            state: 'CONNECTED' as const,
            message: snapshot.sceneName ? `Scene: ${snapshot.sceneName}` : 'Connected',
          };
        case 'DISABLED':
          return { state: 'DISABLED' as const, message: 'OBS integration is disabled.' };
        case 'DISCONNECTED':
          return {
            state: 'DISCONNECTED' as const,
            message: snapshot.message ?? 'OBS is configured but not connected.',
          };
        default:
          return {
            state: 'NOT_CONFIGURED' as const,
            message: 'OBS Studio has not been configured yet.',
          };
      }
    },

    getActionPort() {
      return {
        isConnected: () => client.isConnected(),
        switchScene: (sceneName) => client.switchScene(sceneName),
        startStreaming: () => client.startStreaming(),
        stopStreaming: () => client.stopStreaming(),
        startRecording: () => client.startRecording(),
        stopRecording: () => client.stopRecording(),
        getInputMute: (inputName) => client.getInputMute(inputName),
        setInputMute: (inputName, muted) => client.setInputMute(inputName, muted),
      };
    },

    async dispose() {
      await client.disconnect();
    },
  };
}
