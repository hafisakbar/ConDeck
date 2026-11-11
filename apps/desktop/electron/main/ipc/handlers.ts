import {
  countProfiles,
  createButton,
  createCustomIcon as createCustomIconRecord,
  createDeck,
  createPage,
  createProfile,
  deleteButton,
  deleteCustomIcon as deleteCustomIconRecord,
  deleteDeck,
  deletePage,
  deleteProfile,
  duplicateButton,
  getActionTarget,
  getDeck,
  getDeckDetail,
  listCustomIcons,
  listDecks,
  listDevices,
  listProfiles,
  listRecentActivity,
  listSounds,
  recordActivity,
  setActiveProfile,
  updateButton,
  updateDeck,
  updatePage,
  updateProfile,
  type ConDeckDb,
} from '@condeck/database';
import {
  AppError,
  actionTypeLabel,
  decodeCustomIcon,
  ipcFailure,
  ipcInputSchemas,
  ipcSuccess,
  type ActivityLog,
  type ActionCatalogEntry,
  type ActionExecutionResult,
  type ActionRecord,
  type AppInfo,
  type CreateButtonInput,
  type CreateCustomIconInput,
  type CustomIcon,
  type CreateDeckInput,
  type CreatePageInput,
  type CreateProfileInput,
  type DashboardSummary,
  type Deck,
  type DeckButtonWithAction,
  type DeckDetail,
  type DeckPage,
  type DeckSummary,
  type DeleteActionInput,
  type DeleteButtonInput,
  type DeleteCustomIconInput,
  type DeleteDeckInput,
  type DeletePageInput,
  type DeleteProfileInput,
  type DeletedRef,
  type Device,
  type DeleteSoundInput,
  type DuplicateButtonInput,
  type ErrorCode,
  type ExecuteActionInput,
  type GetDeckInput,
  type GetSoundAudioInput,
  type IpcChannel,
  type IpcErrorCode,
  type IpcResult,
  type ListActivityInput,
  type ListDecksInput,
  type ObsSnapshot,
  type ObsTestConnectionInput,
  type ObsTestResult,
  type Profile,
  type RemotePairing,
  type RemoteServerStatus,
  type RevokeDeviceInput,
  type SaveObsSettingsInput,
  type SaveRemoteSettingsInput,
  type SetActionInput,
  type Sound,
  type SoundAudio,
  type SetActiveProfileInput,
  type UpdateButtonInput,
  type UpdateDeckInput,
  type UpdatePageInput,
  type UpdateProfileInput,
} from '@condeck/shared';
import { ipcMain } from 'electron';
import type { ZodType } from 'zod';
import type { FileLogger } from '../logger';
import type { ActionService } from '../services/action.service';
import { buildDashboardSummary } from '../services/dashboard.service';
import type { ObsService } from '../services/obs.service';
import type { RemoteService } from '../services/remote.service';
import type { SoundService } from '../services/sound.service';

export interface IpcContext {
  logger: FileLogger;
  db: ConDeckDb;
  getAppInfo: () => AppInfo;
  actions: ActionService;
  sounds: SoundService;
  obs: ObsService;
  remote: RemoteService;
}

const ERROR_CODE_MAP: Record<ErrorCode, IpcErrorCode> = {
  INVALID_INPUT: 'INVALID_INPUT',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  DATABASE_ERROR: 'DATABASE_ERROR',
  NOT_AVAILABLE: 'NOT_AVAILABLE',
  UNAUTHORIZED: 'NOT_AVAILABLE',
  DEVICE_REVOKED: 'NOT_AVAILABLE',
  OBS_DISCONNECTED: 'NOT_AVAILABLE',
  OBS_CONNECTION_FAILED: 'NOT_AVAILABLE',
  OBS_REQUEST_FAILED: 'ACTION_FAILED',
  ACTION_FAILED: 'ACTION_FAILED',
  ACTION_TIMEOUT: 'ACTION_TIMEOUT',
  ACTION_BUSY: 'ACTION_BUSY',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

/**
 * Registers the whole IPC allowlist (TECHNICAL_SPECIFICATION.md §7).
 * Every payload is validated with the shared Zod schema before it touches the
 * database, and failures are returned as data instead of thrown across IPC.
 */
export function registerIpcHandlers({
  logger,
  db,
  getAppInfo,
  actions,
  sounds,
  obs,
  remote,
}: IpcContext): void {
  const handle = <TInput, TOutput>(
    channel: IpcChannel,
    handler: (input: TInput) => TOutput | Promise<TOutput>,
  ): void => {
    const schema = ipcInputSchemas[channel] as unknown as ZodType<TInput>;

    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, async (_event, rawInput: unknown): Promise<IpcResult<TOutput>> => {
      const parsed = schema.safeParse(rawInput);
      if (!parsed.success) {
        const message = parsed.error.issues
          .map((issue) => `${issue.path.join('.') || 'input'}: ${issue.message}`)
          .join('; ');
        logger.warn('Rejected IPC request', { channel, message });
        return ipcFailure('INVALID_INPUT', message);
      }

      try {
        return ipcSuccess(await handler(parsed.data));
      } catch (error) {
        if (error instanceof AppError) {
          logger.warn('IPC request failed', { channel, code: error.code, message: error.message });
          return ipcFailure(ERROR_CODE_MAP[error.code], error.message);
        }
        logger.error('IPC handler crashed', {
          channel,
          error: error instanceof Error ? error.message : String(error),
        });
        return ipcFailure('INTERNAL_ERROR', 'An unexpected error occurred. Check the activity log.');
      }
    });
  };

  /** Remotes re-request the deck snapshot whenever the desktop edits it. */
  const deckChanged = (): void => remote.notifyDeckChanged();

  handle<void, AppInfo>('app:get-info', () => getAppInfo());

  handle<void, DashboardSummary>('dashboard:get-summary', () =>
    buildDashboardSummary({ db, appInfo: getAppInfo(), obsStatus: () => obs.getStatus() }),
  );

  // ---------------------------------------------------------------- profiles

  handle<void, Profile[]>('profiles:list', () => listProfiles(db));

  handle<CreateProfileInput, Profile>('profiles:create', (input) => {
    const profile = createProfile(db, input);
    recordActivity(db, {
      eventType: 'PROFILE_CREATED',
      description: `Profile "${profile.name}" created`,
      metadata: { profileId: profile.id, totalProfiles: countProfiles(db) },
    });
    logger.info('Profile created', { profileId: profile.id });
    return profile;
  });

  handle<UpdateProfileInput, Profile>('profiles:update', (input) => {
    const profile = updateProfile(db, input);
    recordActivity(db, {
      eventType: 'PROFILE_UPDATED',
      description: `Profile "${profile.name}" updated`,
      metadata: { profileId: profile.id },
    });
    return profile;
  });

  handle<SetActiveProfileInput, Profile>('profiles:set-active', (input) => {
    const profile = setActiveProfile(db, input.profileId);
    recordActivity(db, {
      eventType: 'PROFILE_ACTIVATED',
      description: `Profile "${profile.name}" is now active`,
      metadata: { profileId: profile.id },
    });
    return profile;
  });

  handle<DeleteProfileInput, DeletedRef>('profiles:delete', (input) => {
    const profile = listProfiles(db).find((entry) => entry.id === input.profileId);
    const { remainingProfiles } = deleteProfile(db, input.profileId);
    recordActivity(db, {
      eventType: 'PROFILE_DELETED',
      description: profile ? `Profile "${profile.name}" deleted` : 'Profile deleted',
      metadata: { profileId: input.profileId, remainingProfiles },
    });
    return { id: input.profileId };
  });

  // ------------------------------------------------------------------- decks

  handle<ListDecksInput, DeckSummary[]>('decks:list', (input) => listDecks(db, input.profileId));

  handle<GetDeckInput, DeckDetail>('decks:get', (input) => getDeckDetail(db, input.deckId));

  handle<CreateDeckInput, DeckDetail>('decks:create', (input) => {
    const detail = createDeck(db, input);
    recordActivity(db, {
      eventType: 'DECK_CREATED',
      description: `Deck "${detail.deck.name}" created`,
      metadata: {
        deckId: detail.deck.id,
        profileId: detail.deck.profileId,
        grid: `${detail.deck.columns}x${detail.deck.rows}`,
      },
    });
    logger.info('Deck created', { deckId: detail.deck.id });
    deckChanged();
    return detail;
  });

  handle<UpdateDeckInput, Deck>('decks:update', (input) => {
    const deck = updateDeck(db, input);
    recordActivity(db, {
      eventType: 'DECK_UPDATED',
      description: `Deck "${deck.name}" updated`,
      metadata: { deckId: deck.id, grid: `${deck.columns}x${deck.rows}` },
    });
    deckChanged();
    return deck;
  });

  handle<DeleteDeckInput, DeletedRef>('decks:delete', (input) => {
    const deck = getDeck(db, input.deckId);
    deleteDeck(db, input.deckId);
    recordActivity(db, {
      eventType: 'DECK_DELETED',
      description: `Deck "${deck.name}" deleted`,
      metadata: { deckId: deck.id, profileId: deck.profileId },
    });
    deckChanged();
    return { id: input.deckId };
  });

  // ------------------------------------------------------------------- pages

  handle<CreatePageInput, DeckDetail>('pages:create', (input) => {
    const detail = createPage(db, input);
    recordActivity(db, {
      eventType: 'PAGE_CREATED',
      description: `Page "${input.name}" added to deck "${detail.deck.name}"`,
      metadata: { deckId: detail.deck.id, pageName: input.name },
    });
    deckChanged();
    return detail;
  });

  handle<UpdatePageInput, DeckPage>('pages:update', (input) => {
    const page = updatePage(db, input);
    recordActivity(db, {
      eventType: 'PAGE_RENAMED',
      description: `Page renamed to "${page.name}"`,
      metadata: { pageId: page.id, deckId: page.deckId },
    });
    deckChanged();
    return page;
  });

  handle<DeletePageInput, DeckDetail>('pages:delete', (input) => {
    const detail = deletePage(db, input.pageId);
    recordActivity(db, {
      eventType: 'PAGE_DELETED',
      description: `Page deleted from deck "${detail.deck.name}"`,
      metadata: { pageId: input.pageId, deckId: detail.deck.id },
    });
    deckChanged();
    return detail;
  });

  // ----------------------------------------------------------------- buttons

  handle<CreateButtonInput, DeckButtonWithAction>('buttons:create', (input) => {
    const button = createButton(db, input);
    recordActivity(db, {
      eventType: 'BUTTON_CREATED',
      description: `Button "${button.label}" created`,
      metadata: { buttonId: button.id, pageId: button.pageId, position: button.position },
    });
    deckChanged();
    return button;
  });

  handle<UpdateButtonInput, DeckButtonWithAction>('buttons:update', (input) => {
    const button = updateButton(db, input);
    recordActivity(db, {
      eventType: 'BUTTON_UPDATED',
      description: `Button "${button.label}" updated`,
      metadata: { buttonId: button.id, pageId: button.pageId, position: button.position },
    });
    deckChanged();
    return button;
  });

  handle<DeleteButtonInput, DeletedRef>('buttons:delete', (input) => {
    deleteButton(db, input.buttonId);
    recordActivity(db, {
      eventType: 'BUTTON_DELETED',
      description: 'Button deleted',
      metadata: { buttonId: input.buttonId },
    });
    deckChanged();
    return { id: input.buttonId };
  });

  handle<DuplicateButtonInput, DeckButtonWithAction>('buttons:duplicate', (input) => {
    const button = duplicateButton(db, input);
    recordActivity(db, {
      eventType: 'BUTTON_DUPLICATED',
      description: `Button "${button.label}" duplicated`,
      metadata: { buttonId: button.id, pageId: button.pageId, position: button.position },
    });
    deckChanged();
    return button;
  });

  // ----------------------------------------------------------------- actions

  handle<void, ActionCatalogEntry[]>('actions:catalog', () => actions.catalog());

  handle<SetActionInput, ActionRecord>('actions:set', (input) => {
    const target = getActionTarget(db, input.buttonId);
    const record = actions.setAction(input);
    recordActivity(db, {
      eventType: 'ACTION_CONFIGURED',
      description: `Action "${actionTypeLabel(record.actionType)}" configured on button "${target.buttonLabel}"`,
      metadata: {
        buttonId: record.buttonId,
        pageId: target.pageId,
        deckId: target.deckId,
        actionType: record.actionType,
      },
    });
    logger.info('Button action saved', {
      buttonId: record.buttonId,
      actionType: record.actionType,
    });
    deckChanged();
    return record;
  });

  handle<DeleteActionInput, DeletedRef>('actions:delete', (input) => {
    const target = getActionTarget(db, input.buttonId);
    const actionType = actions.removeAction(input.buttonId);
    recordActivity(db, {
      eventType: 'ACTION_REMOVED',
      description: `Action "${actionTypeLabel(actionType)}" removed from button "${target.buttonLabel}"`,
      metadata: { buttonId: input.buttonId, pageId: target.pageId, actionType },
    });
    deckChanged();
    return { id: input.buttonId };
  });

  handle<ExecuteActionInput, ActionExecutionResult>('actions:execute', async (input) => {
    const target = getActionTarget(db, input.buttonId);
    const result = await actions.execute(input.buttonId);

    recordActivity(db, {
      eventType: result.status === 'SUCCESS' ? 'ACTION_EXECUTED' : 'ACTION_FAILED',
      description:
        result.status === 'SUCCESS'
          ? `Action "${actionTypeLabel(result.actionType)}" ran on button "${target.buttonLabel}"`
          : `Action "${actionTypeLabel(result.actionType)}" failed on button "${target.buttonLabel}": ${result.message}`,
      metadata: {
        buttonId: input.buttonId,
        pageId: target.pageId,
        actionType: result.actionType,
        status: result.status,
        code: result.code,
        durationMs: result.durationMs,
      },
    });

    if (result.status === 'SUCCESS') {
      logger.info('Action executed', {
        buttonId: input.buttonId,
        actionType: result.actionType,
        durationMs: result.durationMs,
      });
    } else {
      logger.warn('Action failed', {
        buttonId: input.buttonId,
        actionType: result.actionType,
        code: result.code,
        message: result.message,
      });
    }

    return result;
  });

  // --------------------------------------------------------------------- OBS

  handle<void, ObsSnapshot>('obs:get-snapshot', () => obs.getSnapshot());

  handle<SaveObsSettingsInput, ObsSnapshot>('obs:save-settings', (input) => {
    const snapshot = obs.saveSettings(input);
    recordActivity(db, {
      eventType: 'OBS_SETTINGS_SAVED',
      description: `OBS settings saved for ${snapshot.host}:${snapshot.port}`,
      metadata: {
        host: snapshot.host,
        port: snapshot.port,
        isEnabled: snapshot.isEnabled,
        hasPassword: snapshot.hasPassword,
      },
    });
    logger.info('OBS settings saved', { host: snapshot.host, port: snapshot.port });
    return snapshot;
  });

  handle<void, ObsSnapshot>('obs:connect', async () => {
    try {
      const snapshot = await obs.connect();
      recordActivity(db, {
        eventType: 'OBS_CONNECTED',
        description: `Connected to OBS at ${snapshot.host}:${snapshot.port}`,
        metadata: { host: snapshot.host, port: snapshot.port, sceneName: snapshot.sceneName },
      });
      logger.info('OBS connected', { host: snapshot.host, port: snapshot.port });
      return snapshot;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error.';
      recordActivity(db, {
        eventType: 'OBS_CONNECTION_FAILED',
        description: `Could not connect to OBS: ${message}`,
      });
      throw error;
    }
  });

  handle<void, ObsSnapshot>('obs:disconnect', async () => {
    const snapshot = await obs.disconnect();
    recordActivity(db, {
      eventType: 'OBS_DISCONNECTED',
      description: 'Disconnected from OBS Studio',
    });
    return snapshot;
  });

  handle<ObsTestConnectionInput, ObsTestResult>('obs:test-connection', (input) =>
    obs.testConnection(input),
  );

  handle<void, string[]>('obs:list-scenes', () => obs.listScenes());

  // ------------------------------------------------------- devices, activity

  handle<void, Device[]>('devices:list', () => listDevices(db));

  handle<RevokeDeviceInput, Device>('devices:revoke', (input) => remote.revokeDevice(input.deviceId));

  handle<void, RemoteServerStatus>('remote:get-status', () => remote.getStatus());

  handle<SaveRemoteSettingsInput, RemoteServerStatus>('remote:save-settings', (input) =>
    remote.saveSettings(input),
  );

  handle<void, RemoteServerStatus>('remote:start', () => remote.start());

  handle<void, RemoteServerStatus>('remote:stop', () => remote.stop());

  handle<void, RemotePairing>('remote:create-pairing', () => remote.createPairing());

  handle<ListActivityInput, ActivityLog[]>('activity:list', (input) =>
    listRecentActivity(db, input.limit),
  );

  // ----------------------------------------------------------- custom icons

  handle<void, CustomIcon[]>('icons:list', () => listCustomIcons(db));

  handle<CreateCustomIconInput, CustomIcon>('icons:create', (input) => {
    const decoded = decodeCustomIcon(input.dataUrl);
    if (!decoded) {
      throw new AppError('INVALID_INPUT', 'Use a PNG, JPEG or WebP image up to 300 KB.');
    }
    const icon = createCustomIconRecord(db, {
      name: input.name,
      mimeType: decoded.mimeType,
      base64: decoded.base64,
      byteSize: decoded.byteSize,
    });
    recordActivity(db, {
      eventType: 'ICON_CREATED',
      description: `Custom icon "${icon.name}" added`,
      metadata: { iconId: icon.id, mimeType: icon.mimeType, byteSize: icon.byteSize },
    });
    logger.info('Custom icon saved', { iconId: icon.id, byteSize: icon.byteSize });
    return icon;
  });

  handle<DeleteCustomIconInput, DeletedRef>('icons:delete', (input) => {
    deleteCustomIconRecord(db, input.iconId);
    recordActivity(db, {
      eventType: 'ICON_DELETED',
      description: 'Custom icon deleted',
      metadata: { iconId: input.iconId },
    });
    return { id: input.iconId };
  });

  // ------------------------------------------------------------ soundboard

  handle<void, Sound[]>('sounds:list', () => sounds.list());

  handle<void, Sound[]>('sounds:import', async () => {
    const imported = await sounds.import();
    for (const sound of imported) {
      recordActivity(db, {
        eventType: 'SOUND_IMPORTED',
        description: `Sound "${sound.name}" added`,
        metadata: { soundId: sound.id, format: sound.format, byteSize: sound.byteSize },
      });
    }
    return imported;
  });

  handle<DeleteSoundInput, DeletedRef>('sounds:delete', async (input) => {
    const sound = listSounds(db).find((entry) => entry.id === input.soundId);
    await sounds.remove(input.soundId);
    recordActivity(db, {
      eventType: 'SOUND_DELETED',
      description: sound ? `Sound "${sound.name}" removed` : 'Sound removed',
      metadata: { soundId: input.soundId },
    });
    return { id: input.soundId };
  });

  handle<GetSoundAudioInput, SoundAudio>('sounds:get-audio', (input) => sounds.audio(input.soundId));

  logger.info('IPC handlers registered', { channels: Object.keys(ipcInputSchemas) });
}
