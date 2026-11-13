import { AppError, type TikTokState } from '@condeck/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTikTokClient } from './client';
import type { StudioRuntime } from './discovery';
import type { LiveStudioSocket, LiveStudioSocketOptions } from './socket';

const liveState: TikTokState = {
  sceneName: 'Main',
  scenes: [
    {
      name: 'Main',
      sources: [
        { label: 'Camera', value: 'cam-1' },
        { label: 'Overlay', value: 'overlay-1' },
      ],
      visibleSources: [{ label: 'Camera', value: 'cam-1' }],
    },
  ],
  micMuted: false,
  audioMuted: false,
  recording: false,
  streamStatus: 2,
};

function runtime(overrides: Partial<StudioRuntime> = {}): StudioRuntime {
  return {
    running: true,
    appVersion: '1.33.2.100',
    executablePath: 'C:\\TikTok LIVE Studio.exe',
    processes: [],
    listeningPorts: [41000],
    error: null,
    ...overrides,
  };
}

interface FakeSocket {
  socket: LiveStudioSocket;
  calls: Array<{ actionId: string; settings: Record<string, unknown> }>;
  drop: () => void;
  joined: () => boolean;
}

function makeSocket(options: LiveStudioSocketOptions, behaviour: { failAction?: boolean } = {}): FakeSocket {
  let connected = false;
  let state: TikTokState = structuredClone(liveState);
  let disconnectListener: ((reason: string) => void) | null = null;
  const calls: Array<{ actionId: string; settings: Record<string, unknown> }> = [];

  const socket: LiveStudioSocket = {
    connect: vi.fn(async () => {
      if (options.port !== 41000) {
        throw new Error(`connect ECONNREFUSED 127.0.0.1:${options.port}`);
      }
      connected = true;
    }),
    isConnected: () => connected,
    sync: vi.fn(async () => state),
    action: vi.fn(async (actionId: string, settings: Record<string, unknown>) => {
      calls.push({ actionId, settings });
      if (behaviour.failAction) {
        throw new AppError('ACTION_FAILED', 'LIVE Studio rejected the action (code 1).');
      }
      if (actionId.endsWith('.scene')) {
        state = { ...state, sceneName: String(settings.scene) };
      } else if (actionId.endsWith('.source')) {
        state = {
          ...state,
          scenes: state.scenes.map((scene) => {
            if (scene.name !== settings.scene) return scene;
            const visible = scene.visibleSources.some((source) => source.value === settings.source);
            return {
              ...scene,
              visibleSources: visible
                ? scene.visibleSources.filter((source) => source.value !== settings.source)
                : [...scene.visibleSources, { label: String(settings.source), value: String(settings.source) }],
            };
          }),
        };
      } else if (actionId.endsWith('.mic')) {
        state = { ...state, micMuted: !state.micMuted };
      } else if (actionId.endsWith('.audio')) {
        state = { ...state, audioMuted: !state.audioMuted };
      } else if (actionId.endsWith('.recording')) {
        state = { ...state, recording: !state.recording };
      }
    }),
    onDisconnect(listener) {
      disconnectListener = listener;
    },
    close: vi.fn(() => {
      connected = false;
    }),
  };

  return {
    socket,
    calls,
    drop: () => {
      connected = false;
      disconnectListener?.('transport close');
    },
    joined: () => connected,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('TikTok client lifecycle', () => {
  it('connects to the discovered process port and syncs state', async () => {
    const created: FakeSocket[] = [];
    const client = createTikTokClient({
      discover: async () => runtime(),
      createSocket: (options) => {
        const fake = makeSocket(options);
        created.push(fake);
        return fake.socket;
      },
      autoReconnect: false,
    });

    const status = await client.connect();
    expect(status.state).toBe('CONNECTED');
    expect(status.port).toBe(41000);
    expect(status.version).toBe('1.33.2.100');
    expect(status.sceneName).toBe('Main');
    expect(created[0]?.socket.sync).toHaveBeenCalledTimes(1);
  });

  it('falls back to the next owned port when the first one does not answer', async () => {
    const createdPorts: number[] = [];
    const client = createTikTokClient({
      discover: async () => runtime({ listeningPorts: [42000], processes: [
        { pid: 1, name: 'TikTok LIVE Studio.exe', executablePath: null, version: null, ports: [41000] },
      ] }),
      createSocket: (options) => {
        createdPorts.push(options.port);
        return makeSocket(options).socket;
      },
      autoReconnect: false,
    });

    const status = await client.connect();
    expect(status.state).toBe('CONNECTED');
    expect(status.port).toBe(41000);
    expect(createdPorts).toEqual([42000, 41000]);
  });

  it('explains a missing application instead of pretending to connect', async () => {
    const socketFactory = vi.fn();
    const client = createTikTokClient({
      discover: async () => runtime({ running: false, listeningPorts: [] }),
      createSocket: socketFactory,
      autoReconnect: false,
    });

    const status = await client.connect();
    expect(status.state).toBe('DISCONNECTED');
    expect(status.found).toBe(false);
    expect(status.message).toMatch(/Open TikTok LIVE Studio/i);
    expect(socketFactory).not.toHaveBeenCalled();
  });

  it('refuses an unsupported version without opening a socket', async () => {
    const socketFactory = vi.fn();
    const client = createTikTokClient({
      discover: async () => runtime({ appVersion: '1.20.0' }),
      createSocket: socketFactory,
      autoReconnect: false,
    });

    const status = await client.connect();
    expect(status.state).toBe('UNSUPPORTED_VERSION');
    expect(status.message).toMatch(/not supported/i);
    expect(socketFactory).not.toHaveBeenCalled();
  });

  it('collapses concurrent connect calls into one connection', async () => {
    const discover = vi.fn(async () => runtime());
    const createSocket = vi.fn((options: LiveStudioSocketOptions) => makeSocket(options).socket);
    const client = createTikTokClient({ discover, createSocket, autoReconnect: false });

    const [first, second] = await Promise.all([client.connect(), client.connect()]);
    expect(first.state).toBe('CONNECTED');
    expect(second.state).toBe('CONNECTED');
    expect(discover).toHaveBeenCalledTimes(1);
    expect(createSocket).toHaveBeenCalledTimes(1);
  });

  it('disconnects cleanly and clears the live state', async () => {
    const fake = makeSocket({ port: 41000 });
    const client = createTikTokClient({
      discover: async () => runtime(),
      createSocket: () => fake.socket,
      autoReconnect: false,
    });

    await client.connect();
    const status = await client.disconnect();
    expect(status.state).toBe('DISCONNECTED');
    expect(fake.socket.close).toHaveBeenCalled();
    expect(client.getState()).toBeNull();
  });

  it('rediscovers the application after the socket drops', async () => {
    vi.useFakeTimers();
    const discover = vi.fn(async () => runtime());
    let current = makeSocket({ port: 41000 });
    const client = createTikTokClient({
      discover,
      createSocket: () => {
        current = makeSocket({ port: 41000 });
        return current.socket;
      },
      rediscoveryDelayMs: 10,
    });

    await client.connect();
    current.drop();
    expect(client.getStatus().state).toBe('RECONNECTING');

    await vi.advanceTimersByTimeAsync(20);
    expect(discover).toHaveBeenCalledTimes(2);
    expect(client.getStatus().state).toBe('CONNECTED');
  });
});

describe('TikTok actions', () => {
  async function connectedClient(behaviour: { failAction?: boolean } = {}) {
    const fake = makeSocket({ port: 41000 }, behaviour);
    const client = createTikTokClient({
      discover: async () => runtime(),
      createSocket: () => fake.socket,
      autoReconnect: false,
    });
    await client.connect();
    return { client, fake };
  }

  it('dispatches a verified scene action and checks the new scene', async () => {
    const { client, fake } = await connectedClient();
    const state = await client.switchScene('Main');
    expect(fake.calls[0]).toEqual({
      actionId: 'com.tiktok.livestudio.scene',
      settings: { scene: 'Main' },
    });
    expect(state.sceneName).toBe('Main');
  });

  it('fails when LIVE Studio acknowledges a scene change it did not apply', async () => {
    const fake = makeSocket({ port: 41000 });
    fake.socket.action = vi.fn(async () => undefined);
    const client = createTikTokClient({
      discover: async () => runtime(),
      createSocket: () => fake.socket,
      autoReconnect: false,
    });
    await client.connect();
    await expect(client.switchScene('Starting soon')).rejects.toThrow(/active scene/i);
  });

  it('toggles the microphone once and verifies the resulting state', async () => {
    const { client, fake } = await connectedClient();
    const state = await client.setMicMuted(true);
    expect(state.micMuted).toBe(true);
    expect(fake.calls).toHaveLength(1);

    await client.setMicMuted(true);
    expect(fake.calls).toHaveLength(1);
  });

  it('does not retry an action whose outcome is unknown', async () => {
    const { client, fake } = await connectedClient({ failAction: true });
    await expect(client.setMicMuted(true)).rejects.toThrow(/rejected the action/i);
    expect(fake.calls).toHaveLength(1);
  });

  it('hides a source and verifies visibility', async () => {
    const { client } = await connectedClient();
    const state = await client.setSourceVisible('Main', 'cam-1', false);
    expect(state.scenes[0]?.visibleSources).toEqual([]);
  });

  it('rejects a source that is not part of the scene', async () => {
    const { client, fake } = await connectedClient();
    await expect(client.setSourceVisible('Main', 'missing', true)).rejects.toThrow(/not present/i);
    expect(fake.calls).toHaveLength(0);
  });

  it('refuses actions while disconnected', async () => {
    const client = createTikTokClient({
      discover: async () => runtime({ running: false }),
      autoReconnect: false,
    });
    await expect(client.switchScene('Main')).rejects.toMatchObject({ code: 'TIKTOK_DISCONNECTED' });
  });

  it('tests the connection without leaving a probe open', async () => {
    const fake = makeSocket({ port: 41000 });
    const client = createTikTokClient({
      discover: async () => runtime(),
      createSocket: () => fake.socket,
      autoReconnect: false,
    });
    const result = await client.test();
    expect(result.ok).toBe(true);
    expect(result.scenes).toEqual(['Main']);
    expect(fake.socket.close).toHaveBeenCalled();
  });
});
