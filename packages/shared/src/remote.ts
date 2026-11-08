import { z } from 'zod';
import { isoTimestampSchema } from './domain';

/**
 * Phase 5 — Mobile Remote (API_WEBSOCKET_CONTRACT.md §5, §13).
 * These types are the desktop-side view of the host server; the wire messages
 * themselves live in @condeck/websocket-protocol.
 */

export const remoteServerStates = ['stopped', 'starting', 'running', 'error'] as const;
export type RemoteServerState = (typeof remoteServerStates)[number];

export const remoteDefaultPort = 43821;

export const remoteSettingsSchema = z.object({
  port: z
    .number()
    .int()
    .min(1024, 'Use a port between 1024 and 65535.')
    .max(65535, 'Use a port between 1024 and 65535.')
    .default(remoteDefaultPort),
  isEnabled: z.boolean().default(true),
});
export type RemoteSettings = z.infer<typeof remoteSettingsSchema>;

export const saveRemoteSettingsInputSchema = remoteSettingsSchema;
export type SaveRemoteSettingsInput = z.infer<typeof saveRemoteSettingsInputSchema>;

/** A pairing code shown as a QR image; short-lived and single-use. */
export const remotePairingSchema = z.object({
  token: z.string().min(20),
  expiresAt: isoTimestampSchema,
  /** URL the phone should open, e.g. http://192.168.1.5:43821/#pair=… */
  url: z.string(),
  qrDataUrl: z.string().startsWith('data:image/png;base64,', 'QR image is missing.'),
});
export type RemotePairing = z.infer<typeof remotePairingSchema>;

export const connectedRemoteDeviceSchema = z.object({
  deviceId: z.uuid(),
  deviceName: z.string(),
  connectedAt: isoTimestampSchema,
});
export type ConnectedRemoteDevice = z.infer<typeof connectedRemoteDeviceSchema>;

export const remoteServerStatusSchema = z.object({
  state: z.enum(remoteServerStates),
  isEnabled: z.boolean(),
  port: z.number().int(),
  /** Base URLs phones can open, one per non-internal IPv4 address. */
  addresses: z.array(z.string()),
  error: z.string().nullable(),
  pairing: remotePairingSchema.nullable(),
  connectedDevices: z.array(connectedRemoteDeviceSchema),
});
export type RemoteServerStatus = z.infer<typeof remoteServerStatusSchema>;

export const revokeDeviceInputSchema = z.object({
  deviceId: z.uuid(),
});
export type RevokeDeviceInput = z.infer<typeof revokeDeviceInputSchema>;
