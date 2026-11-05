import { z } from 'zod';
import {
  createProfileInputSchema,
  listActivityInputSchema,
  setActiveProfileInputSchema,
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
  'profiles:set-active',
  'devices:list',
  'activity:list',
] as const;

export type IpcChannel = (typeof ipcChannels)[number];

export const ipcInputSchemas = {
  'app:get-info': z.void(),
  'dashboard:get-summary': z.void(),
  'profiles:list': z.void(),
  'profiles:create': createProfileInputSchema,
  'profiles:set-active': setActiveProfileInputSchema,
  'devices:list': z.void(),
  'activity:list': listActivityInputSchema,
} as const satisfies Record<IpcChannel, z.ZodType>;

export type IpcErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'DATABASE_ERROR'
  | 'NOT_AVAILABLE'
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

/** API exposed on `window.condeck` by the preload script. */
export interface ConDeckBridge {
  getAppInfo(): Promise<IpcResult<AppInfo>>;
  getDashboardSummary(): Promise<IpcResult<DashboardSummary>>;
  listProfiles(): Promise<IpcResult<Profile[]>>;
  createProfile(input: { name: string; description?: string }): Promise<IpcResult<Profile>>;
  setActiveProfile(input: { profileId: string }): Promise<IpcResult<Profile>>;
  listDevices(): Promise<IpcResult<Device[]>>;
  listActivity(input?: { limit?: number }): Promise<IpcResult<ActivityLog[]>>;
}
