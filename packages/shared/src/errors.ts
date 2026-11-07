/**
 * Error codes used across the IPC layer and (from Phase 5) the WebSocket protocol.
 * Mirrors API_WEBSOCKET_CONTRACT.md §12 where the two overlap.
 */
export const errorCodes = [
  'INVALID_INPUT',
  'NOT_FOUND',
  'CONFLICT',
  'UNAUTHORIZED',
  'DEVICE_REVOKED',
  'OBS_DISCONNECTED',
  'OBS_CONNECTION_FAILED',
  'OBS_REQUEST_FAILED',
  'ACTION_FAILED',
  'ACTION_TIMEOUT',
  'ACTION_BUSY',
  'DATABASE_ERROR',
  'NOT_AVAILABLE',
  'INTERNAL_ERROR',
] as const;

export type ErrorCode = (typeof errorCodes)[number];

/** Domain error that carries a stable code for the UI / protocol layer. */
export class AppError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = 'AppError';
    this.code = code;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
