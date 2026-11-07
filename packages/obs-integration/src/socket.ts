import OBSWebSocket from 'obs-websocket-js/msgpack';
import type { ObsSocket } from './types';

/**
 * Minimal typed view of the parts of `obs-websocket-js` that ConDeck uses.
 * The library types each request/response pair, which the client does not need:
 * responses are narrowed by the parsing helpers in `client.ts`.
 */
interface OBSWebSocketLike {
  connect(url?: string, password?: string): Promise<unknown>;
  disconnect(): Promise<void>;
  call(requestType: string, requestData?: unknown): Promise<unknown>;
  on(event: string, listener: (payload: unknown) => void): void;
  removeAllListeners(): void;
}

/** Real OBS WebSocket v5 connection, used by the desktop main process. */
export function createObsSocket(): ObsSocket {
  const client = new OBSWebSocket() as unknown as OBSWebSocketLike;

  return {
    connect: (url, password) => client.connect(url, password),
    disconnect: () => client.disconnect(),
    call: (requestType, requestData) => client.call(requestType, requestData),
    on: (event, listener) => {
      client.on(event, listener);
    },
    removeAllListeners: () => {
      client.removeAllListeners();
    },
  };
}
