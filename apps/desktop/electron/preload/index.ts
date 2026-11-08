import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import {
  ipcChannels,
  navigationRequestSchema,
  obsSnapshotSchema,
  remoteServerStatusSchema,
  type ActionCatalogEntry,
  type ActionExecutionResult,
  type ActionRecord,
  type ActivityLog,
  type AppInfo,
  type ConDeckBridge,
  type DashboardSummary,
  type Deck,
  type DeckButtonWithAction,
  type DeckDetail,
  type DeckPage,
  type DeckSummary,
  type DeletedRef,
  type Device,
  type IpcChannel,
  type IpcFailure,
  type IpcResult,
  type ObsSnapshot,
  type ObsTestResult,
  type Profile,
  type RemotePairing,
  type RemoteServerStatus,
  type SaveObsSettingsInput,
  type SaveRemoteSettingsInput,
} from '@condeck/shared';

const allowedChannels = new Set<string>(ipcChannels);

const CHANNEL_NOT_ALLOWED: IpcFailure = {
  ok: false,
  error: { code: 'NOT_AVAILABLE', message: 'This action is not available in the current build.' },
};

/**
 * Only channels listed in the shared IPC contract can be reached from the
 * renderer. Nothing else (no Node API, no ipcRenderer) is exposed.
 */
function invoke<T>(channel: IpcChannel, input?: unknown): Promise<IpcResult<T>> {
  if (!allowedChannels.has(channel)) {
    return Promise.resolve(CHANNEL_NOT_ALLOWED);
  }
  return ipcRenderer.invoke(channel, input) as Promise<IpcResult<T>>;
}

const bridge: ConDeckBridge = {
  getAppInfo: () => invoke<AppInfo>('app:get-info'),
  getDashboardSummary: () => invoke<DashboardSummary>('dashboard:get-summary'),

  listProfiles: () => invoke<Profile[]>('profiles:list'),
  createProfile: (input) => invoke<Profile>('profiles:create', input),
  updateProfile: (input) => invoke<Profile>('profiles:update', input),
  setActiveProfile: (input) => invoke<Profile>('profiles:set-active', input),
  deleteProfile: (input) => invoke<DeletedRef>('profiles:delete', input),

  listDecks: (input) => invoke<DeckSummary[]>('decks:list', input),
  getDeck: (input) => invoke<DeckDetail>('decks:get', input),
  createDeck: (input) => invoke<DeckDetail>('decks:create', input),
  updateDeck: (input) => invoke<Deck>('decks:update', input),
  deleteDeck: (input) => invoke<DeletedRef>('decks:delete', input),

  createPage: (input) => invoke<DeckDetail>('pages:create', input),
  updatePage: (input) => invoke<DeckPage>('pages:update', input),
  deletePage: (input) => invoke<DeckDetail>('pages:delete', input),

  createButton: (input) => invoke<DeckButtonWithAction>('buttons:create', input),
  updateButton: (input) => invoke<DeckButtonWithAction>('buttons:update', input),
  deleteButton: (input) => invoke<DeletedRef>('buttons:delete', input),
  duplicateButton: (input) => invoke<DeckButtonWithAction>('buttons:duplicate', input),

  getActionCatalog: () => invoke<ActionCatalogEntry[]>('actions:catalog'),
  setAction: (input) => invoke<ActionRecord>('actions:set', input),
  deleteAction: (input) => invoke<DeletedRef>('actions:delete', input),
  executeAction: (input) => invoke<ActionExecutionResult>('actions:execute', input),

  onNavigationRequest(listener) {
    const handler = (_event: IpcRendererEvent, payload: unknown): void => {
      const parsed = navigationRequestSchema.safeParse(payload);
      if (parsed.success) {
        listener(parsed.data);
      }
    };

    ipcRenderer.on('navigation:request', handler);
    return () => {
      ipcRenderer.removeListener('navigation:request', handler);
    };
  },

  getObsSnapshot: () => invoke<ObsSnapshot>('obs:get-snapshot'),
  saveObsSettings: (input: SaveObsSettingsInput) =>
    invoke<ObsSnapshot>('obs:save-settings', input),
  connectObs: () => invoke<ObsSnapshot>('obs:connect'),
  disconnectObs: () => invoke<ObsSnapshot>('obs:disconnect'),
  testObsConnection: (input: SaveObsSettingsInput) =>
    invoke<ObsTestResult>('obs:test-connection', input),
  listObsScenes: () => invoke<string[]>('obs:list-scenes'),

  onObsStatus(listener) {
    const handler = (_event: IpcRendererEvent, payload: unknown): void => {
      const parsed = obsSnapshotSchema.safeParse(payload);
      if (parsed.success) {
        listener(parsed.data);
      }
    };

    ipcRenderer.on('obs:status', handler);
    return () => {
      ipcRenderer.removeListener('obs:status', handler);
    };
  },

  listDevices: () => invoke<Device[]>('devices:list'),
  revokeDevice: (input) => invoke<Device>('devices:revoke', input),

  getRemoteStatus: () => invoke<RemoteServerStatus>('remote:get-status'),
  saveRemoteSettings: (input: SaveRemoteSettingsInput) =>
    invoke<RemoteServerStatus>('remote:save-settings', input),
  startRemoteServer: () => invoke<RemoteServerStatus>('remote:start'),
  stopRemoteServer: () => invoke<RemoteServerStatus>('remote:stop'),
  createRemotePairing: () => invoke<RemotePairing>('remote:create-pairing'),

  onRemoteStatus(listener) {
    const handler = (_event: IpcRendererEvent, payload: unknown): void => {
      const parsed = remoteServerStatusSchema.safeParse(payload);
      if (parsed.success) {
        listener(parsed.data);
      }
    };

    ipcRenderer.on('remote:status', handler);
    return () => {
      ipcRenderer.removeListener('remote:status', handler);
    };
  },

  listActivity: (input) => invoke<ActivityLog[]>('activity:list', input ?? {}),
};

contextBridge.exposeInMainWorld('condeck', bridge);
