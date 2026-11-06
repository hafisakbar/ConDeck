import { contextBridge, ipcRenderer } from 'electron';
import {
  ipcChannels,
  type ActivityLog,
  type AppInfo,
  type ConDeckBridge,
  type DashboardSummary,
  type Deck,
  type DeckButton,
  type DeckDetail,
  type DeckPage,
  type DeckSummary,
  type DeletedRef,
  type Device,
  type IpcChannel,
  type IpcFailure,
  type IpcResult,
  type Profile,
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

  createButton: (input) => invoke<DeckButton>('buttons:create', input),
  updateButton: (input) => invoke<DeckButton>('buttons:update', input),
  deleteButton: (input) => invoke<DeletedRef>('buttons:delete', input),
  duplicateButton: (input) => invoke<DeckButton>('buttons:duplicate', input),

  listDevices: () => invoke<Device[]>('devices:list'),
  listActivity: (input) => invoke<ActivityLog[]>('activity:list', input ?? {}),
};

contextBridge.exposeInMainWorld('condeck', bridge);
