import { AppError } from '@condeck/shared';
import { createObsSocket } from './socket';
import type {
  ObsClient,
  ObsClientOptions,
  ObsClientStatus,
  ObsConnectionConfig,
  ObsSocket,
} from './types';

const DISCONNECTED_MESSAGE =
  'OBS is not connected. Open Integrations, connect to OBS Studio, then try again.';

function emptyStatus(): ObsClientStatus {
  return {
    connected: false,
    sceneName: null,
    scenes: [],
    isStreaming: false,
    isRecording: false,
    mutedInputs: {},
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(payload: unknown, key: string): string | null {
  if (!isRecord(payload)) {
    return null;
  }
  const value = payload[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readBoolean(payload: unknown, key: string): boolean | null {
  if (!isRecord(payload)) {
    return null;
  }
  const value = payload[key];
  return typeof value === 'boolean' ? value : null;
}

function readNumber(payload: unknown, key: string): number | null {
  if (!isRecord(payload)) {
    return null;
  }
  const value = payload[key];
  return typeof value === 'number' ? value : null;
}

/** OBS returns scenes newest-first; only the names are relevant to ConDeck. */
function parseSceneNames(payload: unknown): string[] {
  if (!isRecord(payload) || !Array.isArray(payload.scenes)) {
    return [];
  }
  const names: string[] = [];
  for (const scene of payload.scenes) {
    const name = readString(scene, 'sceneName');
    if (name !== null && !names.includes(name)) {
      names.push(name);
    }
  }
  return names;
}

function seconds(timeoutMs: number): string {
  return String(Math.round(timeoutMs / 100) / 10);
}

function withTimeout<T>(task: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new AppError('ACTION_TIMEOUT', message));
    }, timeoutMs);
  });

  return Promise.race([task, timeout]).finally(() => {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  });
}

function toConnectionError(error: unknown, address: string): AppError {
  const code = readNumber(error, 'code');
  if (code === 4009) {
    return new AppError(
      'OBS_CONNECTION_FAILED',
      'OBS rejected the password. Check the password under OBS → Tools → WebSocket Server Settings.',
    );
  }
  const detail = error instanceof Error && error.message.length > 0 ? ` (${error.message})` : '';
  return new AppError(
    'OBS_CONNECTION_FAILED',
    `Could not connect to OBS at ${address}${detail}. Make sure OBS is running and its WebSocket server is enabled.`,
  );
}

function describeRequestError(error: unknown): string {
  const detail = error instanceof Error ? error.message.trim() : '';
  if (/not found|no source/i.test(detail)) {
    return 'OBS could not find that scene or audio input. Check the name in OBS and try again.';
  }
  return detail.length > 0 ? `OBS rejected the request: ${detail}` : 'OBS rejected the request.';
}

/**
 * Creates the OBS WebSocket v5 client used by the desktop main process.
 *
 * The client owns no Electron code and no database access: it only speaks to
 * the injected socket, which keeps it testable and lets the desktop decide how
 * a status change is broadcast to the renderer.
 */
export function createObsClient(options: ObsClientOptions = {}): ObsClient {
  const createSocket = options.createSocket ?? createObsSocket;
  const connectTimeoutMs = options.connectTimeoutMs ?? 8_000;
  const requestTimeoutMs = options.requestTimeoutMs ?? 10_000;

  let socket: ObsSocket | null = null;
  let status = emptyStatus();
  let generation = 0;
  const listeners = new Set<(status: ObsClientStatus) => void>();

  function emit(): void {
    const snapshot = copyStatus(status);
    for (const listener of listeners) {
      listener(snapshot);
    }
  }

  function copyStatus(current: ObsClientStatus): ObsClientStatus {
    return { ...current, scenes: [...current.scenes], mutedInputs: { ...current.mutedInputs } };
  }

  async function request<T>(requestType: string, data?: unknown): Promise<T> {
    const active = socket;
    if (active === null) {
      throw new AppError('OBS_DISCONNECTED', DISCONNECTED_MESSAGE);
    }

    try {
      const response = await withTimeout(
        active.call(requestType, data),
        requestTimeoutMs,
        `OBS did not answer ${requestType} within ${seconds(requestTimeoutMs)} seconds.`,
      );
      return response as T;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('OBS_REQUEST_FAILED', describeRequestError(error));
    }
  }

  async function refreshScenes(): Promise<string[]> {
    const response = await request<unknown>('GetSceneList');
    const scenes = parseSceneNames(response);
    status.scenes = scenes;
    return scenes;
  }

  async function refreshState(): Promise<void> {
    const [scenes, stream, record] = await Promise.all([
      request<unknown>('GetSceneList'),
      request<unknown>('GetStreamStatus'),
      request<unknown>('GetRecordStatus'),
    ]);

    status.scenes = parseSceneNames(scenes);
    status.sceneName = readString(scenes, 'currentProgramSceneName');
    status.isStreaming = readBoolean(stream, 'outputActive') === true;
    status.isRecording = readBoolean(record, 'outputActive') === true;
  }

  function handleLost(target: ObsSocket, attempt: number): void {
    if (attempt !== generation) {
      return;
    }
    socket = null;
    generation += 1;
    status = emptyStatus();
    emit();
    void target.disconnect().catch(() => undefined);
  }

  function attach(target: ObsSocket, attempt: number): void {
    const isCurrent = (): boolean => attempt === generation && socket === target;

    target.on('CurrentProgramSceneChanged', (payload) => {
      if (!isCurrent()) {
        return;
      }
      const sceneName = readString(payload, 'sceneName');
      if (sceneName !== null) {
        status.sceneName = sceneName;
        emit();
      }
    });

    target.on('SceneListChanged', () => {
      if (isCurrent()) {
        void refreshScenes().catch(() => undefined);
      }
    });

    target.on('StreamStateChanged', (payload) => {
      if (!isCurrent()) {
        return;
      }
      const active = readBoolean(payload, 'outputActive');
      if (active !== null) {
        status.isStreaming = active;
        emit();
      }
    });

    target.on('RecordStateChanged', (payload) => {
      if (!isCurrent()) {
        return;
      }
      const active = readBoolean(payload, 'outputActive');
      if (active !== null) {
        status.isRecording = active;
        emit();
      }
    });

    target.on('InputMuteStateChanged', (payload) => {
      if (!isCurrent()) {
        return;
      }
      const inputName = readString(payload, 'inputName');
      const muted = readBoolean(payload, 'inputMuted');
      if (inputName !== null && muted !== null) {
        status.mutedInputs = { ...status.mutedInputs, [inputName]: muted };
        emit();
      }
    });

    for (const event of ['ConnectionClosed', 'ConnectionError', 'ExitStarted'] as const) {
      target.on(event, () => {
        handleLost(target, attempt);
      });
    }
  }

  async function disconnect(): Promise<void> {
    const active = socket;
    socket = null;
    generation += 1;
    status = emptyStatus();

    if (active !== null) {
      try {
        await active.disconnect();
      } catch {
        // The socket may already be closed; nothing left to clean up.
      }
      active.removeAllListeners();
    }
    emit();
  }

  return {
    async connect(config: ObsConnectionConfig) {
      await disconnect();

      const target = createSocket();
      socket = target;
      const attempt = generation + 1;
      generation = attempt;
      attach(target, attempt);

      const address = `${config.host}:${config.port}`;
      try {
        await withTimeout(
          target.connect(`ws://${address}`, config.password ?? undefined),
          connectTimeoutMs,
          `OBS at ${address} did not answer within ${seconds(connectTimeoutMs)} seconds.`,
        );
      } catch (error) {
        socket = null;
        generation += 1;
        status = emptyStatus();
        target.removeAllListeners();
        void target.disconnect().catch(() => undefined);
        emit();
        throw toConnectionError(error, address);
      }

      try {
        await refreshState();
      } catch (error) {
        await disconnect();
        throw error instanceof AppError
          ? error
          : new AppError(
              'OBS_CONNECTION_FAILED',
              `Connected to OBS at ${address} but could not read its scenes. Check that OBS finished starting up.`,
            );
      }

      status.connected = true;
      emit();
    },

    disconnect,

    isConnected() {
      return socket !== null && status.connected;
    },

    snapshot() {
      return copyStatus(status);
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    async listScenes() {
      return refreshScenes();
    },

    async switchScene(sceneName: string) {
      await request('SetCurrentProgramScene', { sceneName });
      status.sceneName = sceneName;
      emit();
    },

    async startStreaming() {
      await request('StartStream');
      status.isStreaming = true;
      emit();
    },

    async stopStreaming() {
      await request('StopStream');
      status.isStreaming = false;
      emit();
    },

    async startRecording() {
      await request('StartRecord');
      status.isRecording = true;
      emit();
    },

    async stopRecording() {
      await request('StopRecord');
      status.isRecording = false;
      emit();
    },

    async getInputMute(inputName: string) {
      const response = await request<unknown>('GetInputMute', { inputName });
      return readBoolean(response, 'inputMuted') === true;
    },

    async setInputMute(inputName: string, muted: boolean) {
      await request('SetInputMute', { inputName, inputMuted: muted });
      status.mutedInputs = { ...status.mutedInputs, [inputName]: muted };
      emit();
    },
  };
}
