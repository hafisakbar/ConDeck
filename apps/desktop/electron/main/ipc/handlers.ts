import {
  countProfiles,
  createProfile,
  listDevices,
  listProfiles,
  listRecentActivity,
  recordActivity,
  setActiveProfile,
  type ConDeckDb,
} from '@condeck/database';
import {
  AppError,
  ipcFailure,
  ipcInputSchemas,
  ipcSuccess,
  type ActivityLog,
  type AppInfo,
  type CreateProfileInput,
  type DashboardSummary,
  type Device,
  type ErrorCode,
  type IpcChannel,
  type IpcErrorCode,
  type IpcResult,
  type ListActivityInput,
  type Profile,
  type SetActiveProfileInput,
} from '@condeck/shared';
import { ipcMain } from 'electron';
import type { ZodType } from 'zod';
import type { FileLogger } from '../logger';
import { buildDashboardSummary } from '../services/dashboard.service';

export interface IpcContext {
  logger: FileLogger;
  db: ConDeckDb;
  getAppInfo: () => AppInfo;
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
  ACTION_FAILED: 'INTERNAL_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

/**
 * Registers the whole IPC allowlist (TECHNICAL_SPECIFICATION.md §7).
 * Every payload is validated with the shared Zod schema before it touches the
 * database, and failures are returned as data instead of thrown across IPC.
 */
export function registerIpcHandlers({ logger, db, getAppInfo }: IpcContext): void {
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

  handle<void, AppInfo>('app:get-info', () => getAppInfo());

  handle<void, DashboardSummary>('dashboard:get-summary', () =>
    buildDashboardSummary({ db, appInfo: getAppInfo() }),
  );

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

  handle<SetActiveProfileInput, Profile>('profiles:set-active', (input) => {
    const profile = setActiveProfile(db, input.profileId);
    recordActivity(db, {
      eventType: 'PROFILE_ACTIVATED',
      description: `Profile "${profile.name}" is now active`,
      metadata: { profileId: profile.id },
    });
    return profile;
  });

  handle<void, Device[]>('devices:list', () => listDevices(db));

  handle<ListActivityInput, ActivityLog[]>('activity:list', (input) => listRecentActivity(db, input.limit));

  logger.info('IPC handlers registered', { channels: Object.keys(ipcInputSchemas) });
}
