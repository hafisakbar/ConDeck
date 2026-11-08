import {
  createServerMessage,
  type ClientMessage,
  type RemoteDeckSnapshot,
  type ServerMessage,
} from '@condeck/websocket-protocol';
import { describe, expect, it, vi } from 'vitest';
import { createRemoteClient, type RemoteClient, type SocketLike } from './remote-client';
import type { StoredDevice } from './storage';

const DEVICE_ID = '3f1b2a40-9c8d-4d1e-8f2a-1b2c3d4e5f60';
const PAGE_ID = 'a1b2c3d4-1111-4222-8333-444455556666';
const BUTTON_ID = 'b1b2c3d4-1111-4222-8333-444455556666';
const TOKEN = 'pairing-token-value-that-is-long-enough';
const CREDENTIAL = 'issued-credential-value-long-enough';

class FakeSocket implements SocketLike {
  readyState = 0;
  closed = false;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code?: number; reason?: string }) => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(public readonly url: string) {}

  send(data: string): void {
    if (this.readyState !== 1) {
      throw new Error('socket is not open');
    }
    this.sent.push(data);
  }

  close(): void {
    this.closed = true;
    this.readyState = 3;
  }

  open(): void {
    this.readyState = 1;
    this.onopen?.();
  }

  receive(message: ServerMessage): void {
    this.onmessage?.({ data: JSON.stringify(message) });
  }

  drop(): void {
    this.readyState = 3;
    this.onclose?.({ code: 1006 });
  }

  sentTypes(): string[] {
    return this.messages().map((message) => message.type);
  }

  messages(): ClientMessage[] {
    return this.sent.map((raw) => JSON.parse(raw) as ClientMessage);
  }
}

function latest(sockets: FakeSocket[]): FakeSocket {
  const socket = sockets.at(-1);
  if (!socket) {
    throw new Error('The client never opened a socket.');
  }
  return socket;
}

interface Harness {
  client: RemoteClient;
  sockets: FakeSocket[];
  paired: StoredDevice[];
  rejected: number;
}

function createHarness(): Harness {
  const sockets: FakeSocket[] = [];
  const paired: StoredDevice[] = [];
  const state: Harness = { client: null as unknown as RemoteClient, sockets, paired, rejected: 0 };

  state.client = createRemoteClient({
    createSocket: (url) => {
      const socket = new FakeSocket(url);
      sockets.push(socket);
      return socket;
    },
    onPaired: (device) => paired.push(device),
    onDeviceRejected: () => {
      state.rejected += 1;
    },
    reconnectDelaysMs: [5],
    connectTimeoutMs: 60_000,
    heartbeatIntervalMs: 60_000,
    livenessTimeoutMs: 120_000,
  });

  return state;
}

const storedDevice: StoredDevice = {
  host: '192.168.1.20',
  port: 43821,
  deviceId: DEVICE_ID,
  deviceCredential: CREDENTIAL,
  deviceName: 'Pixel 8',
};

const snapshot: RemoteDeckSnapshot = {
  deckId: 'c1b2c3d4-1111-4222-8333-444455556666',
  name: 'Streaming',
  columns: 4,
  rows: 2,
  pages: [
    {
      id: PAGE_ID,
      name: 'Main',
      position: 0,
      buttons: [
        {
          id: BUTTON_ID,
          position: 0,
          label: 'Go live',
          icon: '🔴',
          backgroundColor: '#e35663',
          textColor: '#ffffff',
          isEnabled: true,
          hasAction: true,
        },
      ],
    },
  ],
};

async function connectedClient(): Promise<Harness> {
  const harness = createHarness();
  harness.client.connect({ host: storedDevice.host, port: storedDevice.port, device: storedDevice });
  latest(harness.sockets).open();
  latest(harness.sockets).receive(
    createServerMessage('auth.result', { success: true, deviceId: DEVICE_ID }),
  );
  return harness;
}

describe('remote client pairing', () => {
  it('opens the contract URL and sends auth.pair before any command', () => {
    const harness = createHarness();
    harness.client.connect({
      host: '192.168.1.20',
      port: 43821,
      pairToken: TOKEN,
      deviceName: 'Pixel 8',
    });

    const socket = latest(harness.sockets);
    expect(socket.url).toBe('ws://192.168.1.20:43821/ws');
    expect(harness.client.getState()).toBe('connecting');

    socket.open();
    const [first] = socket.messages();
    expect(first?.type).toBe('auth.pair');
    expect(first?.payload).toMatchObject({
      pairingToken: TOKEN,
      deviceName: 'Pixel 8',
      deviceType: 'mobile',
    });
  });

  it('stores the issued credential and requests the deck', () => {
    const harness = createHarness();
    harness.client.connect({ host: '10.0.0.5', port: 43821, pairToken: TOKEN, deviceName: 'Pixel 8' });

    const socket = latest(harness.sockets);
    socket.open();
    socket.receive(
      createServerMessage('auth.pair.result', {
        success: true,
        deviceId: DEVICE_ID,
        deviceCredential: CREDENTIAL,
      }),
    );

    expect(harness.client.getState()).toBe('connected');
    expect(harness.paired).toEqual([
      {
        host: '10.0.0.5',
        port: 43821,
        deviceId: DEVICE_ID,
        deviceCredential: CREDENTIAL,
        deviceName: 'Pixel 8',
      },
    ]);
    expect(socket.sentTypes()).toContain('deck.get');
  });

  it('resumes with the stored device instead of a pairing token', () => {
    const harness = createHarness();
    harness.client.connect({
      host: storedDevice.host,
      port: storedDevice.port,
      device: storedDevice,
    });

    const socket = latest(harness.sockets);
    socket.open();

    const [first] = socket.messages();
    expect(first?.type).toBe('auth.resume');
    expect(first?.payload).toEqual({ deviceId: DEVICE_ID, deviceCredential: CREDENTIAL });
  });

  it('reports an expired pairing code without retrying', async () => {
    const harness = createHarness();
    harness.client.connect({ host: storedDevice.host, port: storedDevice.port, pairToken: TOKEN });
    const socket = latest(harness.sockets);
    socket.open();

    socket.receive(
      createServerMessage('error', {
        code: 'TOKEN_EXPIRED',
        message: 'This pairing code expired.',
        requestId: null,
      }),
    );

    expect(harness.client.getState()).toBe('error');
    expect(harness.client.getError()).toBe('This pairing code expired.');
    expect(socket.closed).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(harness.sockets).toHaveLength(1);
  });
});

describe('remote client connection', () => {
  it('marks a rejected credential as invalid and clears the device', async () => {
    const harness = await connectedClient();
    const socket = latest(harness.sockets);

    socket.receive(
      createServerMessage('error', {
        code: 'DEVICE_REVOKED',
        message: 'Device was revoked.',
        requestId: null,
      }),
    );

    expect(harness.client.getState()).toBe('error');
    expect(harness.rejected).toBe(1);
    expect(harness.client.getError()).toContain('revoked');

    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(harness.sockets).toHaveLength(1);
  });

  it('reconnects with fresh credentials after a dropped socket', async () => {
    const harness = await connectedClient();
    latest(harness.sockets).drop();

    expect(harness.client.getState()).toBe('reconnecting');

    await vi.waitFor(() => expect(harness.sockets).toHaveLength(2), { timeout: 500 });
    const socket = latest(harness.sockets);
    socket.open();

    const [first] = socket.messages();
    expect(first?.type).toBe('auth.resume');
    socket.receive(createServerMessage('auth.result', { success: true, deviceId: DEVICE_ID }));
    expect(harness.client.getState()).toBe('connected');
  });
});

describe('remote client commands', () => {
  it('only sends presses and page changes while connected', async () => {
    const harness = createHarness();
    harness.client.connect({ host: '10.0.0.5', port: 43821, pairToken: TOKEN });

    expect(harness.client.press(BUTTON_ID)).toBe(false);
    harness.client.changePage(PAGE_ID);

    const socket = latest(harness.sockets);
    socket.open();
    socket.receive(createServerMessage('auth.result', { success: true, deviceId: DEVICE_ID }));

    expect(harness.client.press(BUTTON_ID)).toBe(true);
    harness.client.changePage(PAGE_ID);

    const messages = socket.messages();
    expect(messages).toContainEqual(
      expect.objectContaining({ type: 'button.press', payload: { buttonId: BUTTON_ID } }),
    );
    expect(messages).toContainEqual(
      expect.objectContaining({ type: 'page.change', payload: { pageId: PAGE_ID } }),
    );
  });

  it('applies snapshots and refreshes when the deck changes', async () => {
    const harness = await connectedClient();
    const socket = latest(harness.sockets);

    socket.receive(createServerMessage('deck.snapshot', snapshot));
    expect(harness.client.getSnapshot()).toEqual(snapshot);

    const before = socket.sentTypes().filter((type) => type === 'deck.get').length;
    socket.receive(createServerMessage('deck.updated', { deckId: snapshot.deckId }));
    const after = socket.sentTypes().filter((type) => type === 'deck.get').length;
    expect(after).toBe(before + 1);

    socket.receive(createServerMessage('deck.snapshot', null));
    expect(harness.client.getSnapshot()).toBeNull();
  });

  it('tracks OBS status and action feedback', async () => {
    const harness = await connectedClient();
    const socket = latest(harness.sockets);

    socket.receive(
      createServerMessage('obs.status', {
        connected: true,
        streaming: true,
        recording: false,
        sceneName: 'Main',
      }),
    );
    expect(harness.client.getObs()).toMatchObject({ streaming: true, sceneName: 'Main' });

    socket.receive(createServerMessage('action.started', { buttonId: BUTTON_ID }));
    expect(harness.client.getFeedback()).toMatchObject({ status: 'started', buttonId: BUTTON_ID });

    socket.receive(
      createServerMessage('action.completed', {
        buttonId: BUTTON_ID,
        success: true,
        message: 'Scene changed.',
      }),
    );
    expect(harness.client.getFeedback()).toMatchObject({ status: 'success', message: 'Scene changed.' });

    harness.client.clearFeedback();
    expect(harness.client.getFeedback()).toBeNull();
  });

  it('ignores malformed frames and unknown messages', async () => {
    const harness = await connectedClient();
    const socket = latest(harness.sockets);

    socket.onmessage?.({ data: 'not json' });
    socket.onmessage?.({ data: new ArrayBuffer(4) });
    socket.receive(createServerMessage('pong', {}));

    expect(harness.client.getState()).toBe('connected');
  });
});

describe('remote client heartbeat', () => {
  it('reconnects when the desktop stops answering pings', async () => {
    const sockets: FakeSocket[] = [];
    const client = createRemoteClient({
      createSocket: (url) => {
        const socket = new FakeSocket(url);
        sockets.push(socket);
        return socket;
      },
      reconnectDelaysMs: [5],
      connectTimeoutMs: 60_000,
      heartbeatIntervalMs: 10,
      livenessTimeoutMs: 15,
    });

    client.connect({ host: storedDevice.host, port: storedDevice.port, device: storedDevice });
    const socket = latest(sockets);
    socket.open();
    socket.receive(createServerMessage('auth.result', { success: true, deviceId: DEVICE_ID }));

    await vi.waitFor(() => expect(client.getState()).toBe('reconnecting'), { timeout: 1_000 });
    expect(socket.sentTypes()).toContain('ping');
    expect(socket.closed).toBe(true);
    client.disconnect();
  });
});
