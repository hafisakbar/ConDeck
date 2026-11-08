import {
  createClientMessage,
  parseServerMessage,
  remoteDefaults,
  serializeMessage,
  type ClientMessage,
  type ObsStatusPayload,
  type RemoteDeckSnapshot,
} from '@condeck/websocket-protocol';
import { buildWebSocketUrl } from './pairing-link';
import type { StoredDevice } from './storage';

export type RemoteConnectionState = 'idle' | 'connecting' | 'reconnecting' | 'connected' | 'error';

/** Minimal WebSocket surface, so tests can drive the protocol without a browser. */
export interface SocketLike {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: { code?: number; reason?: string }) => void) | null;
  onerror: (() => void) | null;
}

export interface ActionFeedback {
  buttonId: string;
  status: 'started' | 'success' | 'failed';
  message: string;
  code: string | null;
}

export interface ConnectInput {
  host: string;
  port: number;
  pairToken?: string | null;
  device?: StoredDevice | null;
  deviceName?: string;
}

export interface RemoteClientOptions {
  createSocket?: (url: string) => SocketLike;
  now?: () => number;
  reconnectDelaysMs?: readonly number[];
  connectTimeoutMs?: number;
  heartbeatIntervalMs?: number;
  livenessTimeoutMs?: number;
  onPaired?: (device: StoredDevice) => void;
  /** Called when the desktop no longer accepts this device's stored credential. */
  onDeviceRejected?: () => void;
}

export interface RemoteClient {
  connect(input: ConnectInput): void;
  disconnect(): void;
  press(buttonId: string): boolean;
  changePage(pageId: string): void;
  requestDeck(): void;
  clearFeedback(): void;
  getState(): RemoteConnectionState;
  getError(): string | null;
  getSnapshot(): RemoteDeckSnapshot | null;
  getObs(): ObsStatusPayload | null;
  getFeedback(): ActionFeedback | null;
  getDevice(): StoredDevice | null;
  subscribe(listener: () => void): () => void;
}

const OPEN = 1;
const DEFAULT_RECONNECT_DELAYS = [1_000, 2_000, 5_000, 10_000, 15_000] as const;

function defaultCreateSocket(url: string): SocketLike {
  return new WebSocket(url) as unknown as SocketLike;
}

/**
 * Protocol client for ConDeck Remote.
 *
 * It owns no React state and no DOM: the hook subscribes and re-renders, tests
 * inject a fake socket. Reconnection uses fresh credentials on every attempt,
 * which is what the contract requires ("autentikasi pada setiap koneksi baru").
 */
export function createRemoteClient(options: RemoteClientOptions = {}): RemoteClient {
  const createSocket = options.createSocket ?? defaultCreateSocket;
  const now = options.now ?? Date.now;
  const reconnectDelays = options.reconnectDelaysMs ?? DEFAULT_RECONNECT_DELAYS;
  const connectTimeoutMs = options.connectTimeoutMs ?? 10_000;
  const heartbeatIntervalMs = options.heartbeatIntervalMs ?? remoteDefaults.heartbeatIntervalMs;
  const livenessTimeoutMs = options.livenessTimeoutMs ?? remoteDefaults.heartbeatTimeoutMs;

  const listeners = new Set<() => void>();

  let socket: SocketLike | null = null;
  let state: RemoteConnectionState = 'idle';
  let error: string | null = null;
  let snapshot: RemoteDeckSnapshot | null = null;
  let obs: ObsStatusPayload | null = null;
  let feedback: ActionFeedback | null = null;

  let host = '';
  let port = 0;
  let pairToken: string | null = null;
  let device: StoredDevice | null = null;
  let deviceName = 'My phone';

  let manualClose = false;
  let attempt = 0;
  let lastSeenAt = 0;

  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let connectTimer: ReturnType<typeof setTimeout> | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  function notify(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  function send(message: ClientMessage): void {
    if (socket !== null && socket.readyState === OPEN) {
      socket.send(serializeMessage(message));
    }
  }

  function clearTimers(): void {
    if (connectTimer !== null) {
      clearTimeout(connectTimer);
      connectTimer = null;
    }
    if (heartbeatTimer !== null) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  function clearReconnect(): void {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function closeQuietly(target: SocketLike | null): void {
    if (target === null) {
      return;
    }
    target.onopen = null;
    target.onmessage = null;
    target.onclose = null;
    target.onerror = null;
    try {
      target.close(1000, 'client closed');
    } catch {
      // Already closed.
    }
  }

  function fatal(message: string, rejectedDevice = false): void {
    manualClose = true;
    state = 'error';
    error = message;
    clearReconnect();
    clearTimers();
    closeQuietly(socket);
    socket = null;
    if (rejectedDevice) {
      options.onDeviceRejected?.();
    }
    notify();
  }

  function scheduleReconnect(): void {
    if (manualClose || device === null) {
      return;
    }

    const delay = reconnectDelays[Math.min(attempt, reconnectDelays.length - 1)] ?? 1_000;
    attempt += 1;
    state = 'reconnecting';
    notify();

    clearReconnect();
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (!manualClose) {
        openSocket();
      }
    }, delay);
  }

  function handleClose(message?: string): void {
    clearTimers();
    const closed = socket;
    socket = null;
    closeQuietly(closed);

    if (manualClose) {
      notify();
      return;
    }

    error = null;
    if (device !== null) {
      scheduleReconnect();
      return;
    }

    state = 'error';
    error = message ?? 'The connection to the desktop was lost.';
    notify();
  }

  function startHeartbeat(): void {
    if (heartbeatTimer !== null) {
      clearInterval(heartbeatTimer);
    }

    lastSeenAt = now();
    heartbeatTimer = setInterval(() => {
      if (state !== 'connected') {
        return;
      }

      if (now() - lastSeenAt > livenessTimeoutMs) {
        handleClose('The desktop stopped responding. Reconnecting…');
        return;
      }

      send(createClientMessage('ping', {}));
    }, heartbeatIntervalMs);
  }

  function beginHandshake(): void {
    if (pairToken !== null) {
      send(
        createClientMessage('auth.pair', {
          pairingToken: pairToken,
          deviceName: deviceName.trim().length > 0 ? deviceName.trim() : 'My phone',
          deviceType: 'mobile',
        }),
      );
      return;
    }

    if (device !== null) {
      send(
        createClientMessage('auth.resume', {
          deviceId: device.deviceId,
          deviceCredential: device.deviceCredential,
        }),
      );
      return;
    }

    fatal('This phone is not paired yet. Create a pairing code in ConDeck Desktop → Devices.');
  }

  function handleFrame(raw: unknown): void {
    if (typeof raw !== 'string') {
      return;
    }

    const message = parseServerMessage(raw);
    if (message === null) {
      return;
    }

    lastSeenAt = now();

    switch (message.type) {
      case 'auth.pair.result': {
        const stored: StoredDevice = {
          host,
          port,
          deviceId: message.payload.deviceId,
          deviceCredential: message.payload.deviceCredential,
          deviceName,
        };
        device = stored;
        pairToken = null;
        state = 'connected';
        error = null;
        attempt = 0;
        options.onPaired?.(stored);
        send(createClientMessage('deck.get', {}));
        notify();
        return;
      }

      case 'auth.result': {
        state = 'connected';
        error = null;
        attempt = 0;
        send(createClientMessage('deck.get', {}));
        notify();
        return;
      }

      case 'deck.snapshot': {
        snapshot = message.payload;
        notify();
        return;
      }

      case 'deck.updated': {
        send(createClientMessage('deck.get', {}));
        return;
      }

      case 'obs.status': {
        obs = message.payload;
        notify();
        return;
      }

      case 'action.started': {
        feedback = {
          buttonId: message.payload.buttonId,
          status: 'started',
          message: 'Running…',
          code: null,
        };
        notify();
        return;
      }

      case 'action.completed': {
        feedback = {
          buttonId: message.payload.buttonId,
          status: 'success',
          message: message.payload.message,
          code: null,
        };
        notify();
        return;
      }

      case 'action.failed': {
        feedback = {
          buttonId: message.payload.buttonId,
          status: 'failed',
          message: message.payload.message,
          code: message.payload.errorCode,
        };
        notify();
        return;
      }

      case 'page.changed': {
        return;
      }

      case 'pong': {
        return;
      }

      case 'error': {
        const code = message.payload.code;

        if (code === 'DEVICE_REVOKED') {
          fatal('Access for this phone was revoked on the desktop. Pair it again.', true);
          return;
        }
        if (code === 'INVALID_TOKEN' && pairToken === null) {
          fatal('This phone is no longer recognised by the desktop. Pair it again.', true);
          return;
        }
        if (code === 'TOKEN_EXPIRED' || code === 'RATE_LIMITED' || code === 'INVALID_TOKEN') {
          fatal(message.payload.message);
          return;
        }
        if (code === 'UNAUTHORIZED') {
          fatal('Pair this phone before sending commands.');
          return;
        }

        feedback = {
          buttonId: '',
          status: 'failed',
          message: message.payload.message,
          code,
        };
        notify();
        return;
      }

      default:
        return;
    }
  }

  function openSocket(): void {
    manualClose = false;
    clearReconnect();
    closeQuietly(socket);
    socket = null;

    state = attempt === 0 ? 'connecting' : 'reconnecting';
    error = null;
    notify();

    let next: SocketLike;
    try {
      next = createSocket(buildWebSocketUrl(host, port));
    } catch {
      state = 'error';
      error = 'ConDeck Remote could not open a connection to that address.';
      notify();
      return;
    }

    socket = next;
    const current = next;

    current.onopen = () => {
      if (socket !== current) {
        return;
      }
      if (connectTimer !== null) {
        clearTimeout(connectTimer);
        connectTimer = null;
      }
      beginHandshake();
      startHeartbeat();
    };
    current.onmessage = (event) => {
      if (socket !== current) {
        return;
      }
      handleFrame(event.data);
    };
    current.onclose = () => {
      if (socket !== current) {
        return;
      }
      handleClose();
    };
    current.onerror = () => {
      // A close event always follows; reconnect logic lives there.
    };

    connectTimer = setTimeout(() => {
      if (socket === current && state === 'connecting') {
        handleClose('The desktop did not answer. Check that ConDeck is running and on the same network.');
      }
    }, connectTimeoutMs);
  }

  return {
    connect(input) {
      attempt = 0;
      pairToken = input.pairToken ?? null;
      if (input.device !== undefined) {
        device = input.device;
      }
      deviceName = input.deviceName ?? device?.deviceName ?? 'My phone';
      host = input.host.trim();
      port = input.port;
      snapshot = null;
      obs = null;
      feedback = null;

      if (host.length === 0) {
        fatal('Enter the desktop address, for example 192.168.1.20.');
        return;
      }

      openSocket();
    },

    disconnect() {
      manualClose = true;
      clearReconnect();
      clearTimers();
      closeQuietly(socket);
      socket = null;
      state = 'idle';
      error = null;
      feedback = null;
      notify();
    },

    press(buttonId) {
      if (state !== 'connected') {
        return false;
      }
      send(createClientMessage('button.press', { buttonId }));
      return true;
    },

    changePage(pageId) {
      if (state === 'connected') {
        send(createClientMessage('page.change', { pageId }));
      }
    },

    requestDeck() {
      if (state === 'connected') {
        send(createClientMessage('deck.get', {}));
      }
    },

    clearFeedback() {
      feedback = null;
      notify();
    },

    getState: () => state,
    getError: () => error,
    getSnapshot: () => snapshot,
    getObs: () => obs,
    getFeedback: () => feedback,
    getDevice: () => device,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
