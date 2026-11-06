import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase, type ConDeckDatabase } from '@condeck/database';
import {
  ipcChannels,
  type AppInfo,
  type DeckButton,
  type DeckDetail,
  type IpcResult,
  type Profile,
} from '@condeck/shared';
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

describe('deck builder channels', () => {
  async function seedDeck(): Promise<{ profileId: string; detail: DeckDetail }> {
    const profile = await invoke('profiles:create', { name: 'Streaming' });
    expect(profile.ok).toBe(true);
    if (!profile.ok) {
      throw new Error('profile creation failed');
    }
    const profileId = (profile.data as Profile).id;

    const created = await invoke('decks:create', {
      profileId,
      name: 'Main deck',
      columns: 3,
      rows: 3,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error('deck creation failed');
    }
    return { profileId, detail: created.data as DeckDetail };
  }

  it('creates a deck with a default page and reads it back', async () => {
    const { detail } = await seedDeck();
    expect(detail.pages).toHaveLength(1);
    expect(detail.pages[0]?.name).toBe('Main');

    const fetched = await invoke('decks:get', { deckId: detail.deck.id });
    expect(fetched.ok).toBe(true);
    if (fetched.ok) {
      expect((fetched.data as DeckDetail).deck.name).toBe('Main deck');
    }
  });

  it('rejects a grid bigger than the supported bounds', async () => {
    const { profileId } = await seedDeck();

    const result = await invoke('decks:create', {
      profileId,
      name: 'Too big',
      columns: 12,
      rows: 3,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_INPUT');
    }
  });

  it('creates and moves buttons, and reports a taken slot as CONFLICT', async () => {
    const { detail } = await seedDeck();
    const pageId = detail.pages[0]?.id ?? '';

    const first = await invoke('buttons:create', { pageId, position: 0, label: 'Go live' });
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    const button = first.data as DeckButton;

    const moved = await invoke('buttons:update', { buttonId: button.id, position: 4 });
    expect(moved.ok).toBe(true);
    if (moved.ok) {
      expect((moved.data as DeckButton).position).toBe(4);
    }

    const conflict = await invoke('buttons:create', { pageId, position: 4, label: 'Copy' });
    expect(conflict.ok).toBe(false);
    if (!conflict.ok) {
      expect(conflict.error.code).toBe('CONFLICT');
    }
  });

  it('deletes a page and renumbers the remaining pages', async () => {
    const { detail } = await seedDeck();

    const withPage = await invoke('pages:create', { deckId: detail.deck.id, name: 'Audio' });
    expect(withPage.ok).toBe(true);
    if (!withPage.ok) {
      return;
    }
    const firstPageId = (withPage.data as DeckDetail).pages[0]?.id ?? '';

    const afterDelete = await invoke('pages:delete', { pageId: firstPageId });
    expect(afterDelete.ok).toBe(true);
    if (afterDelete.ok) {
      const updated = afterDelete.data as DeckDetail;
      expect(updated.pages.map((page) => [page.name, page.position])).toEqual([['Audio', 0]]);
    }
  });
});
