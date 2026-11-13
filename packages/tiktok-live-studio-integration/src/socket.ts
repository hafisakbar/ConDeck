import { randomUUID } from 'node:crypto';
import {
  AppError,
  tiktokDefaults,
  tiktokEvents,
  type TikTokState,
} from '@condeck/shared';
import { io, type Socket } from 'socket.io-client';
import { actionResultSchema, decodeJsonPayload, normalizeState } from './protocol';

export interface LiveStudioSocket {
  connect(): Promise<void>;
  isConnected(): boolean;
  sync(): Promise<TikTokState>;
  action(actionId: string, settings: Record<string, unknown>): Promise<void>;
  onDisconnect(listener: (reason: string) => void): void;
  close(): void;
}

export interface LiveStudioSocketOptions {
  port: number;
  connectTimeoutMs?: number;
  requestTimeoutMs?: number;
}

export type LiveStudioSocketFactory = (options: LiveStudioSocketOptions) => LiveStudioSocket;

/**
 * One Socket.IO connection to the LIVE Studio process.
 *
 * The handshake verified by the community protocol is:
 * ws://127.0.0.1:<port>/socket.io/, namespace "/", websocket transport and the
 * `streamdeck_ttls_v1` subprotocol. LIVE Studio registers duplicate handlers
 * when `join_room` is emitted twice on one connection, so joining is tied to
 * the Socket.IO socket id.
 */
export function createLiveStudioSocket({
  port,
  connectTimeoutMs = tiktokDefaults.connectTimeoutMs,
  requestTimeoutMs = tiktokDefaults.requestTimeoutMs,
}: LiveStudioSocketOptions): LiveStudioSocket {
  const socket: Socket = io(`ws://${tiktokDefaults.host}:${port}`, {
    path: tiktokDefaults.socketPath,
    transports: ['websocket'],
    protocols: [tiktokDefaults.socketProtocol],
    autoConnect: false,
    reconnection: false,
    forceNew: true,
    timeout: connectTimeoutMs,
  });

  let joinedSocketId: string | null = null;
  let closed = false;

  function ensureJoined(): void {
    if (!socket.connected || joinedSocketId === socket.id) {
      return;
    }
    socket.emit(tiktokEvents.joinRoom);
    joinedSocketId = socket.id ?? 'connected';
  }

  socket.on('connect', ensureJoined);

  function requireConnected(): void {
    if (!socket.connected) {
      throw new AppError(
        'TIKTOK_DISCONNECTED',
        'TikTok LIVE Studio is not connected. Open Integrations and connect first.',
      );
    }
  }

  return {
    connect() {
      if (socket.connected) {
        ensureJoined();
        return Promise.resolve();
      }

      return new Promise<void>((resolve, reject) => {
        let settled = false;
        const finish = (error?: Error): void => {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timer);
          socket.off('connect', onConnect);
          socket.off('connect_error', onError);
          if (error) {
            socket.close();
            reject(error);
          } else {
            resolve();
          }
        };
        const onConnect = (): void => finish();
        const onError = (error: Error): void => finish(error);
        const timer = setTimeout(() => {
          finish(new Error(`TikTok LIVE Studio did not answer on port ${port} within ${connectTimeoutMs} ms.`));
        }, connectTimeoutMs + 100);

        socket.once('connect', onConnect);
        socket.once('connect_error', onError);
        socket.connect();
      });
    },

    isConnected: () => socket.connected,

    sync() {
      requireConnected();
      ensureJoined();

      return new Promise<TikTokState>((resolve, reject) => {
        let settled = false;
        const finish = (error: Error | null, state?: TikTokState): void => {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timer);
          socket.off(tiktokEvents.syncSettings, onSettings);
          if (error) {
            reject(error);
          } else {
            resolve(state as TikTokState);
          }
        };
        const onSettings = (payload: unknown): void => {
          try {
            finish(null, normalizeState(payload));
          } catch (error) {
            finish(error instanceof Error ? error : new Error('Invalid state payload.'));
          }
        };
        const timer = setTimeout(() => {
          finish(
            new AppError(
              'ACTION_TIMEOUT',
              `TikTok LIVE Studio did not return its state within ${requestTimeoutMs} ms.`,
            ),
          );
        }, requestTimeoutMs);

        socket.once(tiktokEvents.syncSettings, onSettings);
        socket.emit(tiktokEvents.syncSettings);
      });
    },

    action(actionId, settings) {
      requireConnected();
      ensureJoined();

      const context = `streamkey_${randomUUID()}`;
      const responseEvent = `${tiktokEvents.actionResultPrefix}${context}`;
      const envelope = JSON.stringify({ action: actionId, context, payload: { settings } });

      return new Promise<void>((resolve, reject) => {
        let settled = false;
        const finish = (error: Error | null): void => {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timer);
          socket.off(responseEvent, onResponse);
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        };
        const onResponse = (payload: unknown): void => {
          try {
            const result = actionResultSchema.safeParse(decodeJsonPayload(payload));
            if (!result.success) {
              finish(
                new AppError(
                  'ACTION_FAILED',
                  'TikTok LIVE Studio returned an action result StreamKey could not read.',
                ),
              );
              return;
            }
            if (result.data.code !== 0) {
              finish(
                new AppError(
                  'ACTION_FAILED',
                  `TikTok LIVE Studio rejected the action (code ${result.data.code}). It may not be available in the current LIVE or panel state.`,
                ),
              );
              return;
            }
            finish(null);
          } catch (error) {
            finish(error instanceof Error ? error : new Error('Invalid action result.'));
          }
        };
        const timer = setTimeout(() => {
          finish(
            new AppError(
              'ACTION_TIMEOUT',
              `TikTok LIVE Studio did not acknowledge the action within ${requestTimeoutMs} ms. The action was sent once and was not retried.`,
            ),
          );
        }, requestTimeoutMs);

        socket.once(responseEvent, onResponse);
        socket.emit(tiktokEvents.actionEmit, envelope);
      });
    },

    onDisconnect(listener) {
      socket.on('disconnect', (reason: string) => {
        if (!closed) {
          listener(reason);
        }
      });
    },

    close() {
      closed = true;
      joinedSocketId = null;
      socket.removeAllListeners();
      socket.close();
    },
  };
}
