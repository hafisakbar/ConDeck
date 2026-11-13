import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server } from 'socket.io';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLiveStudioSocket, type LiveStudioSocket } from './socket';

let httpServer: HttpServer;
let io: Server;
let port = 0;
let joinCount = 0;
let socket: LiveStudioSocket | null = null;

beforeEach(async () => {
  joinCount = 0;
  httpServer = createServer();
  io = new Server(httpServer, { path: '/socket.io/', transports: ['websocket'] });

  io.on('connection', (connection) => {
    connection.on('stream_deck/join_room', () => {
      joinCount += 1;
    });
    connection.on('stream_deck/sync_settings', () => {
      connection.emit(
        'stream_deck/sync_settings',
        JSON.stringify({
          scene: 'Main',
          scene_list: [{ name: 'Main', sources: [], visible_sources: [] }],
          mic_mute: false,
          audio_mute: false,
          recording: false,
          stream_status: 2,
        }),
      );
    });
    connection.on('stream_deck/action_emit', (raw: unknown) => {
      const envelope = JSON.parse(String(raw)) as {
        action: string;
        context: string;
        payload: { settings: Record<string, unknown> };
      };
      if (envelope.action === 'timeout') {
        return;
      }
      const code = envelope.action === 'reject' ? 1 : 0;
      connection.emit(`stream_deck/${envelope.context}`, JSON.stringify({ code }));
    });
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(0, '127.0.0.1', resolve);
  });
  port = (httpServer.address() as AddressInfo).port;
});

afterEach(async () => {
  socket?.close();
  socket = null;
  await new Promise<void>((resolve) => {
    io.close(() => resolve());
  });
  await new Promise<void>((resolve) => {
    httpServer.close(() => resolve());
  });
});

describe('LiveStudioSocket', () => {
  it('joins once even when settings are synced repeatedly', async () => {
    socket = createLiveStudioSocket({ port });
    await socket.connect();
    const first = await socket.sync();
    const second = await socket.sync();
    expect(first.sceneName).toBe('Main');
    expect(second.sceneName).toBe('Main');
    expect(joinCount).toBe(1);
  });

  it('sends the documented envelope and resolves on the context result', async () => {
    socket = createLiveStudioSocket({ port });
    await socket.connect();
    await expect(
      socket.action('com.tiktok.livestudio.mic', { muted: true }),
    ).resolves.toBeUndefined();
  });

  it('turns a non-zero result code into a failure', async () => {
    socket = createLiveStudioSocket({ port });
    await socket.connect();
    await expect(socket.action('reject', {})).rejects.toThrow(/code 1/);
  });

  it('times out without retrying when LIVE Studio never acknowledges', async () => {
    socket = createLiveStudioSocket({ port, requestTimeoutMs: 50 });
    await socket.connect();
    await expect(socket.action('timeout', {})).rejects.toMatchObject({ code: 'ACTION_TIMEOUT' });
  });

  it('refuses to sync while disconnected', () => {
    const probe = createLiveStudioSocket({ port });
    socket = probe;
    expect(() => probe.sync()).toThrow(/not connected/i);
  });

  it('reports a connection error for a port without a server', async () => {
    socket = createLiveStudioSocket({ port: 9, connectTimeoutMs: 200 });
    await expect(socket.connect()).rejects.toBeTruthy();
  });
});
