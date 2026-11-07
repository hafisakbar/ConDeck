import { AppError } from '@condeck/shared';
import { describe, expect, it } from 'vitest';
import { createObsClient } from './client';
import type { ObsSocket } from './types';

type Listener = (payload: unknown) => void;

class FakeSocket implements ObsSocket {
  readonly calls: Array<{ requestType: string; data?: unknown }> = [];
  connectArgs: { url: string; password?: string } | null = null;
  disconnected = false;
  connectImpl: () => Promise<unknown> = async () => ({});
  responses: Record<string, unknown> = {
    GetSceneList: {
      currentProgramSceneName: 'Starting soon',
      scenes: [
        { sceneName: 'Main', sceneIndex: 1 },
        { sceneName: 'Starting soon', sceneIndex: 0 },
      ],
    },
    GetStreamStatus: { outputActive: false },
    GetRecordStatus: { outputActive: false },
    GetInputMute: { inputMuted: true },
  };
  private readonly handlers = new Map<string, Set<Listener>>();
  private readonly pending = new Map<string, Promise<unknown>>();

  async connect(url: string, password?: string): Promise<unknown> {
    this.connectArgs = { url, password };
    return this.connectImpl();
  }

  async disconnect(): Promise<void> {
    this.disconnected = true;
  }

  async call(requestType: string, data?: unknown): Promise<unknown> {
    this.calls.push({ requestType, data });
    const stalled = this.pending.get(requestType);
    if (stalled) {
      return stalled;
    }
    return this.responses[requestType] ?? {};
  }

  on(event: string, listener: Listener): void {
    const set = this.handlers.get(event) ?? new Set<Listener>();
    set.add(listener);
    this.handlers.set(event, set);
  }

  removeAllListeners(): void {
    this.handlers.clear();
  }

  stall(requestType: string): void {
    this.pending.set(requestType, new Promise<unknown>(() => undefined));
  }

  emit(event: string, payload: unknown): void {
    for (const listener of this.handlers.get(event) ?? []) {
      listener(payload);
    }
  }

  requestedTypes(): string[] {
    return this.calls.map((call) => call.requestType);
  }
}

function setup(options: { connectTimeoutMs?: number; requestTimeoutMs?: number } = {}) {
  const sockets: FakeSocket[] = [];
  const client = createObsClient({
    createSocket: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    ...options,
  });
  return { client, sockets };
}

describe('OBS client connection', () => {
  it('connects to the OBS WebSocket v5 endpoint and reads the initial state', async () => {
    const { client, sockets } = setup();

    await client.connect({ host: '127.0.0.1', port: 4455, password: 'secret' });

    const socket = sockets[0];
    expect(socket?.connectArgs).toEqual({ url: 'ws://127.0.0.1:4455', password: 'secret' });
    expect(socket?.requestedTypes()).toEqual(['GetSceneList', 'GetStreamStatus', 'GetRecordStatus']);
    expect(client.isConnected()).toBe(true);
    expect(client.snapshot()).toMatchObject({
      connected: true,
      sceneName: 'Starting soon',
      scenes: ['Main', 'Starting soon'],
      isStreaming: false,
      isRecording: false,
    });
  });

  it('connects without a password when none is configured', async () => {
    const { client, sockets } = setup();

    await client.connect({ host: 'localhost', port: 4455, password: null });

    expect(sockets[0]?.connectArgs).toEqual({ url: 'ws://localhost:4455', password: undefined });
  });

  it('reports a clear error when OBS cannot be reached', async () => {
    const sockets: FakeSocket[] = [];
    const failing = createObsClient({
      createSocket: () => {
        const socket = new FakeSocket();
        socket.connectImpl = async () => {
          throw new Error('connect ECONNREFUSED');
        };
        sockets.push(socket);
        return socket;
      },
    });

    await expect(failing.connect({ host: '127.0.0.1', port: 4455 })).rejects.toThrowError(
      /Could not connect to OBS at 127\.0\.0\.1:4455/,
    );
    expect(failing.isConnected()).toBe(false);
  });

  it('explains a rejected password instead of a generic failure', async () => {
    const sockets: FakeSocket[] = [];
    const client = createObsClient({
      createSocket: () => {
        const socket = new FakeSocket();
        socket.connectImpl = async () => {
          throw Object.assign(new Error('Authentication failed.'), { code: 4009 });
        };
        sockets.push(socket);
        return socket;
      },
    });

    const error = await client.connect({ host: '127.0.0.1', port: 4455, password: 'wrong' }).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('OBS_CONNECTION_FAILED');
    expect((error as AppError).message).toMatch(/rejected the password/i);
  });

  it('times out a connection attempt that never settles', async () => {
    const sockets: FakeSocket[] = [];
    const client = createObsClient({
      connectTimeoutMs: 20,
      createSocket: () => {
        const socket = new FakeSocket();
        socket.connectImpl = () => new Promise(() => undefined);
        sockets.push(socket);
        return socket;
      },
    });

    await expect(client.connect({ host: '127.0.0.1', port: 4455 })).rejects.toThrowError(
      /did not answer within/,
    );
  });
});

describe('OBS client state synchronisation', () => {
  it('follows scene, stream and record changes made directly in OBS', async () => {
    const { client, sockets } = setup();
    await client.connect({ host: '127.0.0.1', port: 4455 });
    const socket = sockets[0];

    const seen: Array<{ sceneName: string | null; isStreaming: boolean; isRecording: boolean }> = [];
    client.subscribe((status) => {
      seen.push({
        sceneName: status.sceneName,
        isStreaming: status.isStreaming,
        isRecording: status.isRecording,
      });
    });

    socket?.emit('CurrentProgramSceneChanged', { sceneName: 'Main' });
    socket?.emit('StreamStateChanged', { outputActive: true, outputState: 'OBS_WEBSOCKET_OUTPUT_STARTED' });
    socket?.emit('RecordStateChanged', { outputActive: true, outputState: 'OBS_WEBSOCKET_OUTPUT_STARTED' });

    expect(client.snapshot()).toMatchObject({
      sceneName: 'Main',
      isStreaming: true,
      isRecording: true,
    });
    expect(seen).toEqual([
      { sceneName: 'Main', isStreaming: false, isRecording: false },
      { sceneName: 'Main', isStreaming: true, isRecording: false },
      { sceneName: 'Main', isStreaming: true, isRecording: true },
    ]);
  });

  it('resets to disconnected when OBS closes the connection', async () => {
    const { client, sockets } = setup();
    await client.connect({ host: '127.0.0.1', port: 4455 });

    sockets[0]?.emit('ConnectionClosed', { code: 1006, message: 'closed' });

    expect(client.isConnected()).toBe(false);
    expect(client.snapshot()).toMatchObject({ sceneName: null, scenes: [], isStreaming: false });
  });

  it('refreshes the scene list when OBS reports a scene change', async () => {
    const { client, sockets } = setup();
    await client.connect({ host: '127.0.0.1', port: 4455 });
    const socket = sockets[0];
    if (!socket) {
      throw new Error('missing fake socket');
    }
    socket.responses.GetSceneList = { scenes: [{ sceneName: 'New scene', sceneIndex: 0 }] };

    socket.emit('SceneListChanged', { scenes: [] });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(client.snapshot().scenes).toEqual(['New scene']);
  });
});

describe('OBS client commands', () => {
  it('refuses commands while disconnected', async () => {
    const { client } = setup();

    await expect(client.switchScene('Main')).rejects.toMatchObject({ code: 'OBS_DISCONNECTED' });
  });

  it('sends the documented OBS v5 requests for every action', async () => {
    const { client, sockets } = setup();
    await client.connect({ host: '127.0.0.1', port: 4455 });
    const socket = sockets[0];
    if (!socket) {
      throw new Error('missing fake socket');
    }
    socket.calls.length = 0;

    await client.switchScene('Main');
    await client.startStreaming();
    await client.stopStreaming();
    await client.startRecording();
    await client.stopRecording();
    await client.setInputMute('Mic/Aux', true);

    expect(socket.calls).toEqual([
      { requestType: 'SetCurrentProgramScene', data: { sceneName: 'Main' } },
      { requestType: 'StartStream', data: undefined },
      { requestType: 'StopStream', data: undefined },
      { requestType: 'StartRecord', data: undefined },
      { requestType: 'StopRecord', data: undefined },
      { requestType: 'SetInputMute', data: { inputName: 'Mic/Aux', inputMuted: true } },
    ]);
    expect(client.snapshot()).toMatchObject({
      sceneName: 'Main',
      isStreaming: false,
      isRecording: false,
      mutedInputs: { 'Mic/Aux': true },
    });
  });

  it('reads the current mute state of an input', async () => {
    const { client, sockets } = setup();
    await client.connect({ host: '127.0.0.1', port: 4455 });
    const socket = sockets[0];
    if (!socket) {
      throw new Error('missing fake socket');
    }

    await expect(client.getInputMute('Mic/Aux')).resolves.toBe(true);
    expect(socket.calls).toContainEqual({
      requestType: 'GetInputMute',
      data: { inputName: 'Mic/Aux' },
    });
  });

  it('times out a request that OBS never answers', async () => {
    const { client, sockets } = setup({ requestTimeoutMs: 20 });
    await client.connect({ host: '127.0.0.1', port: 4455 });

    sockets[0]?.stall('SetCurrentProgramScene');

    await expect(client.switchScene('Main')).rejects.toMatchObject({ code: 'ACTION_TIMEOUT' });
  });

  it('turns an OBS error into a readable failure', async () => {
    const { client, sockets } = setup();
    await client.connect({ host: '127.0.0.1', port: 4455 });
    const socket = sockets[0];
    if (!socket) {
      throw new Error('missing fake socket');
    }
    socket.responses.GetSceneList = {};

    await expect(client.listScenes()).resolves.toEqual([]);
    expect(socket.requestedTypes()).toContain('GetSceneList');
  });

  it('disconnects and clears the state on request', async () => {
    const { client, sockets } = setup();
    await client.connect({ host: '127.0.0.1', port: 4455 });

    await client.disconnect();

    expect(sockets[0]?.disconnected).toBe(true);
    expect(client.isConnected()).toBe(false);
    expect(client.snapshot()).toMatchObject({ scenes: [], sceneName: null });
  });
});
