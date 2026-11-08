import { remoteDefaultPort } from '@condeck/shared';

/**
 * Constants shared by the Desktop host and the Mobile remote.
 * Sources: API_WEBSOCKET_CONTRACT.md §1, §5, §11, §13 and
 * TECHNICAL_SPECIFICATION.md §8.
 */
export const remoteProtocolVersion = 1;

export const remoteDefaults = {
  /** API_WEBSOCKET_CONTRACT.md §1. */
  port: remoteDefaultPort,
  wsPath: '/ws',
  /** Pairing tokens are short-lived and single-use (§5.1). */
  pairingTokenTtlMs: 2 * 60 * 1000,
  /** A QR code can be photographed; only a few attempts are allowed. */
  pairingMaxAttempts: 5,
  /** §11 heartbeat. */
  heartbeatIntervalMs: 15 * 1000,
  heartbeatTimeoutMs: 30 * 1000,
  /** A socket must authenticate shortly after connecting. */
  authTimeoutMs: 10 * 1000,
  /** §13 "Batasi ukuran pesan". */
  maxMessageBytes: 8 * 1024,
  /** §13 rate limiting, per connection. */
  rateLimitWindowMs: 5 * 1000,
  rateLimitMaxMessages: 30,
  /** How often the host re-checks heartbeat and pairing expiry. */
  maintenanceIntervalMs: 5 * 1000,
} as const;

export const remoteErrorCodes = [
  'UNAUTHORIZED',
  'INVALID_TOKEN',
  'TOKEN_EXPIRED',
  'DEVICE_REVOKED',
  'INVALID_REQUEST',
  'BUTTON_NOT_FOUND',
  'ACTION_FAILED',
  'OBS_DISCONNECTED',
  'SERVER_ERROR',
  'RATE_LIMITED',
] as const;

export type RemoteErrorCode = (typeof remoteErrorCodes)[number];

/** WebSocket close codes used by the host. 4000–4999 are application-specific. */
export const remoteCloseCodes = {
  normal: 1000,
  goingAway: 1001,
  policyViolation: 1008,
  messageTooBig: 1009,
  unauthorized: 4401,
  tokenExpired: 4408,
  rateLimited: 4429,
} as const;
