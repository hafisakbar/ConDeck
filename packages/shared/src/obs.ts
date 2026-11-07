import { z } from 'zod';
import { obsConnectionStates } from './domain';

/**
 * Phase 4 domain — OBS Studio integration.
 * Sources: PRD §5.5 (OBS Integration), TECHNICAL_SPECIFICATION.md §5 and
 * DATABASE_DESIGN.md §4.6.
 *
 * The password itself never crosses this contract after it is saved: the
 * renderer only learns whether one is stored (`hasPassword`), while the main
 * process keeps it in the OS credential store through Electron safeStorage.
 */

export const OBS_DEFAULT_HOST = '127.0.0.1';
export const OBS_DEFAULT_PORT = 4455;

/** Address of the OBS WebSocket server. */
export const obsAddressSchema = z.object({
  host: z
    .string()
    .trim()
    .min(1, 'Host is required.')
    .max(255, 'Host is too long.')
    .refine(
      (value) => !/\s/.test(value),
      'Use a hostname or IP address without spaces, for example 127.0.0.1.',
    ),
  port: z
    .number()
    .int('Port must be a whole number.')
    .min(1, 'Port must be between 1 and 65535.')
    .max(65535, 'Port must be between 1 and 65535.'),
});
export type ObsAddress = z.infer<typeof obsAddressSchema>;

/**
 * `password` has three meanings: `undefined` keeps the stored secret, an empty
 * string removes it, and any other value replaces it.
 */
export const saveObsSettingsInputSchema = obsAddressSchema.extend({
  isEnabled: z.boolean(),
  password: z.string().max(255, 'The password is too long.').optional(),
});
export type SaveObsSettingsInput = z.infer<typeof saveObsSettingsInputSchema>;

export const obsTestConnectionInputSchema = saveObsSettingsInputSchema;
export type ObsTestConnectionInput = z.infer<typeof obsTestConnectionInputSchema>;

/** Live state the main process knows about the OBS connection. */
export const obsSnapshotSchema = z.object({
  state: z.enum(obsConnectionStates),
  message: z.string().nullable(),
  host: z.string().nullable(),
  port: z.number().int().nullable(),
  isEnabled: z.boolean(),
  hasPassword: z.boolean(),
  sceneName: z.string().nullable(),
  scenes: z.array(z.string()),
  isStreaming: z.boolean(),
  isRecording: z.boolean(),
});
export type ObsSnapshot = z.infer<typeof obsSnapshotSchema>;

/** Result of the "Test connection" button; a failed test is not an IPC error. */
export const obsTestResultSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
  scenes: z.array(z.string()),
});
export type ObsTestResult = z.infer<typeof obsTestResultSchema>;

/** Human readable labels for the settings page. */
export function obsSnapshotMessage(snapshot: ObsSnapshot): string {
  if (snapshot.state === 'NOT_CONFIGURED') {
    return 'OBS Studio has not been configured yet.';
  }
  if (snapshot.state === 'DISABLED') {
    return 'The OBS integration is disabled.';
  }
  if (snapshot.state === 'DISCONNECTED') {
    return snapshot.message ?? 'OBS is configured but not connected.';
  }
  if (snapshot.isStreaming && snapshot.isRecording) {
    return 'Connected — streaming and recording.';
  }
  if (snapshot.isStreaming) {
    return 'Connected — streaming.';
  }
  if (snapshot.isRecording) {
    return 'Connected — recording.';
  }
  return 'Connected.';
}
