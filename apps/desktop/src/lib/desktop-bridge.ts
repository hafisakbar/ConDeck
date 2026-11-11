import type { ConDeckBridge, IpcErrorCode, IpcResult } from '@condeck/shared';

declare global {
  interface Window {
    condeck?: ConDeckBridge;
  }
}

export class BridgeError extends Error {
  readonly code: IpcErrorCode | 'BRIDGE_UNAVAILABLE';

  constructor(code: IpcErrorCode | 'BRIDGE_UNAVAILABLE', message: string) {
    super(message);
    this.name = 'BridgeError';
    this.code = code;
  }
}

export function isBridgeAvailable(): boolean {
  return typeof window !== 'undefined' && window.condeck !== undefined;
}

export function getBridge(): ConDeckBridge {
  const bridge = window.condeck;
  if (!bridge) {
    throw new BridgeError(
      'BRIDGE_UNAVAILABLE',
      'StreamKey desktop services are not available. Start the app through Electron instead of a plain browser.',
    );
  }
  return bridge;
}

/** Turns the IPC result envelope into a value or a typed error. */
export async function unwrap<T>(result: Promise<IpcResult<T>>): Promise<T> {
  const response = await result;
  if (!response.ok) {
    throw new BridgeError(response.error.code, response.error.message);
  }
  return response.data;
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof BridgeError || error instanceof Error) {
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}
