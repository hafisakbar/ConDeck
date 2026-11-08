import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { networkInterfaces } from 'node:os';
import {
  createDevice,
  endDeviceSession,
  getDeviceCredential,
  startDeviceSession,
  touchDevice,
  type ConDeckDb,
} from '@condeck/database';
import {
  AppError,
  isAppError,
  remoteDefaultPort,
  type ActionExecutionResult,
  type DeckDetail,
  type ObsSnapshot,
  type RemotePairing,
  type RemoteServerStatus,
} from '@condeck/shared';
import {
  createServerMessage,
  parseClientMessage,
  remoteCloseCodes,
  remoteDefaults,
  remoteProtocolVersion,
  serializeMessage,
  type ClientMessage,
  type RemoteDeckSnapshot,
  type RemoteErrorCode,
  type ServerMessage,
} from '@condeck/websocket-protocol';
import { WebSocketServer, WebSocket } from 'ws';
import { createDeviceCredential, verifyCredential } from './remote/credentials';
import { createPairingManager } from './remote/pairing';
import { toObsStatusPayload, toRemoteDeckSnapshot } from './remote/snapshot';
import {
  applyMobileHeaders,
  sendMobileNotBuiltPage,
  serveMobileFile,
} from './remote/static-assets';

export interface RemoteServerLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export interface RemoteActivityEvent {
  eventType: string;
  description: string;
  deviceId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface RemoteServerOptions {
  db: ConDeckDb;
  /** Runs the same Action Engine the desktop uses; never a remote-supplied config. */
  executeAction: (buttonId: string) => Promise<ActionExecutionResult>;
  /** Deck shown on the remote: the active profile's deck, or null when none exists. */
  getActiveDeck: () => DeckDetail | null;
  getObsSnapshot: () => ObsSnapshot | null;
  logger?: RemoteServerLogger;
  /** Directory holding the built mobile app; null keeps only the API online. */
  mobileAssetsDir?: string | null;
  port?: number;
  host?: string;
  pairingTtlMs?: number;
  pairingMaxAttempts?: number;
  heartbeatIntervalMs?: number;
  now?: () => number;
  onStatusChange?: (status: RemoteServerStatus) => void;
  onActivity?: (event: RemoteActivityEvent) => void;
}

export interface RemoteServer {
  start(): Promise<RemoteServerStatus>;
  stop(): Promise<void>;
  getStatus(): RemoteServerStatus;
  /** Issues a pairing code and its QR image; requires a running server. */
  createPairing(): Promise<RemotePairing>;
  clearPairing(): void;
  /** Drops live sockets of a device that has just been revoked. */
  disconnectDevice(deviceId: string): void;
  /** Tells remotes that the deck changed so they request a fresh snapshot. */
  notifyDeckChanged(): void;
  /** Pushes the current OBS state to every authorised remote. */
  broadcastObsStatus(): void;
}

interface ClientState {
  id: string;
  socket: WebSocket;
  deviceId: string | null;
  deviceName: string | null;
  connectedAt: string | null;
  sessionId: string | null;
  currentPageId: string | null;
  alive: boolean;
  queue: Promise<void>;
  windowStart: number;
  windowCount: number;
  authTimer: ReturnType<typeof setTimeout> | null;
}

function logSafely(logger: RemoteServerLogger | undefined, message: string, meta: Record<string, unknown>): void {
  logger?.info(message, meta);
}

/** Non-internal IPv4 addresses, so the QR code points at something a phone can reach. */
export function listLanAddresses(port: number): string[] {
  const urls: string[] = [];
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4' && !address.internal) {
        urls.push(`http://${address.address}:${port}`);
      }
    }
  }
  return urls;
}

export function createRemoteServer(options: RemoteServerOptions): RemoteServer {
  const { db, logger } = options;
  const now = options.now ?? Date.now;
  const heartbeatIntervalMs = options.heartbeatIntervalMs ?? remoteDefaults.heartbeatIntervalMs;

  const pairing = createPairingManager({
    ttlMs: options.pairingTtlMs ?? remoteDefaults.pairingTokenTtlMs,
    maxAttempts: options.pairingMaxAttempts ?? remoteDefaults.pairingMaxAttempts,
    now,
  });

  const clients = new Set<ClientState>();
  let httpServer: Server | null = null;
  let socketServer: WebSocketServer | null = null;
  let maintenance: ReturnType<typeof setInterval> | null = null;

  let state: RemoteServerStatus['state'] = 'stopped';
  let lastError: string | null = null;
  let boundPort = options.port ?? remoteDefaultPort;
  let activePairing: RemotePairing | null = null;

  function getStatus(): RemoteServerStatus {
    return {
      state,
      isEnabled: true,
      port: boundPort,
      addresses: state === 'running' ? listLanAddresses(boundPort) : [],
      error: lastError,
      pairing: activePairing,
      connectedDevices: [...clients]
        .filter((client) => client.deviceId !== null)
        .map((client) => ({
          deviceId: client.deviceId as string,
          deviceName: client.deviceName ?? 'Unknown device',
          connectedAt: client.connectedAt ?? new Date(now()).toISOString(),
        })),
    };
  }

  function emitStatus(): void {
    options.onStatusChange?.(getStatus());
  }

  function record(event: RemoteActivityEvent): void {
    options.onActivity?.(event);
  }

  function send(client: ClientState, message: ServerMessage): void {
    if (client.socket.readyState === WebSocket.OPEN) {
      client.socket.send(serializeMessage(message));
    }
  }

  function sendError(
    client: ClientState,
    code: RemoteErrorCode,
    message: string,
    requestId: string | null,
  ): void {
    send(
      client,
      createServerMessage('error', {
        code,
        message,
        requestId,
      }),
    );
  }

  function closeClient(client: ClientState, code: number, reason: string): void {
    try {
      client.socket.close(code, reason.slice(0, 120));
    } catch {
      client.socket.terminate();
    }
  }

  function currentSnapshot(): RemoteDeckSnapshot | null {
    try {
      const detail = options.getActiveDeck();
      return detail ? toRemoteDeckSnapshot(detail) : null;
    } catch (error) {
      logger?.warn('Active deck could not be read for the remote', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  function sendDeck(client: ClientState): void {
    send(client, createServerMessage('deck.snapshot', currentSnapshot()));
  }

  function sendObsStatus(client: ClientState): void {
    send(client, createServerMessage('obs.status', toObsStatusPayload(options.getObsSnapshot())));
  }

  function sendObsStatusToAll(): void {
    for (const client of clients) {
      if (client.deviceId !== null) {
        sendObsStatus(client);
      }
    }
  }

  function authenticate(client: ClientState, deviceId: string, deviceName: string): void {
    if (client.authTimer !== null) {
      clearTimeout(client.authTimer);
      client.authTimer = null;
    }
    client.deviceId = deviceId;
    client.deviceName = deviceName;
    client.connectedAt = new Date(now()).toISOString();
    client.sessionId = startDeviceSession(db, deviceId, client.connectedAt);

    sendDeck(client);
    sendObsStatus(client);
    emitStatus();
  }

  async function handlePair(client: ClientState, message: Extract<ClientMessage, { type: 'auth.pair' }>): Promise<void> {
    const result = pairing.consume(message.payload.pairingToken);

    if (!result.ok) {
      sendError(
        client,
        result.code,
        result.code === 'TOKEN_EXPIRED'
          ? 'This pairing code expired. Create a new one in ConDeck Desktop → Devices.'
          : result.code === 'RATE_LIMITED'
            ? 'Too many pairing attempts. Create a new code in ConDeck Desktop → Devices.'
            : 'This pairing code is not valid. Create a new one in ConDeck Desktop → Devices.',
        message.requestId,
      );

      if (result.code === 'RATE_LIMITED') {
        closeClient(client, remoteCloseCodes.rateLimited, 'Pairing attempts exceeded');
      }
      return;
    }

    activePairing = null;

    const { credential, hash } = createDeviceCredential();
    const device = createDevice(db, {
      deviceName: message.payload.deviceName,
      deviceType: message.payload.deviceType,
      credentialHash: hash,
    });

    send(
      client,
      createServerMessage(
        'auth.pair.result',
        { success: true, deviceId: device.id, deviceCredential: credential },
        message.requestId,
      ),
    );

    authenticate(client, device.id, device.deviceName);
    logSafely(logger, 'Remote device paired', { deviceId: device.id, deviceType: device.deviceType });
    record({
      eventType: 'DEVICE_PAIRED',
      description: `Device "${device.deviceName}" paired with ConDeck`,
      deviceId: device.id,
      metadata: { deviceType: device.deviceType },
    });
  }

  function handleResume(
    client: ClientState,
    message: Extract<ClientMessage, { type: 'auth.resume' }>,
  ): void {
    const record_ = getDeviceCredential(db, message.payload.deviceId);

    if (record_ === null || !verifyCredential(message.payload.deviceCredential, record_.credentialHash)) {
      sendError(client, 'INVALID_TOKEN', 'This device is not recognised. Pair it again from ConDeck Desktop.', message.requestId);
      closeClient(client, remoteCloseCodes.unauthorized, 'Invalid device credential');
      return;
    }

    if (!record_.isAuthorized) {
      sendError(client, 'DEVICE_REVOKED', 'Access for this device was revoked in ConDeck Desktop.', message.requestId);
      closeClient(client, remoteCloseCodes.unauthorized, 'Device revoked');
      return;
    }

    touchDevice(db, record_.id, new Date(now()).toISOString());
    send(
      client,
      createServerMessage('auth.result', { success: true, deviceId: record_.id }, message.requestId),
    );

    authenticate(client, record_.id, record_.deviceName);
    logSafely(logger, 'Remote device reconnected', { deviceId: record_.id });
    record({
      eventType: 'DEVICE_CONNECTED',
      description: `Device "${record_.deviceName}" connected to ConDeck`,
      deviceId: record_.id,
    });
  }

  function handlePageChange(
    client: ClientState,
    message: Extract<ClientMessage, { type: 'page.change' }>,
  ): void {
    const snapshot = currentSnapshot();
    const index = snapshot?.pages.findIndex((page) => page.id === message.payload.pageId) ?? -1;

    if (index < 0) {
      sendError(client, 'INVALID_REQUEST', 'That page is not part of the active deck.', message.requestId);
      return;
    }

    client.currentPageId = message.payload.pageId;
    send(
      client,
      createServerMessage(
        'page.changed',
        { pageId: message.payload.pageId, pageIndex: index },
        message.requestId,
      ),
    );
  }

  async function handleButtonPress(
    client: ClientState,
    message: Extract<ClientMessage, { type: 'button.press' }>,
  ): Promise<void> {
    const detail = options.getActiveDeck();
    const button =
      detail?.pages.flatMap((page) => page.buttons).find((entry) => entry.id === message.payload.buttonId) ??
      null;

    if (button === null) {
      sendError(
        client,
        'BUTTON_NOT_FOUND',
        'This button is no longer part of the active deck. Reload the deck on the remote.',
        message.requestId,
      );
      return;
    }

    if (!button.isEnabled) {
      send(
        client,
        createServerMessage('action.failed', {
          buttonId: button.id,
          success: false,
          errorCode: 'ACTION_FAILED',
          message: `Button "${button.label}" is disabled on the desktop.`,
        }),
      );
      return;
    }

    if (button.action === null) {
      send(
        client,
        createServerMessage('action.failed', {
          buttonId: button.id,
          success: false,
          errorCode: 'ACTION_FAILED',
          message: `Button "${button.label}" has no action configured yet.`,
        }),
      );
      return;
    }

    send(client, createServerMessage('action.started', { buttonId: button.id }));

    try {
      const result = await options.executeAction(button.id);
      if (result.status === 'SUCCESS') {
        send(
          client,
          createServerMessage('action.completed', {
            buttonId: button.id,
            success: true,
            message: result.message,
          }),
        );
        record({
          eventType: 'REMOTE_ACTION_EXECUTED',
          description: `Remote device ran "${result.actionType}" via button "${button.label}"`,
          deviceId: client.deviceId,
          metadata: {
            buttonId: button.id,
            actionType: result.actionType,
            durationMs: result.durationMs,
          },
        });
        return;
      }

      send(
        client,
        createServerMessage('action.failed', {
          buttonId: button.id,
          success: false,
          errorCode: result.code ?? 'ACTION_FAILED',
          message: result.message,
        }),
      );
      record({
        eventType: 'REMOTE_ACTION_FAILED',
        description: `Remote action on button "${button.label}" failed: ${result.message}`,
        deviceId: client.deviceId,
        metadata: { buttonId: button.id, code: result.code, actionType: result.actionType },
      });
    } catch (error) {
      const code = isAppError(error) ? error.code : 'ACTION_FAILED';
      const text = error instanceof Error ? error.message : 'The action failed.';

      send(
        client,
        createServerMessage('action.failed', {
          buttonId: button.id,
          success: false,
          errorCode: code,
          message: text,
        }),
      );
      record({
        eventType: 'REMOTE_ACTION_FAILED',
        description: `Remote action on button "${button.label}" failed: ${text}`,
        deviceId: client.deviceId,
        metadata: { buttonId: button.id, code },
      });
    }
  }

  function rateLimited(client: ClientState): boolean {
    const timestamp = now();
    if (timestamp - client.windowStart >= remoteDefaults.rateLimitWindowMs) {
      client.windowStart = timestamp;
      client.windowCount = 0;
    }
    client.windowCount += 1;
    return client.windowCount > remoteDefaults.rateLimitMaxMessages;
  }

  async function handleMessage(client: ClientState, message: ClientMessage): Promise<void> {
    if (
      (message.type === 'auth.pair' || message.type === 'auth.resume') &&
      client.deviceId !== null
    ) {
      sendError(client, 'INVALID_REQUEST', 'This connection is already authenticated.', message.requestId);
      return;
    }

    if (message.type === 'auth.pair') {
      await handlePair(client, message);
      return;
    }

    if (message.type === 'auth.resume') {
      handleResume(client, message);
      return;
    }

    if (client.deviceId === null) {
      sendError(client, 'UNAUTHORIZED', 'Connect and pair this device before sending commands.', message.requestId);
      return;
    }

    switch (message.type) {
      case 'deck.get':
        sendDeck(client);
        return;
      case 'page.change':
        handlePageChange(client, message);
        return;
      case 'button.press':
        await handleButtonPress(client, message);
        return;
      case 'ping':
        send(client, createServerMessage('pong', {}, message.requestId));
        return;
    }
  }

  function handleFrame(client: ClientState, data: unknown): void {
    if (rateLimited(client)) {
      sendError(client, 'RATE_LIMITED', 'Too many requests. Slow down and try again.', null);
      closeClient(client, remoteCloseCodes.rateLimited, 'Rate limited');
      return;
    }

    const text =
      typeof data === 'string'
        ? data
        : Buffer.isBuffer(data)
          ? data.toString('utf8')
          : data instanceof ArrayBuffer
            ? Buffer.from(data).toString('utf8')
            : Array.isArray(data)
              ? Buffer.concat(data as Buffer[]).toString('utf8')
              : '';

    const parsed = parseClientMessage(text);
    if (!parsed.ok) {
      sendError(client, parsed.code, parsed.message, parsed.requestId);
      if (parsed.closeConnection) {
        closeClient(client, remoteCloseCodes.messageTooBig, 'Message too large');
      }
      return;
    }

    client.queue = client.queue
      .then(() => handleMessage(client, parsed.message))
      .catch((error: unknown) => {
        logger?.error('Remote message failed', {
          error: error instanceof Error ? error.message : String(error),
        });
        sendError(client, 'SERVER_ERROR', 'ConDeck could not handle that request.', null);
      });
  }

  function cleanup(client: ClientState): void {
    if (!clients.delete(client)) {
      return;
    }

    if (client.authTimer !== null) {
      clearTimeout(client.authTimer);
      client.authTimer = null;
    }

    if (client.sessionId !== null) {
      endDeviceSession(db, client.sessionId);
      client.sessionId = null;
    }

    if (client.deviceId !== null) {
      record({
        eventType: 'DEVICE_DISCONNECTED',
        description: `Device "${client.deviceName ?? 'Unknown device'}" disconnected`,
        deviceId: client.deviceId,
      });
    }

    emitStatus();
  }

  function wire(client: ClientState): void {
    clients.add(client);

    client.authTimer = setTimeout(() => {
      if (client.deviceId === null) {
        sendError(client, 'UNAUTHORIZED', 'Pair or reconnect this device first.', null);
        closeClient(client, remoteCloseCodes.unauthorized, 'Authentication timeout');
      }
    }, remoteDefaults.authTimeoutMs);

    client.socket.on('pong', () => {
      client.alive = true;
    });
    client.socket.on('message', (data) => {
      client.alive = true;
      handleFrame(client, data);
    });
    client.socket.on('close', () => cleanup(client));
    client.socket.on('error', () => cleanup(client));

    emitStatus();
  }

  function handleHttp(request: IncomingMessage, response: ServerResponse): void {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.statusCode = 405;
      response.setHeader('Allow', 'GET, HEAD');
      response.end('Method not allowed');
      return;
    }

    if (url.pathname === '/health') {
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.setHeader('Cache-Control', 'no-store');
      response.statusCode = 200;
      response.end(
        JSON.stringify({ ok: true, name: 'ConDeck', protocolVersion: remoteProtocolVersion }),
      );
      return;
    }

    if (url.pathname === remoteDefaults.wsPath) {
      response.statusCode = 426;
      response.setHeader('Upgrade', 'websocket');
      response.end('This endpoint expects a WebSocket connection.');
      return;
    }

    void serveMobile(url.pathname, response);
  }

  async function serveMobile(pathname: string, response: ServerResponse): Promise<void> {
    if (options.mobileAssetsDir) {
      const served = await serveMobileFile(options.mobileAssetsDir, pathname, response);
      if (served) {
        return;
      }
    }

    if (pathname === '/' || !pathname.includes('.')) {
      sendMobileNotBuiltPage(response);
      return;
    }

    applyMobileHeaders(response);
    response.statusCode = 404;
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    response.end('Not found');
  }

  async function start(): Promise<RemoteServerStatus> {
    if (state === 'running' && httpServer !== null) {
      return getStatus();
    }

    state = 'starting';
    lastError = null;
    emitStatus();

    const server = createServer(handleHttp);
    const sockets = new WebSocketServer({ noServer: true, maxPayload: remoteDefaults.maxMessageBytes });

    server.on('upgrade', (request, socket, head) => {
      const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
      if (url.pathname !== remoteDefaults.wsPath) {
        socket.destroy();
        return;
      }

      sockets.handleUpgrade(request, socket, head, (ws) => {
        const client: ClientState = {
          id: randomUUID(),
          socket: ws,
          deviceId: null,
          deviceName: null,
          connectedAt: null,
          sessionId: null,
          currentPageId: null,
          alive: true,
          queue: Promise.resolve(),
          windowStart: now(),
          windowCount: 0,
          authTimer: null,
        };
        wire(client);
      });
    });

    try {
      await new Promise<void>((resolve, reject) => {
        const onError = (error: NodeJS.ErrnoException): void => {
          server.off('listening', onListening);
          reject(error);
        };
        const onListening = (): void => {
          server.off('error', onError);
          resolve();
        };

        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(options.port ?? remoteDefaultPort, options.host ?? '0.0.0.0');
      });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      const port = options.port ?? remoteDefaultPort;
      lastError =
        code === 'EADDRINUSE'
          ? `Port ${port} is already in use. Pick another port for the remote server.`
          : code === 'EACCES'
            ? `Windows blocked port ${port}. Choose a port above 1024.`
            : `The remote server could not start: ${error instanceof Error ? error.message : String(error)}`;

      state = 'error';
      sockets.close();
      server.close();
      emitStatus();
      logger?.error('Remote server failed to start', { port, code: code ?? 'unknown' });
      throw new AppError('CONFLICT', lastError);
    }

    httpServer = server;
    socketServer = sockets;
    const address = server.address() as AddressInfo | null;
    boundPort = address?.port ?? options.port ?? remoteDefaultPort;
    state = 'running';

    maintenance = setInterval(() => {
      const current = pairing.peek();
      if (activePairing !== null && current === null) {
        activePairing = null;
        emitStatus();
      }

      for (const client of clients) {
        if (!client.alive) {
          client.socket.terminate();
          continue;
        }
        client.alive = false;
        try {
          client.socket.ping();
        } catch {
          client.socket.terminate();
        }
      }
    }, heartbeatIntervalMs);
    maintenance.unref?.();

    logger?.info('Remote server listening', {
      port: boundPort,
      addresses: listLanAddresses(boundPort),
      mobileApp: options.mobileAssetsDir ? 'bundled' : 'missing',
    });
    emitStatus();
    return getStatus();
  }

  async function stop(): Promise<void> {
    if (maintenance !== null) {
      clearInterval(maintenance);
      maintenance = null;
    }

    for (const client of clients) {
      closeClient(client, remoteCloseCodes.goingAway, 'Desktop is shutting the server down');
    }
    clients.clear();

    const sockets = socketServer;
    socketServer = null;
    if (sockets !== null) {
      await new Promise<void>((resolve) => {
        sockets.close(() => resolve());
      });
    }

    const server = httpServer;
    httpServer = null;
    if (server !== null) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }

    pairing.clear();
    activePairing = null;
    state = 'stopped';
    emitStatus();
  }

  async function createPairing(): Promise<RemotePairing> {
    if (state !== 'running') {
      throw new AppError('NOT_AVAILABLE', 'Start the remote server before creating a pairing code.');
    }

    const token = pairing.issue();
    const addresses = listLanAddresses(boundPort);
    const base = addresses[0] ?? `http://127.0.0.1:${boundPort}`;
    const url = `${base}/#pair=${token.token}`;

    const qrcode = await import('qrcode');
    const qrDataUrl = await qrcode.default.toDataURL(url, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 320,
      color: { dark: '#0a0c11', light: '#ffffff' },
    });

    activePairing = {
      token: token.token,
      expiresAt: new Date(token.expiresAt).toISOString(),
      url,
      qrDataUrl,
    };
    emitStatus();
    logSafely(logger, 'Pairing code created', { expiresAt: activePairing.expiresAt });
    return activePairing;
  }

  function disconnectDevice(deviceId: string): void {
    for (const client of clients) {
      if (client.deviceId === deviceId) {
        sendError(client, 'DEVICE_REVOKED', 'Access for this device was revoked in ConDeck Desktop.', null);
        closeClient(client, remoteCloseCodes.unauthorized, 'Device revoked');
      }
    }
  }

  function notifyDeckChanged(): void {
    const snapshot = currentSnapshot();
    for (const client of clients) {
      if (client.deviceId === null) {
        continue;
      }
      if (snapshot === null) {
        send(client, createServerMessage('deck.snapshot', null));
        continue;
      }
      send(client, createServerMessage('deck.updated', { deckId: snapshot.deckId }));
    }
  }

  return {
    start,
    stop,
    getStatus,
    createPairing,
    clearPairing() {
      pairing.clear();
      activePairing = null;
      emitStatus();
    },
    disconnectDevice,
    notifyDeckChanged,
    broadcastObsStatus: sendObsStatusToAll,
  };
}
