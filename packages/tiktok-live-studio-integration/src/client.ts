import {
  AppError,
  emptyTikTokSnapshot,
  tiktokActionIds,
  tiktokDefaults,
  type TikTokScene,
  type TikTokSnapshot,
  type TikTokState,
  type TikTokTestResult,
} from '@condeck/shared';
import { candidatePorts, discoverLiveStudio, type StudioRuntime } from './discovery';
import { checkVersion, type VersionCompatibility } from './protocol';
import {
  createLiveStudioSocket,
  type LiveStudioSocket,
  type LiveStudioSocketFactory,
} from './socket';

export interface TikTokClientStatus extends TikTokSnapshot {
  compatibility: VersionCompatibility | null;
}

export interface TikTokClientOptions {
  discover?: () => Promise<StudioRuntime>;
  createSocket?: LiveStudioSocketFactory;
  requestTimeoutMs?: number;
  connectTimeoutMs?: number;
  rediscoveryDelayMs?: number;
  /** Set to false in tests so a dropped socket does not retry forever. */
  autoReconnect?: boolean;
}

export interface TikTokClient {
  getStatus(): TikTokClientStatus;
  getState(): TikTokState | null;
  connect(): Promise<TikTokClientStatus>;
  disconnect(): Promise<TikTokClientStatus>;
  refresh(): Promise<TikTokState | null>;
  test(): Promise<TikTokTestResult>;
  switchScene(sceneName: string): Promise<TikTokState>;
  setSourceVisible(sceneName: string, sourceId: string, visible: boolean): Promise<TikTokState>;
  setMicMuted(muted: boolean): Promise<TikTokState>;
  setAudioMuted(muted: boolean): Promise<TikTokState>;
  setRecording(recording: boolean): Promise<TikTokState>;
  onChange(listener: (status: TikTokClientStatus) => void): () => void;
  dispose(): Promise<void>;
}

interface ConnectionState {
  state: TikTokClientStatus['state'];
  message: string | null;
  found: boolean;
  version: string | null;
  port: number | null;
  runtime: StudioRuntime | null;
  compatibility: VersionCompatibility | null;
  live: TikTokState | null;
  data: TikTokState;
}

function emptyLiveState(): TikTokState {
  return {
    sceneName: null,
    scenes: [],
    micMuted: false,
    audioMuted: false,
    recording: false,
    streamStatus: 0,
  };
}

function sceneOf(state: TikTokState, name: string): TikTokScene {
  const scene = state.scenes.find((entry) => entry.name === name);
  if (!scene) {
    throw new AppError(
      'ACTION_FAILED',
      `Scene “${name}” is not present in TikTok LIVE Studio right now.`,
    );
  }
  return scene;
}

/**
 * Owns the single TikTok LIVE Studio connection.
 *
 * Only verified local Socket.IO calls are used. A dropped socket marks the
 * integration as reconnecting and rediscovers the process, because LIVE Studio
 * may come back on a different port after a restart.
 */
export function createTikTokClient(options: TikTokClientOptions = {}): TikTokClient {
  const discover = options.discover ?? (() => discoverLiveStudio());
  const createSocket = options.createSocket ?? createLiveStudioSocket;
  const rediscoveryDelayMs = options.rediscoveryDelayMs ?? tiktokDefaults.rediscoveryDelayMs;
  const autoReconnect = options.autoReconnect ?? true;

  const listeners = new Set<(status: TikTokClientStatus) => void>();
  let socket: LiveStudioSocket | null = null;
  let connecting: Promise<TikTokClientStatus> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let manualClose = false;
  let disposed = false;

  const state: ConnectionState = {
    state: 'DISCONNECTED',
    message: null,
    found: false,
    version: null,
    port: null,
    runtime: null,
    compatibility: null,
    live: null,
    data: emptyLiveState(),
  };

  function status(): TikTokClientStatus {
    const base = emptyTikTokSnapshot(true);
    return {
      ...base,
      state: state.state,
      message: state.message,
      found: state.found,
      version: state.version,
      port: state.port,
      sceneName: state.data.sceneName,
      scenes: state.data.scenes,
      micMuted: state.data.micMuted,
      audioMuted: state.data.audioMuted,
      recording: state.data.recording,
      streamStatus: state.data.streamStatus,
      compatibility: state.compatibility,
    };
  }

  function emit(): void {
    const snapshot = status();
    for (const listener of listeners) {
      listener(snapshot);
    }
  }

  function setState(next: Partial<ConnectionState>): void {
    Object.assign(state, next);
    emit();
  }

  function applyState(live: TikTokState): TikTokState {
    state.live = live;
    state.data = live;
    return live;
  }

  function clearReconnectTimer(): void {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function scheduleReconnect(): void {
    if (!autoReconnect || manualClose || disposed || reconnectTimer !== null) {
      return;
    }
    state.state = 'RECONNECTING';
    state.message = 'The TikTok LIVE Studio connection dropped. Looking for the app again…';
    emit();

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (manualClose || disposed) {
        return;
      }
      void connect().catch(() => {
        scheduleReconnect();
      });
    }, rediscoveryDelayMs);
    reconnectTimer.unref?.();
  }

  async function openEndpoint(port: number): Promise<{ socket: LiveStudioSocket; live: TikTokState }> {
    const candidate = createSocket({
      port,
      connectTimeoutMs: options.connectTimeoutMs,
      requestTimeoutMs: options.requestTimeoutMs,
    });
    try {
      await candidate.connect();
      const live = await candidate.sync();
      if (!candidate.isConnected()) {
        throw new Error('The connection closed during the state sync.');
      }
      return { socket: candidate, live };
    } catch (error) {
      candidate.close();
      throw error;
    }
  }

  async function connectOnce(): Promise<TikTokClientStatus> {
    clearReconnectTimer();
    manualClose = false;
    setState({ state: 'CONNECTING', message: null, found: false });

    const runtime = await discover();
    state.runtime = runtime;
    setState({
      found: runtime.running,
      version: runtime.appVersion,
      compatibility: checkVersion(runtime.appVersion),
      message: runtime.error,
    });

    if (!runtime.running) {
      setState({
        state: 'DISCONNECTED',
        message:
          runtime.error ??
          'TikTok LIVE Studio is not running. Open TikTok LIVE Studio, then connect again.',
      });
      return status();
    }

    const compatibility = state.compatibility;
    if (compatibility && !compatibility.supported) {
      setState({ state: 'UNSUPPORTED_VERSION', message: compatibility.message });
      return status();
    }

    const ports = candidatePorts(runtime);
    let lastError: string | null = null;

    for (const port of ports) {
      try {
        const opened = await openEndpoint(port);
        if (socket) {
          socket.close();
        }
        socket = opened.socket;
        socket.onDisconnect((reason) => {
          socket = null;
          state.live = null;
          if (reason === 'io client disconnect' || manualClose) {
            return;
          }
          scheduleReconnect();
        });

        applyState(opened.live);
        setState({
          state: 'CONNECTED',
          message: compatibility?.level === 'untested' ? compatibility.message : null,
          found: true,
          port,
        });
        return status();
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    setState({
      state: 'ERROR',
      message:
        lastError ??
        'TikTok LIVE Studio is running, but no verified local Socket.IO port answered.',
    });
    return status();
  }

  async function connect(): Promise<TikTokClientStatus> {
    if (socket?.isConnected()) {
      return status();
    }
    if (connecting) {
      return connecting;
    }
    connecting = connectOnce();
    try {
      return await connecting;
    } finally {
      connecting = null;
    }
  }

  function requireLiveState(): TikTokState {
    if (!socket?.isConnected()) {
      throw new AppError(
        'TIKTOK_DISCONNECTED',
        'TikTok LIVE Studio is not connected. Open Integrations and connect first.',
      );
    }
    const live = state.live;
    if (!live) {
      throw new AppError('TIKTOK_DISCONNECTED', 'TikTok LIVE Studio has not reported its state yet.');
    }
    return live;
  }

  async function refresh(): Promise<TikTokState | null> {
    if (!socket?.isConnected()) {
      return null;
    }
    const live = await socket.sync();
    applyState(live);
    setState({ state: 'CONNECTED', message: null });
    return live;
  }

  async function perform(actionId: string, settings: Record<string, unknown>): Promise<TikTokState> {
    requireLiveState();
    const active = socket;
    if (!active) {
      throw new AppError('TIKTOK_DISCONNECTED', 'TikTok LIVE Studio is not connected.');
    }
    await active.action(actionId, settings);
    const live = await refresh();
    if (!live) {
      throw new AppError(
        'TIKTOK_DISCONNECTED',
        'TikTok LIVE Studio disconnected before it reported the new state.',
      );
    }
    return live;
  }

  return {
    getStatus: () => status(),
    getState: () => state.live,

    connect,

    async disconnect() {
      manualClose = true;
      clearReconnectTimer();
      socket?.close();
      socket = null;
      state.live = null;
      state.data = emptyLiveState();
      setState({
        state: 'DISCONNECTED',
        message: null,
        port: null,
        found: state.found,
      });
      return status();
    },

    refresh,

    async test() {
      const runtime = await discover();
      if (!runtime.running) {
        return {
          ok: false,
          message:
            runtime.error ??
            'TikTok LIVE Studio is not detected. Open TikTok LIVE Studio and wait for its main window.',
          version: runtime.appVersion,
          sceneName: null,
          scenes: [],
        };
      }

      const compatibility = checkVersion(runtime.appVersion);
      if (!compatibility.supported) {
        return {
          ok: false,
          message: compatibility.message,
          version: runtime.appVersion,
          sceneName: null,
          scenes: [],
        };
      }

      let lastError: string | null = null;
      for (const port of candidatePorts(runtime)) {
        let probe: LiveStudioSocket | null = null;
        try {
          const opened = await openEndpoint(port);
          probe = opened.socket;
          return {
            ok: true,
            message:
              `Connected to TikTok LIVE Studio${runtime.appVersion ? ` ${runtime.appVersion}` : ''} on port ${port}.` +
              (compatibility.level === 'untested' ? ` ${compatibility.message}` : ''),
            version: runtime.appVersion,
            sceneName: opened.live.sceneName,
            scenes: opened.live.scenes.map((scene) => scene.name),
          };
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
        } finally {
          probe?.close();
        }
      }

      return {
        ok: false,
        message: lastError ?? 'LIVE Studio is running, but StreamKey could not open its local session.',
        version: runtime.appVersion,
        sceneName: null,
        scenes: [],
      };
    },

    async switchScene(sceneName) {
      const live = await perform(tiktokActionIds.scene, { scene: sceneName });
      if (live.sceneName !== sceneName) {
        throw new AppError(
          'ACTION_FAILED',
          `LIVE Studio accepted the scene change, but the active scene is still “${live.sceneName ?? 'unknown'}”.`,
        );
      }
      return live;
    },

    async setSourceVisible(sceneName, sourceId, visible) {
      const current = requireLiveState();
      const scene = sceneOf(current, sceneName);
      const known =
        scene.sources.some((source) => source.value === sourceId) ||
        scene.visibleSources.some((source) => source.value === sourceId);
      if (!known) {
        throw new AppError(
          'ACTION_FAILED',
          `Source “${sourceId}” is not present in scene “${sceneName}” right now.`,
        );
      }
      const isVisible = scene.visibleSources.some((source) => source.value === sourceId);
      if (isVisible === visible) {
        return current;
      }

      const live = await perform(tiktokActionIds.source, { scene: sceneName, source: sourceId });
      const after = sceneOf(live, sceneName).visibleSources.some(
        (source) => source.value === sourceId,
      );
      if (after !== visible) {
        throw new AppError(
          'ACTION_FAILED',
          `LIVE Studio accepted the source change, but “${sourceId}” is still ${after ? 'visible' : 'hidden'}.`,
        );
      }
      return live;
    },

    async setMicMuted(muted) {
      const current = requireLiveState();
      if (current.micMuted === muted) {
        return current;
      }
      const live = await perform(tiktokActionIds.mic, {});
      if (live.micMuted !== muted) {
        throw new AppError(
          'ACTION_FAILED',
          `LIVE Studio accepted the microphone command, but the microphone is still ${live.micMuted ? 'muted' : 'live'}.`,
        );
      }
      return live;
    },

    async setAudioMuted(muted) {
      const current = requireLiveState();
      if (current.audioMuted === muted) {
        return current;
      }
      const live = await perform(tiktokActionIds.audio, {});
      if (live.audioMuted !== muted) {
        throw new AppError(
          'ACTION_FAILED',
          `LIVE Studio accepted the audio command, but the audio is still ${live.audioMuted ? 'muted' : 'on'}.`,
        );
      }
      return live;
    },

    async setRecording(recording) {
      const current = requireLiveState();
      if (current.recording === recording) {
        return current;
      }
      const live = await perform(tiktokActionIds.recording, {});
      if (live.recording !== recording) {
        throw new AppError(
          'ACTION_FAILED',
          `LIVE Studio accepted the recording command, but recording is still ${live.recording ? 'on' : 'off'}.`,
        );
      }
      return live;
    },

    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    async dispose() {
      disposed = true;
      manualClose = true;
      clearReconnectTimer();
      socket?.close();
      socket = null;
      listeners.clear();
    },
  };
}
