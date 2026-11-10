import { ipcChannels, type ConDeckBridge } from '@condeck/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const exposed: Record<string, unknown> = {};
const invoked: string[] = [];

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: vi.fn((key: string, value: unknown) => {
      exposed[key] = value;
    }),
  },
  ipcRenderer: {
    invoke: vi.fn((channel: string) => {
      invoked.push(channel);
      return Promise.resolve({ ok: true, data: null });
    }),
    on: vi.fn(),
    removeListener: vi.fn(),
  },
}));

describe('preload bridge', () => {
  beforeEach(() => {
    vi.resetModules();
    invoked.length = 0;
  });

  it('exposes the bridge under a single name and nothing else', async () => {
    await import('./index');

    expect(Object.keys(exposed)).toEqual(['condeck']);
    const bridge = exposed.condeck as Record<string, unknown>;
    for (const forbidden of ['invoke', 'send', 'ipcRenderer', 'require', 'process', 'shell']) {
      expect(bridge).not.toHaveProperty(forbidden);
    }
  });

  it('only invokes channels that exist in the shared IPC contract', async () => {
    await import('./index');
    const bridge = exposed.condeck as unknown as ConDeckBridge;

    for (const [name, value] of Object.entries(bridge)) {
      if (name === 'onNavigationRequest' || name === 'onObsStatus' || name === 'onRemoteStatus') {
        // Subscription helpers open listeners, they do not invoke channels.
        continue;
      }
      if (typeof value === 'function') {
        await (value as (input?: unknown) => Promise<unknown>)({});
      }
    }

    const allowlist = new Set<string>(ipcChannels);
    expect(invoked.length).toBeGreaterThan(0);
    for (const channel of invoked) {
      expect(allowlist.has(channel)).toBe(true);
    }
  });
});
