import { get } from 'node:http';
import type { IncomingHttpHeaders } from 'node:http';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createButton,
  createDeck,
  createProfile,
  getDeckDetail,
  listDevices,
  openDatabase,
  setButtonAction,
  updateButton,
  type ConDeckDatabase,
} from '@condeck/database';
import {
  AppError,
  remoteDefaultPort,
  type ActionExecutionResult,
  type ObsSnapshot,
} from '@condeck/shared';
import {
  createClientMessage,
  parseServerMessage,
  serializeMessage,
  type ClientMessage,
  type ServerMessage,
} from '@condeck/websocket-protocol';
import { WebSocket } from 'ws';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRemoteServer, type RemoteServer } from './remote-server.service';

interface TestClient {
  socket: WebSocket;
  messages: ServerMessage[];
  consumed: Set<ServerMessage>;
  closed: boolean;
  closeCode: number | null;
}

const clients: TestClient[] = [];

function connect(port: number): Promise<TestClient> {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const client: TestClient = {
    socket,
    messages: [],
    consumed: new Set(),
    closed: false,
    closeCode: null,
  };

  socket.on('message', (data) => {
    const parsed = parseServerMessage(data.toString());
    if (parsed) {
      client.messages.push(parsed);
    }
  });
  socket.on('close', (code) => {
    client.closed = true;
    client.closeCode = code;
  });
  socket.on('error', () => undefined);

  clients.push(client);
  return new Promise((resolve, reject) => {
    socket.once('open', () => resolve(client));
    socket.once('error', reject);
  });
}

function waitForType<T extends ServerMessage['type']>(
  client: TestClient,
  type: T,
  timeoutMs = 3_000,
): Promise<Extract<ServerMessage, { type: T }>> {
  const existing = client.messages.find(
    (message): message is Extract<ServerMessage, { type: T }> =>
      message.type === type && !client.consumed.has(message),
  );
  if (existing) {
    client.consumed.add(existing);
    return Promise.resolve(existing);
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      client.socket.off('message', check);
      reject(new Error(`Timed out waiting for ${type}. Received: ${client.messages.map((m) => m.type).join(', ')}`));
    }, timeoutMs);

    const check = (): void => {
      const found = client.messages.find(
        (message): message is Extract<ServerMessage, { type: T }> =>
          message.type === type && !client.consumed.has(message),
      );
      if (found) {
        clearTimeout(timer);
        client.consumed.add(found);
        client.socket.off('message', check);
        resolve(found);
      }
    };

    client.socket.on('message', check);
  });
}

function waitForClose(client: TestClient, timeoutMs = 3_000): Promise<number | null> {
  if (client.closed) {
    return Promise.resolve(client.closeCode);
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for the socket to close.')), timeoutMs);
    client.socket.once('close', (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
}

function send(client: TestClient, message: ClientMessage): void {
  client.socket.send(serializeMessage(message));
}

function httpGet(
  port: number,
  path: string,
): Promise<{ status: number; body: string; headers: IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const request = get({ host: '127.0.0.1', port, path }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk: string) => {
        body += chunk;
      });
      response.on('end', () => {
        resolve({ status: response.statusCode ?? 0, body, headers: response.headers });
      });
    });
    request.on('error', reject);
  });
}

let workDir: string;
let database: ConDeckDatabase;
let server: RemoteServer | null = null;
let port = 0;
let executeAction: ReturnType<typeof vi.fn>;
let obsSnapshot: ObsSnapshot | null;
let deckId = '';
let pageId = '';
let buttonId = '';
let disabledButtonId = '';
let clock = 1_700_000_000_000;

const successResult: ActionExecutionResult = {
  buttonId: 'button',
  actionType: 'OBS_START_STREAMING',
  status: 'SUCCESS',
  code: null,
  message: 'OBS is now streaming.',
  durationMs: 12,
};

beforeEach(async () => {
  workDir = mkdtempSync(join(tmpdir(), 'condeck-remote-'));
  database = openDatabase({ filePath: join(workDir, 'condeck.db') });
  clock = 1_700_000_000_000;

  const profile = createProfile(database.db, { name: 'Streaming' });
  const detail = createDeck(database.db, {
    profileId: profile.id,
    name: 'Main deck',
    columns: 3,
    rows: 3,
  });
  deckId = detail.deck.id;
  pageId = detail.pages[0]?.id ?? '';

  const button = createButton(database.db, { pageId, position: 0, label: 'Go live' });
  buttonId = button.id;
  setButtonAction(database.db, {
    buttonId,
    actionType: 'OBS_START_STREAMING',
    config: {},
  });

  const disabled = createButton(database.db, { pageId, position: 1, label: 'Disabled' });
  disabledButtonId = disabled.id;
  setButtonAction(database.db, {
    buttonId: disabledButtonId,
    actionType: 'OBS_START_STREAMING',
    config: {},
  });
  updateButton(database.db, { buttonId: disabledButtonId, isEnabled: false });

  executeAction = vi.fn(async () => ({ ...successResult, buttonId }));
  obsSnapshot = null;

  server = createRemoteServer({
    db: database.db,
    executeAction: executeAction as unknown as (buttonId: string) => Promise<ActionExecutionResult>,
    getActiveDeck: () => getDeckDetail(database.db, deckId),
    getObsSnapshot: () => obsSnapshot,
    port: 0,
    host: '127.0.0.1',
    now: () => clock,
    pairingTtlMs: 60_000,
    pairingMaxAttempts: 2,
  });

  const status = await server.start();
  port = status.port;
});

afterEach(async () => {
  for (const client of clients.splice(0)) {
    client.socket.removeAllListeners();
    client.socket.terminate();
  }
  await server?.stop();
  server = null;
  database.close();
  rmSync(workDir, { recursive: true, force: true });
});

async function pairClient(): Promise<{ client: TestClient; deviceId: string; credential: string }> {
  const pairing = await server?.createPairing();
  if (!pairing) {
    throw new Error('Server is not running.');
  }

  const client = await connect(port);
  send(
    client,
    createClientMessage('auth.pair', {
      pairingToken: pairing.token,
      deviceName: 'Test phone',
      deviceType: 'mobile',
    }),
  );

  const result = await waitForType(client, 'auth.pair.result');
  return {
    client,
    deviceId: result.payload.deviceId,
    credential: result.payload.deviceCredential,
  };
}

describe('remote server http surface', () => {
  it('reports health and protocol version', async () => {
    const response = await httpGet(port, '/health');

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      ok: true,
      name: 'ConDeck',
      protocolVersion: 1,
    });
  });

  it('explains how to build the mobile app when it is missing', async () => {
    const response = await httpGet(port, '/');

    expect(response.status).toBe(200);
    expect(response.body).toContain('pnpm --filter @condeck/mobile build');
    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
  });

  it('answers 426 on the WebSocket path without an upgrade', async () => {
    const response = await httpGet(port, '/ws');
    expect(response.status).toBe(426);
  });

  it('serves the bundled mobile app with the headers it needs', async () => {
    const assetsDir = mkdtempSync(join(tmpdir(), 'condeck-mobile-'));
    mkdirSync(join(assetsDir, 'assets'));
    writeFileSync(join(assetsDir, 'index.html'), '<!doctype html><title>ConDeck Remote</title>');
    writeFileSync(join(assetsDir, 'assets/index-abc123.js'), 'console.log("remote");');
    writeFileSync(join(assetsDir, 'manifest.webmanifest'), '{"name":"ConDeck Remote"}');

    const appServer = createRemoteServer({
      db: database.db,
      executeAction: executeAction as unknown as (buttonId: string) => Promise<ActionExecutionResult>,
      getActiveDeck: () => getDeckDetail(database.db, deckId),
      getObsSnapshot: () => obsSnapshot,
      mobileAssetsDir: assetsDir,
      port: 0,
      host: '127.0.0.1',
    });

    try {
      const status = await appServer.start();

      const shell = await httpGet(status.port, '/');
      expect(shell.status).toBe(200);
      expect(shell.body).toContain('<title>ConDeck Remote</title>');
      expect(shell.headers['content-type']).toContain('text/html');
      expect(shell.headers['cache-control']).toBe('no-cache');
      expect(shell.headers['content-security-policy']).toContain("connect-src 'self' ws: wss:");

      const asset = await httpGet(status.port, '/assets/index-abc123.js');
      expect(asset.status).toBe(200);
      expect(asset.headers['content-type']).toContain('text/javascript');
      expect(asset.headers['cache-control']).toContain('immutable');

      const manifest = await httpGet(status.port, '/manifest.webmanifest');
      expect(manifest.headers['content-type']).toContain('application/manifest+json');

      const missing = await httpGet(status.port, '/assets/missing.js');
      expect(missing.status).toBe(404);

      const traversal = await httpGet(status.port, '/%2e%2e%2fpackage.json');
      expect(traversal.status).toBe(404);
    } finally {
      await appServer.stop();
      rmSync(assetsDir, { recursive: true, force: true });
    }
  });
});

describe('pairing', () => {
  it('issues a single-use code with a QR image', async () => {
    const pairing = await server?.createPairing();

    expect(pairing?.token).toHaveLength(43);
    expect(pairing?.url).toContain(`#pair=${pairing?.token}`);
    expect(pairing?.qrDataUrl.startsWith('data:image/png;base64,')).toBe(true);
    expect(server?.getStatus().pairing?.token).toBe(pairing?.token);
  });

  it('pairs a device, sends the deck and records the session', async () => {
    const { client, deviceId, credential } = await pairClient();

    expect(deviceId).toMatch(/^[0-9a-f-]{36}$/);
    expect(credential.length).toBeGreaterThan(20);

    const snapshot = await waitForType(client, 'deck.snapshot');
    if (snapshot.payload === null) {
      throw new Error('Expected a deck snapshot.');
    }
    expect(snapshot.payload.deckId).toBe(deckId);
    expect(snapshot.payload.pages[0]?.buttons[0]?.label).toBe('Go live');
    expect(snapshot.payload.pages[0]?.buttons[0]?.hasAction).toBe(true);
    expect(snapshot.payload.pages[0]?.buttons[0]).not.toHaveProperty('action');

    expect(listDevices(database.db)).toHaveLength(1);
    expect(server?.getStatus().connectedDevices.map((device) => device.deviceId)).toEqual([deviceId]);
    expect(server?.getStatus().pairing).toBeNull();
  });

  it('rejects a wrong code and counts down the attempts', async () => {
    const pairing = await server?.createPairing();
    expect(pairing).toBeDefined();

    const client = await connect(port);
    send(
      client,
      createClientMessage('auth.pair', {
        pairingToken: 'b'.repeat(43),
        deviceName: 'Intruder',
        deviceType: 'mobile',
      }),
    );

    const error = await waitForType(client, 'error');
    expect(error.payload.code).toBe('INVALID_TOKEN');
    expect(listDevices(database.db)).toHaveLength(0);
  });

  it('closes the socket once the attempt budget is gone', async () => {
    await server?.createPairing();
    const client = await connect(port);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      send(
        client,
        createClientMessage('auth.pair', {
          pairingToken: 'c'.repeat(43),
          deviceName: 'Intruder',
          deviceType: 'mobile',
        }),
      );
    }

    expect(await waitForClose(client)).toBe(4429);
  });

  it('rejects an expired code', async () => {
    const pairing = await server?.createPairing();
    clock += 61_000;

    const client = await connect(port);
    send(
      client,
      createClientMessage('auth.pair', {
        pairingToken: pairing?.token ?? '',
        deviceName: 'Late phone',
        deviceType: 'mobile',
      }),
    );

    const error = await waitForType(client, 'error');
    expect(error.payload.code).toBe('TOKEN_EXPIRED');
  });

  it('resumes with a stored credential and refuses a revoked device', async () => {
    const first = await pairClient();
    first.client.socket.terminate();

    const resumed = await connect(port);
    send(
      resumed,
      createClientMessage('auth.resume', {
        deviceId: first.deviceId,
        deviceCredential: first.credential,
      }),
    );
    const auth = await waitForType(resumed, 'auth.result');
    expect(auth.payload.deviceId).toBe(first.deviceId);

    server?.disconnectDevice(first.deviceId);
    await waitForClose(resumed);

    database.sqlite
      .prepare('UPDATE devices SET is_authorized = 0 WHERE id = ?')
      .run(first.deviceId);

    const blocked = await connect(port);
    send(
      blocked,
      createClientMessage('auth.resume', {
        deviceId: first.deviceId,
        deviceCredential: first.credential,
      }),
    );
    const error = await waitForType(blocked, 'error');
    expect(error.payload.code).toBe('DEVICE_REVOKED');
  });

  it('refuses commands before authentication', async () => {
    const client = await connect(port);
    send(client, createClientMessage('deck.get', {}));

    const error = await waitForType(client, 'error');
    expect(error.payload.code).toBe('UNAUTHORIZED');
  });
});

describe('remote control', () => {
  it('runs the configured action and streams started/completed feedback', async () => {
    const { client } = await pairClient();

    send(client, createClientMessage('button.press', { buttonId }));

    const started = await waitForType(client, 'action.started');
    expect(started.payload.buttonId).toBe(buttonId);

    const completed = await waitForType(client, 'action.completed');
    expect(completed.payload).toMatchObject({ buttonId, success: true });
    expect(executeAction).toHaveBeenCalledWith(buttonId);
  });

  it('reports a disabled button without running it', async () => {
    const { client } = await pairClient();

    send(client, createClientMessage('button.press', { buttonId: disabledButtonId }));

    const failed = await waitForType(client, 'action.failed');
    expect(failed.payload.errorCode).toBe('ACTION_FAILED');
    expect(failed.payload.message).toContain('disabled');
    expect(executeAction).not.toHaveBeenCalled();
  });

  it('reports an unknown button', async () => {
    const { client } = await pairClient();

    send(client, createClientMessage('button.press', { buttonId: '9b2f3c1d-7b1e-4d3a-9c2b-1a2b3c4d5e6f' }));

    const error = await waitForType(client, 'error');
    expect(error.payload.code).toBe('BUTTON_NOT_FOUND');
  });

  it('maps an execution failure to action.failed', async () => {
    executeAction.mockResolvedValueOnce({
      ...successResult,
      buttonId,
      status: 'FAILED',
      code: 'OBS_DISCONNECTED',
      message: 'OBS is not connected.',
    });

    const { client } = await pairClient();
    send(client, createClientMessage('button.press', { buttonId }));

    const failed = await waitForType(client, 'action.failed');
    expect(failed.payload).toMatchObject({
      errorCode: 'OBS_DISCONNECTED',
      message: 'OBS is not connected.',
      success: false,
    });
  });

  it('maps a thrown AppError to the same remote code', async () => {
    executeAction.mockRejectedValueOnce(new AppError('ACTION_BUSY', 'This button is already running.'));

    const { client } = await pairClient();
    send(client, createClientMessage('button.press', { buttonId }));

    const failed = await waitForType(client, 'action.failed');
    expect(failed.payload.errorCode).toBe('ACTION_BUSY');
  });

  it('acknowledges page changes and rejects pages outside the deck', async () => {
    const { client } = await pairClient();

    send(client, createClientMessage('page.change', { pageId }));
    const changed = await waitForType(client, 'page.changed');
    expect(changed.payload).toEqual({ pageId, pageIndex: 0 });

    send(client, createClientMessage('page.change', { pageId: '9b2f3c1d-7b1e-4d3a-9c2b-1a2b3c4d5e6f' }));
    const error = await waitForType(client, 'error');
    expect(error.payload.code).toBe('INVALID_REQUEST');
  });

  it('answers heartbeat pings', async () => {
    const { client } = await pairClient();
    send(client, createClientMessage('ping', {}));

    const pong = await waitForType(client, 'pong');
    expect(pong.type).toBe('pong');
  });

  it('sends a fresh snapshot when asked and announces deck edits', async () => {
    const { client } = await pairClient();
    await waitForType(client, 'deck.snapshot');

    createButton(database.db, { pageId, position: 4, label: 'Mute' });
    server?.notifyDeckChanged();

    const updated = await waitForType(client, 'deck.updated');
    expect(updated.payload.deckId).toBe(deckId);

    send(client, createClientMessage('deck.get', {}));
    const snapshot = await waitForType(client, 'deck.snapshot');
    expect(snapshot.payload?.pages[0]?.buttons.map((button) => button.label)).toContain('Mute');
  });

  it('broadcasts OBS status to paired devices', async () => {
    const { client } = await pairClient();
    await waitForType(client, 'obs.status');

    obsSnapshot = {
      state: 'CONNECTED',
      message: null,
      host: '127.0.0.1',
      port: 4455,
      isEnabled: true,
      hasPassword: true,
      sceneName: 'Main',
      scenes: ['Main'],
      isStreaming: true,
      isRecording: false,
    };
    server?.broadcastObsStatus();

    const status = await waitForType(client, 'obs.status');
    expect(status.payload).toEqual({
      connected: true,
      streaming: true,
      recording: false,
      sceneName: 'Main',
    });
  });

  it('closes the socket on an oversized message', async () => {
    const { client } = await pairClient();
    client.socket.send('x'.repeat(9_000));

    expect(await waitForClose(client)).toBe(1009);
  });

  it('rate limits a flood of messages', async () => {
    const { client } = await pairClient();

    for (let index = 0; index < 40; index += 1) {
      send(client, createClientMessage('ping', {}));
    }

    expect(await waitForClose(client)).toBe(4429);
  });
});

describe('defaults', () => {
  it('uses port 43821 when none is given', () => {
    expect(remoteDefaultPort).toBe(43821);
  });
});
