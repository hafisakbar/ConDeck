import { z } from 'zod';

/**
 * TikTok LIVE Studio integration contract.
 *
 * The connection is entirely local: StreamKey talks to the Socket.IO server
 * that the installed LIVE Studio process exposes on 127.0.0.1. No TikTok
 * account, password, cookie or session token is involved.
 *
 * Protocol reference (community reverse engineering, verified against
 * LIVE Studio 1.33.2): `dannguyen9x/tiktok-live-studio-mcp` docs/PROTOCOL.md.
 */

export const tiktokConnectionStates = [
  'DISCONNECTED',
  'CONNECTING',
  'CONNECTED',
  'RECONNECTING',
  'UNSUPPORTED_VERSION',
  'ERROR',
] as const;
export type TikTokConnectionState = (typeof tiktokConnectionStates)[number];

export const tiktokDefaults = {
  host: '127.0.0.1',
  socketPath: '/socket.io/',
  socketProtocol: 'streamdeck_ttls_v1',
  requestTimeoutMs: 3_000,
  connectTimeoutMs: 2_000,
  rediscoveryDelayMs: 1_000,
  /** Published/installed ports seen in the wild; only used as a fallback. */
  knownPorts: [28189, 39728, 34246, 42205, 38534, 40825, 40622],
  /** The protocol contract was verified against this minor line. */
  verifiedMajor: 1,
  verifiedMinor: 33,
} as const;

/** Action IDs verified against the LIVE Studio protocol. */
export const tiktokActionIds = {
  scene: 'com.tiktok.livestudio.scene',
  source: 'com.tiktok.livestudio.source',
  mic: 'com.tiktok.livestudio.mic',
  audio: 'com.tiktok.livestudio.audio',
  recording: 'com.tiktok.livestudio.recording',
} as const;

export const tiktokEvents = {
  joinRoom: 'stream_deck/join_room',
  syncSettings: 'stream_deck/sync_settings',
  actionEmit: 'stream_deck/action_emit',
  deviceStatusEmit: 'stream_deck/device_status_emit',
  actionResultPrefix: 'stream_deck/',
} as const;

export const tiktokSourceSchema = z.object({
  label: z.string(),
  value: z.string(),
});
export type TikTokSource = z.infer<typeof tiktokSourceSchema>;

export const tiktokSceneSchema = z.object({
  name: z.string(),
  sources: z.array(tiktokSourceSchema),
  visibleSources: z.array(tiktokSourceSchema),
});
export type TikTokScene = z.infer<typeof tiktokSceneSchema>;

/** Normalized live state read from `stream_deck/sync_settings`. */
export const tiktokStateSchema = z.object({
  sceneName: z.string().nullable(),
  scenes: z.array(tiktokSceneSchema),
  micMuted: z.boolean(),
  audioMuted: z.boolean(),
  recording: z.boolean(),
  /** 0 offline, 1 paused, 2 live. */
  streamStatus: z.number().int().min(0).max(2),
});
export type TikTokState = z.infer<typeof tiktokStateSchema>;

/** Everything the UI needs to describe the integration. */
export const tiktokSnapshotSchema = z.object({
  state: z.enum(tiktokConnectionStates),
  message: z.string().nullable(),
  /** Whether a LIVE Studio process (and a verified socket) was found. */
  found: z.boolean(),
  version: z.string().nullable(),
  port: z.number().int().nullable(),
  isEnabled: z.boolean(),
  sceneName: z.string().nullable(),
  scenes: z.array(tiktokSceneSchema),
  micMuted: z.boolean(),
  audioMuted: z.boolean(),
  recording: z.boolean(),
  streamStatus: z.number().int().min(0).max(2),
});
export type TikTokSnapshot = z.infer<typeof tiktokSnapshotSchema>;

export const saveTikTokSettingsInputSchema = z.object({
  isEnabled: z.boolean(),
});
export type SaveTikTokSettingsInput = z.infer<typeof saveTikTokSettingsInputSchema>;

export const tiktokTestResultSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
  version: z.string().nullable(),
  sceneName: z.string().nullable(),
  scenes: z.array(z.string()),
});
export type TikTokTestResult = z.infer<typeof tiktokTestResultSchema>;

export function emptyTikTokSnapshot(isEnabled = true): TikTokSnapshot {
  return {
    state: 'DISCONNECTED',
    message: null,
    found: false,
    version: null,
    port: null,
    isEnabled,
    sceneName: null,
    scenes: [],
    micMuted: false,
    audioMuted: false,
    recording: false,
    streamStatus: 0,
  };
}

export function tiktokSnapshotMessage(snapshot: TikTokSnapshot): string {
  switch (snapshot.state) {
    case 'CONNECTED':
      return snapshot.sceneName ? `Connected — scene “${snapshot.sceneName}”.` : 'Connected.';
    case 'CONNECTING':
      return 'Connecting to TikTok LIVE Studio…';
    case 'RECONNECTING':
      return 'Reconnecting to TikTok LIVE Studio…';
    case 'UNSUPPORTED_VERSION':
      return snapshot.message ?? 'This TikTok LIVE Studio version is not supported.';
    case 'ERROR':
      return snapshot.message ?? 'The TikTok LIVE Studio connection failed.';
    default:
      return snapshot.found
        ? 'TikTok LIVE Studio was found but StreamKey is not connected.'
        : 'TikTok LIVE Studio is not running. Open the app, then connect.';
  }
}
