import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ActionPorts } from '@condeck/action-engine';
import { openDatabase, type ConDeckDatabase } from '@condeck/database';
import {
  actionTypes,
  AppError,
  ipcChannels,
  type ActionCatalogEntry,
  type ActionExecutionResult,
  type AppInfo,
  type DeckButton,
  type DeckButtonWithAction,
  type DeckDetail,
  type IpcResult,
  type NavigationRequest,
  type ObsSnapshot,
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
const { createActionService } = await import('../services/action.service');
type ObsService = import('../services/obs.service').ObsService;
type RemoteService = import('../services/remote.service').RemoteService;

const appInfo: AppInfo = {
  name: 'StreamKey',
  version: '0.1.0-test',
  platform: 'win32 x64',
  isPackaged: false,
  databasePath: 'C:/tmp/condeck.db',
  logPath: 'C:/tmp/condeck.log',
};

let workDir: string;
let database: ConDeckDatabase;
let invoke: (channel: string, payload?: unknown) => Promise<IpcResult<unknown>>;
let navigationRequests: NavigationRequest[];
let actionPorts: ActionPorts;
let obsService: ObsService;
let remoteService: RemoteService;

beforeEach(() => {
  registeredHandlers.clear();
  workDir = mkdtempSync(join(tmpdir(), 'condeck-ipc-'));
  database = openDatabase({ filePath: join(workDir, 'condeck.db') });

  navigationRequests = [];
  const obsUnavailable = vi.fn(async () => {
    throw new AppError('OBS_DISCONNECTED', 'OBS is not connected.');
  });
  actionPorts = {
    tiktok: {
      isConnected: () => false,
      getState: () => null,
      switchScene: obsUnavailable,
      setSourceVisible: obsUnavailable,
      setMicMuted: obsUnavailable,
      setAudioMuted: obsUnavailable,
      setRecording: obsUnavailable,
    },
    obs: {
      isConnected: () => false,
      switchScene: obsUnavailable,
      startStreaming: obsUnavailable,
      stopStreaming: obsUnavailable,
      startRecording: obsUnavailable,
      stopRecording: obsUnavailable,
      getInputMute: obsUnavailable,
      setInputMute: obsUnavailable,
    },
    system: {
      openApplication: vi.fn(async () => undefined),
      openUrl: vi.fn(async () => undefined),
    },
    soundboard: {
      play: vi.fn(async () => 'Airhorn'),
    },
    navigation: {
      navigate: (direction, context) => {
        navigationRequests.push({ direction, buttonId: context.buttonId });
      },
    },
  };

  const baseSnapshot: ObsSnapshot = {
    state: 'NOT_CONFIGURED',
    message: null,
    host: null,
    port: null,
    isEnabled: false,
    hasPassword: false,
    sceneName: null,
    scenes: [],
    isStreaming: false,
    isRecording: false,
    mutedInputs: {},
  };

  obsService = {
    getSnapshot: () => baseSnapshot,
    saveSettings: vi.fn((input) => ({
      ...baseSnapshot,
      state: 'DISCONNECTED' as const,
      host: input.host,
      port: input.port,
      isEnabled: input.isEnabled,
      hasPassword: input.password !== undefined && input.password !== '',
    })),
    connect: vi.fn(async () => ({ ...baseSnapshot, state: 'CONNECTED' as const })),
    disconnect: vi.fn(async () => ({ ...baseSnapshot, state: 'DISCONNECTED' as const })),
    testConnection: vi.fn(async () => ({
      ok: true,
      message: 'Connected to OBS at 127.0.0.1:4455.',
      scenes: ['Main'],
    })),
    listScenes: vi.fn(async () => ['Main', 'Starting soon']),
    getStatus: () => ({ state: 'NOT_CONFIGURED' as const, message: null }),
    getActionPort: () => actionPorts.obs,
    dispose: vi.fn(async () => undefined),
  };

  remoteService = {
    initialize: vi.fn(async () => undefined),
    getStatus: () => ({
      state: 'stopped' as const,
      isEnabled: true,
      port: 43821,
      addresses: [],
      error: null,
      pairing: null,
      connectedDevices: [],
    }),
    saveSettings: vi.fn(async (input) => ({
      state: 'running' as const,
      isEnabled: input.isEnabled,
      port: input.port,
      addresses: [`http://192.168.1.10:${input.port}`],
      error: null,
      pairing: null,
      connectedDevices: [],
    })),
    start: vi.fn(async () => ({
      state: 'running' as const,
      isEnabled: true,
      port: 43821,
      addresses: ['http://192.168.1.10:43821'],
      error: null,
      pairing: null,
      connectedDevices: [],
    })),
    stop: vi.fn(async () => ({
      state: 'stopped' as const,
      isEnabled: true,
      port: 43821,
      addresses: [],
      error: null,
      pairing: null,
      connectedDevices: [],
    })),
    createPairing: vi.fn(async () => ({
      token: 'a'.repeat(43),
      expiresAt: '2026-01-01T10:02:00.000Z',
      url: `http://192.168.1.10:43821/#pair=${'a'.repeat(43)}`,
      qrDataUrl: 'data:image/png;base64,AAA',
    })),
    revokeDevice: vi.fn(() => {
      throw new AppError('NOT_FOUND', 'Device not found.');
    }),
    notifyDeckChanged: vi.fn(),
    notifyObsStatus: vi.fn(),
    notifyTikTokStatus: vi.fn(),
    dispose: vi.fn(async () => undefined),
  };

  registerIpcHandlers({
    logger: new FileLogger(join(workDir, 'logs', 'condeck.log')),
    db: database.db,
    getAppInfo: () => appInfo,
    actions: createActionService({ db: database.db, ports: actionPorts }),
    sounds: {
      list: vi.fn(() => []),
      import: vi.fn(async () => []),
      remove: vi.fn(async (soundId: string) => ({ id: soundId })),
      audio: vi.fn(async (soundId: string) => ({ soundId, dataUrl: 'data:audio/wav;base64,AA==' })),
      play: vi.fn(() => ({ id: 'x', name: 'Airhorn' })),
    } as unknown as import('../services/sound.service').SoundService,
    obs: obsService,
    tiktok: null as unknown as never,
    remote: remoteService,
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

describe('action engine channels', () => {
  async function seedButton(): Promise<{ button: DeckButtonWithAction; deckId: string }> {
    const profile = await invoke('profiles:create', { name: 'Streaming' });
    if (!profile.ok) {
      throw new Error('profile creation failed');
    }

    const created = await invoke('decks:create', {
      profileId: (profile.data as Profile).id,
      name: 'Main deck',
      columns: 3,
      rows: 3,
    });
    if (!created.ok) {
      throw new Error('deck creation failed');
    }
    const detail = created.data as DeckDetail;
    const pageId = detail.pages[0]?.id ?? '';

    const button = await invoke('buttons:create', { pageId, position: 0, label: 'Mic mute' });
    if (!button.ok) {
      throw new Error('button creation failed');
    }

    return { button: button.data as DeckButtonWithAction, deckId: detail.deck.id };
  }

  it('exposes the full action catalog', async () => {
    const result = await invoke('actions:catalog');

    expect(result.ok).toBe(true);
    if (result.ok) {
      const catalog = result.data as ActionCatalogEntry[];
      expect(catalog.map((entry) => entry.type).sort()).toEqual([...actionTypes].sort());
    }
  });

  it('saves an action and returns it with the deck detail', async () => {
    const { button, deckId } = await seedButton();

    const saved = await invoke('actions:set', {
      buttonId: button.id,
      actionType: 'OBS_TOGGLE_MUTE',
      config: { inputName: 'Mic/Aux' },
    });
    expect(saved.ok).toBe(true);

    const detail = await invoke('decks:get', { deckId });
    expect(detail.ok).toBe(true);
    if (detail.ok) {
      const refreshed = detail.data as DeckDetail;
      expect(refreshed.pages[0]?.buttons[0]?.action?.actionType).toBe('OBS_TOGGLE_MUTE');
    }
  });

  it('rejects an action configuration that breaks the schema', async () => {
    const { button } = await seedButton();

    const result = await invoke('actions:set', {
      buttonId: button.id,
      actionType: 'SYSTEM_OPEN_URL',
      config: { url: 'not-a-url' },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_INPUT');
    }
  });

  it('executes a navigation action and forwards the page change', async () => {
    const { button } = await seedButton();
    await invoke('actions:set', {
      buttonId: button.id,
      actionType: 'NAV_NEXT_PAGE',
      config: {},
    });

    const result = await invoke('actions:execute', { buttonId: button.id });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const execution = result.data as ActionExecutionResult;
      expect(execution.status).toBe('SUCCESS');
      expect(execution.buttonId).toBe(button.id);
    }
    expect(navigationRequests).toEqual([{ direction: 'next', buttonId: button.id }]);
  });

  it('reports an OBS action as failed while OBS is not connected', async () => {
    const { button } = await seedButton();
    await invoke('actions:set', {
      buttonId: button.id,
      actionType: 'OBS_SWITCH_SCENE',
      config: { sceneName: 'Starting soon' },
    });

    const result = await invoke('actions:execute', { buttonId: button.id });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const execution = result.data as ActionExecutionResult;
      expect(execution.status).toBe('FAILED');
      expect(execution.code).toBe('OBS_DISCONNECTED');
      expect(execution.message).toContain('OBS');
    }
  });

  it('refuses to execute a button without an action', async () => {
    const { button } = await seedButton();

    const result = await invoke('actions:execute', { buttonId: button.id });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });

  it('refuses to execute a disabled button', async () => {
    const { button } = await seedButton();
    await invoke('actions:set', {
      buttonId: button.id,
      actionType: 'NAV_NEXT_PAGE',
      config: {},
    });
    await invoke('buttons:update', { buttonId: button.id, isEnabled: false });

    const result = await invoke('actions:execute', { buttonId: button.id });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_INPUT');
    }
    expect(navigationRequests).toEqual([]);
  });

  it('removes an action from a button', async () => {
    const { button, deckId } = await seedButton();
    await invoke('actions:set', {
      buttonId: button.id,
      actionType: 'NAV_PREV_PAGE',
      config: {},
    });

    const removed = await invoke('actions:delete', { buttonId: button.id });
    expect(removed.ok).toBe(true);

    const detail = await invoke('decks:get', { deckId });
    expect(detail.ok).toBe(true);
    if (detail.ok) {
      expect((detail.data as DeckDetail).pages[0]?.buttons[0]?.action).toBeNull();
    }
  });

  it('logs action execution in the activity feed', async () => {
    const { button } = await seedButton();
    await invoke('actions:set', {
      buttonId: button.id,
      actionType: 'NAV_NEXT_PAGE',
      config: {},
    });
    await invoke('actions:execute', { buttonId: button.id });

    const result = await invoke('activity:list', { limit: 5 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const logs = result.data as Array<{ eventType: string }>;
      expect(logs.map((entry) => entry.eventType)).toContain('ACTION_EXECUTED');
    }
  });
});

describe('OBS channels', () => {
  it('returns the saved configuration and live state', async () => {
    const result = await invoke('obs:get-snapshot');

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({ state: 'NOT_CONFIGURED', scenes: [] }),
    });
  });

  it('saves settings and records the change in the activity feed', async () => {
    const result = await invoke('obs:save-settings', {
      host: '192.168.1.20',
      port: 4455,
      isEnabled: true,
      password: 'secret',
    });

    expect(result).toMatchObject({
      ok: true,
      data: { host: '192.168.1.20', port: 4455, hasPassword: true },
    });
    expect(obsService.saveSettings).toHaveBeenCalledWith({
      host: '192.168.1.20',
      port: 4455,
      isEnabled: true,
      password: 'secret',
    });

    const activity = await invoke('activity:list', { limit: 10 });
    const logs = activity.ok ? (activity.data as Array<{ eventType: string }>) : [];
    expect(logs.some((log) => log.eventType === 'OBS_SETTINGS_SAVED')).toBe(true);
  });

  it('rejects an out-of-range port before touching the service', async () => {
    const result = await invoke('obs:save-settings', {
      host: '127.0.0.1',
      port: 70000,
      isEnabled: true,
    });

    expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
    expect(obsService.saveSettings).not.toHaveBeenCalled();
  });

  it('reports a refused connection as a failure and logs it', async () => {
    obsService.connect = vi.fn(async () => {
      throw new AppError('OBS_CONNECTION_FAILED', 'Could not connect to OBS at 127.0.0.1:4455.');
    });

    const result = await invoke('obs:connect');

    expect(result).toMatchObject({ ok: false, error: { code: 'NOT_AVAILABLE' } });
    const activity = await invoke('activity:list', { limit: 10 });
    const logs = activity.ok ? (activity.data as Array<{ eventType: string }>) : [];
    expect(logs.some((log) => log.eventType === 'OBS_CONNECTION_FAILED')).toBe(true);
  });

  it('connects and disconnects through the OBS service', async () => {
    const connected = await invoke('obs:connect');
    const disconnected = await invoke('obs:disconnect');

    expect(connected).toMatchObject({ ok: true, data: { state: 'CONNECTED' } });
    expect(disconnected).toMatchObject({ ok: true, data: { state: 'DISCONNECTED' } });
  });

  it('probes the address from the form without saving it', async () => {
    const result = await invoke('obs:test-connection', {
      host: '10.0.0.5',
      port: 4460,
      isEnabled: true,
    });

    expect(result).toMatchObject({ ok: true, data: { ok: true, scenes: ['Main'] } });
    expect(obsService.testConnection).toHaveBeenCalledWith({
      host: '10.0.0.5',
      port: 4460,
      isEnabled: true,
    });
  });

  it('lists the scenes for the action editor', async () => {
    const result = await invoke('obs:list-scenes');

    expect(result).toEqual({ ok: true, data: ['Main', 'Starting soon'] });
  });
});
