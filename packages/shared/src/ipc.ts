import { z } from 'zod';
import {
  deleteActionInputSchema,
  executeActionInputSchema,
  setActionInputSchema,
  type ActionCatalogEntry,
  type ActionExecutionResult,
  type ActionRecord,
  type NavigationRequest,
} from './actions';
import {
  createButtonInputSchema,
  createDeckInputSchema,
  createPageInputSchema,
  deleteButtonInputSchema,
  deleteDeckInputSchema,
  deletePageInputSchema,
  duplicateButtonInputSchema,
  getDeckInputSchema,
  listDecksInputSchema,
  updateButtonInputSchema,
  updateDeckInputSchema,
  updatePageInputSchema,
  type Deck,
  type DeckButtonWithAction,
  type DeckDetail,
  type DeckPage,
  type DeckSummary,
} from './deck';
import {
  createProfileInputSchema,
  deleteProfileInputSchema,
  listActivityInputSchema,
  setActiveProfileInputSchema,
  updateProfileInputSchema,
} from './domain';
import type { AppInfo, Profile, Device, ActivityLog, DashboardSummary } from './domain';

/**
 * The complete IPC surface between Electron renderer and main process.
 * Every channel is listed here so the main process can enforce an allowlist
 * (TECHNICAL_SPECIFICATION.md §7) and the preload script can expose a typed API.
 */
export const ipcChannels = [
  'app:get-info',
  'dashboard:get-summary',
  'profiles:list',
  'profiles:create',
  'profiles:update',
  'profiles:set-active',
  'profiles:delete',
  'decks:list',
  'decks:get',
  'decks:create',
  'decks:update',
  'decks:delete',
  'pages:create',
  'pages:update',
  'pages:delete',
  'buttons:create',
  'buttons:update',
  'buttons:delete',
  'buttons:duplicate',
  'actions:catalog',
  'actions:set',
  'actions:delete',
  'actions:execute',
  'devices:list',
  'activity:list',
] as const;

export type IpcChannel = (typeof ipcChannels)[number];

export const ipcInputSchemas = {
  'app:get-info': z.void(),
  'dashboard:get-summary': z.void(),
  'profiles:list': z.void(),
  'profiles:create': createProfileInputSchema,
  'profiles:update': updateProfileInputSchema,
  'profiles:set-active': setActiveProfileInputSchema,
  'profiles:delete': deleteProfileInputSchema,
  'decks:list': listDecksInputSchema,
  'decks:get': getDeckInputSchema,
  'decks:create': createDeckInputSchema,
  'decks:update': updateDeckInputSchema,
  'decks:delete': deleteDeckInputSchema,
  'pages:create': createPageInputSchema,
  'pages:update': updatePageInputSchema,
  'pages:delete': deletePageInputSchema,
  'buttons:create': createButtonInputSchema,
  'buttons:update': updateButtonInputSchema,
  'buttons:delete': deleteButtonInputSchema,
  'buttons:duplicate': duplicateButtonInputSchema,
  'actions:catalog': z.void(),
  'actions:set': setActionInputSchema,
  'actions:delete': deleteActionInputSchema,
  'actions:execute': executeActionInputSchema,
  'devices:list': z.void(),
  'activity:list': listActivityInputSchema,
} as const satisfies Record<IpcChannel, z.ZodType>;

export type IpcErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'DATABASE_ERROR'
  | 'NOT_AVAILABLE'
  | 'ACTION_FAILED'
  | 'ACTION_TIMEOUT'
  | 'ACTION_BUSY'
  | 'INTERNAL_ERROR';

export interface IpcSuccess<T> {
  ok: true;
  data: T;
}

export interface IpcFailure {
  ok: false;
  error: {
    code: IpcErrorCode;
    message: string;
  };
}

export type IpcResult<T> = IpcSuccess<T> | IpcFailure;

export function ipcSuccess<T>(data: T): IpcSuccess<T> {
  return { ok: true, data };
}

export function ipcFailure(code: IpcErrorCode, message: string): IpcFailure {
  return { ok: false, error: { code, message } };
}

/** Result of deleting a record, so the renderer knows what to refresh. */
export interface DeletedRef {
  id: string;
}

export interface DeletedDeck extends DeletedRef {
  id: string;
}

/** API exposed on `window.condeck` by the preload script. */
export interface ConDeckBridge {
  getAppInfo(): Promise<IpcResult<AppInfo>>;
  getDashboardSummary(): Promise<IpcResult<DashboardSummary>>;

  listProfiles(): Promise<IpcResult<Profile[]>>;
  createProfile(input: { name: string; description?: string }): Promise<IpcResult<Profile>>;
  updateProfile(input: {
    profileId: string;
    name?: string;
    description?: string | null;
  }): Promise<IpcResult<Profile>>;
  setActiveProfile(input: { profileId: string }): Promise<IpcResult<Profile>>;
  deleteProfile(input: { profileId: string }): Promise<IpcResult<DeletedRef>>;

  listDecks(input: { profileId: string }): Promise<IpcResult<DeckSummary[]>>;
  getDeck(input: { deckId: string }): Promise<IpcResult<DeckDetail>>;
  createDeck(input: {
    profileId: string;
    name: string;
    columns: number;
    rows: number;
  }): Promise<IpcResult<DeckDetail>>;
  updateDeck(input: {
    deckId: string;
    name?: string;
    columns?: number;
    rows?: number;
  }): Promise<IpcResult<Deck>>;
  deleteDeck(input: { deckId: string }): Promise<IpcResult<DeletedRef>>;

  createPage(input: { deckId: string; name: string }): Promise<IpcResult<DeckDetail>>;
  updatePage(input: { pageId: string; name: string }): Promise<IpcResult<DeckPage>>;
  deletePage(input: { pageId: string }): Promise<IpcResult<DeckDetail>>;

  createButton(input: {
    pageId: string;
    position: number;
    label: string;
    icon?: string;
    backgroundColor?: string;
    textColor?: string;
    isEnabled?: boolean;
  }): Promise<IpcResult<DeckButtonWithAction>>;
  updateButton(input: {
    buttonId: string;
    position?: number;
    label?: string;
    icon?: string | null;
    backgroundColor?: string;
    textColor?: string;
    isEnabled?: boolean;
  }): Promise<IpcResult<DeckButtonWithAction>>;
  deleteButton(input: { buttonId: string }): Promise<IpcResult<DeletedRef>>;
  duplicateButton(input: {
    buttonId: string;
    position: number;
  }): Promise<IpcResult<DeckButtonWithAction>>;

  getActionCatalog(): Promise<IpcResult<ActionCatalogEntry[]>>;
  setAction(input: {
    buttonId: string;
    actionType: ActionRecord['actionType'];
    config: Record<string, unknown>;
  }): Promise<IpcResult<ActionRecord>>;
  deleteAction(input: { buttonId: string }): Promise<IpcResult<DeletedRef>>;
  executeAction(input: { buttonId: string }): Promise<IpcResult<ActionExecutionResult>>;
  /** Subscribes to navigation actions; returns the unsubscribe function. */
  onNavigationRequest(listener: (request: NavigationRequest) => void): () => void;

  listDevices(): Promise<IpcResult<Device[]>>;
  listActivity(input?: { limit?: number }): Promise<IpcResult<ActivityLog[]>>;
}
