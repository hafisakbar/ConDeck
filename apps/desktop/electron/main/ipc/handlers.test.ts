import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase, type ConDeckDatabase } from '@condeck/database';
import { ipcChannels, type AppInfo, type IpcResult, type Profile } from '@condeck/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Handler = (event: unknown, payload: unknown) => Promise<IpcResult<unknown>>;
const registeredHandlers = new Map<string, Handler>();

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: Handler) => {
      registeredHandlers.set(channel, handler);
    },
    removeHandler: (channel: string) => {
      registeredHandlers.delete(channel);
    },
  },
}));

const { registerIpcHandlers } = await import('./handlers');
const { FileLogger } = await import('../logger');

const appInfo: AppInfo = {
  name: 'ConDeck',
  version: '0.1.0-test',
  platform: 'win32 x64',
  isPackaged: false,
  databasePath: 'C:/tmp/condeck.db',
  logPath: 'C:/tmp/condeck.log',
};

let workDir: string;
let database: ConDeckDatabase;
let invoke: (channel: string, payload?: unknown) => Promise<IpcResult<unknown>>;

beforeEach(() => {
  registeredHandlers.clear();
  workDir = mkdtempSync(join(tmpdir(), 'condeck-ipc-'));
  database = openDatabase({ filePath: join(workDir, 'condeck.db') });
  registerIpcHandlers({
    logger: new FileLogger(join(workDir, 'logs', 'condeck.log')),
    db: database.db,
    getAppInfo: () => appInfo,
  });

  invoke = (channel, payload) => {
    const handler = registeredHandlers.get(channel);
    if (!handler) {
      throw new Error(`Channel ${channel} is not registered.`);
    }
    return handler({}, payload);
  };
});

afterEach(() => {
  database.close();
  rmSync(workDir, { recursive: true, force: true });
});

describe('ipc allowlist', () => {
  it('registers exactly the channels declared in the shared contract', () => {
    expect([...registeredHandlers.keys()].sort()).toEqual([...ipcChannels].sort());
  });
});

describe('ipc handlers', () => {
  it('returns the application info', async () => {
    const result = await invoke('app:get-info');

    expect(result).toEqual({ ok: true, data: appInfo });
  });

  it('creates a profile and reports it as the active one', async () => {
    const created = await invoke('profiles:create', { name: 'Streaming' });
    expect(created.ok).toBe(true);

    const summary = await invoke('dashboard:get-summary');
    expect(summary.ok).toBe(true);
    if (summary.ok) {
      const data = summary.data as { profile: { active: Profile | null; total: number } };
      expect(data.profile.total).toBe(1);
      expect(data.profile.active?.name).toBe('Streaming');
    }
  });

  it('rejects an empty profile name with INVALID_INPUT', async () => {
    const result = await invoke('profiles:create', { name: '   ' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_INPUT');
    }
  });

  it('rejects a malformed profile id instead of touching the database', async () => {
    const result = await invoke('profiles:set-active', { profileId: 'nope' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_INPUT');
    }
  });

  it('maps a missing profile to NOT_FOUND', async () => {
    const result = await invoke('profiles:set-active', {
      profileId: '9b2f3c1d-7b1e-4d3a-9c2b-1a2b3c4d5e6f',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });

  it('returns activity newest first, including the created profile', async () => {
    await invoke('profiles:create', { name: 'Gaming' });

    const result = await invoke('activity:list', { limit: 5 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const logs = result.data as Array<{ eventType: string }>;
      expect(logs[0]?.eventType).toBe('PROFILE_CREATED');
    }
  });
});
