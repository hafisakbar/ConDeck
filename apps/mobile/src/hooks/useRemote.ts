import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { parsePairingToken, targetFromLocation, type ConnectionTarget } from '../lib/pairing-link';
import { createRemoteClient, type ActionFeedback, type RemoteClient } from '../lib/remote-client';
import {
  browserStorage,
  clearStoredDevice,
  readStoredDevice,
  writeStoredDevice,
  type StoredDevice,
} from '../lib/storage';

export interface ConnectRequest {
  host: string;
  port: number;
  deviceName?: string;
  pairToken?: string | null;
}

export interface RemoteHook {
  client: RemoteClient;
  state: ReturnType<RemoteClient['getState']>;
  error: string | null;
  snapshot: ReturnType<RemoteClient['getSnapshot']>;
  obs: ReturnType<RemoteClient['getObs']>;
  feedback: ActionFeedback | null;
  stored: StoredDevice | null;
  /** Token from the QR link, if the page was opened by scanning. */
  pairToken: string | null;
  target: ConnectionTarget | null;
  connect: (request: ConnectRequest) => void;
  disconnect: () => void;
  forget: () => void;
  press: (buttonId: string) => boolean;
  changePage: (pageId: string) => void;
  requestDeck: () => void;
  clearFeedback: () => void;
}

export function useRemote(): RemoteHook {
  const storage = useMemo(() => browserStorage(), []);
  const [, forceRender] = useReducer((value: number) => value + 1, 0);
  const booted = useRef(false);

  const pairToken = useMemo(() => {
    if (typeof window === 'undefined') {
      return null;
    }
    return parsePairingToken(window.location.hash) ?? parsePairingToken(window.location.search);
  }, []);

  const target = useMemo(() => {
    if (typeof window === 'undefined') {
      return null;
    }
    return targetFromLocation(window.location);
  }, []);

  const storedRef = useRef<StoredDevice | null>(readStoredDevice(storage));

  const clientRef = useRef<RemoteClient | null>(null);
  if (clientRef.current === null) {
    clientRef.current = createRemoteClient({
      onPaired: (device) => {
        writeStoredDevice(storage, device);
        storedRef.current = device;
        forceRender();
      },
      onDeviceRejected: () => {
        clearStoredDevice(storage);
        storedRef.current = null;
        forceRender();
      },
    });
  }
  const client = clientRef.current;

  useEffect(() => client.subscribe(forceRender), [client]);

  useEffect(() => {
    if (booted.current) {
      return;
    }
    booted.current = true;

    const saved = readStoredDevice(storage);
    storedRef.current = saved;
    if (saved !== null) {
      client.connect({
        host: saved.host,
        port: saved.port,
        device: saved,
        deviceName: saved.deviceName,
      });
    }

    return () => client.disconnect();
  }, [client, storage]);

  const connect = useCallback(
    (request: ConnectRequest) => {
      client.connect({
        host: request.host,
        port: request.port,
        device: null,
        deviceName: request.deviceName,
        pairToken: request.pairToken ?? null,
      });
    },
    [client],
  );

  const disconnect = useCallback(() => client.disconnect(), [client]);

  const forget = useCallback(() => {
    client.disconnect();
    clearStoredDevice(storage);
    storedRef.current = null;
    forceRender();
  }, [client, storage]);

  return {
    client,
    state: client.getState(),
    error: client.getError(),
    snapshot: client.getSnapshot(),
    obs: client.getObs(),
    feedback: client.getFeedback(),
    stored: storedRef.current,
    pairToken,
    target,
    connect,
    disconnect,
    forget,
    press: (buttonId) => client.press(buttonId),
    changePage: (pageId) => client.changePage(pageId),
    requestDeck: () => client.requestDeck(),
    clearFeedback: () => client.clearFeedback(),
  };
}
