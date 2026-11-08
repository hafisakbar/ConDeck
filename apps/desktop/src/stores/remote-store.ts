import type { Device, RemoteServerStatus, SaveRemoteSettingsInput } from '@condeck/shared';
import { create } from 'zustand';
import { getBridge, toErrorMessage, unwrap } from '../lib/desktop-bridge';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';
type Busy = 'save' | 'start' | 'stop' | 'pairing' | 'revoke' | null;

interface RemoteState {
  status: LoadStatus;
  server: RemoteServerStatus | null;
  devices: Device[];
  error: string | null;
  busy: Busy;
  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
  saveSettings: (input: SaveRemoteSettingsInput) => Promise<boolean>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  createPairing: () => Promise<boolean>;
  revokeDevice: (deviceId: string) => Promise<void>;
  dismissError: () => void;
}

let unsubscribeStatus: (() => void) | null = null;

export const useRemoteStore = create<RemoteState>((set, get) => ({
  status: 'idle',
  server: null,
  devices: [],
  error: null,
  busy: null,

  async initialize() {
    if (unsubscribeStatus) {
      return;
    }

    set({ status: get().server ? 'ready' : 'loading' });

    try {
      unsubscribeStatus = getBridge().onRemoteStatus((server) => {
        set({ server, status: 'ready', error: null });
      });
    } catch {
      unsubscribeStatus = null;
    }

    await get().refresh();
  },

  async refresh() {
    try {
      const bridge = getBridge();
      const [server, devices] = await Promise.all([
        unwrap(bridge.getRemoteStatus()),
        unwrap(bridge.listDevices()),
      ]);
      set({ server, devices, status: 'ready', error: null });
    } catch (error) {
      set({ status: 'error', error: toErrorMessage(error) });
    }
  },

  async saveSettings(input) {
    set({ busy: 'save', error: null });
    try {
      const server = await unwrap(getBridge().saveRemoteSettings(input));
      set({ server });
      return true;
    } catch (error) {
      set({ error: toErrorMessage(error) });
      return false;
    } finally {
      set({ busy: null });
    }
  },

  async start() {
    set({ busy: 'start', error: null });
    try {
      const server = await unwrap(getBridge().startRemoteServer());
      set({ server });
    } catch (error) {
      set({ error: toErrorMessage(error) });
    } finally {
      set({ busy: null });
    }
  },

  async stop() {
    set({ busy: 'stop', error: null });
    try {
      const server = await unwrap(getBridge().stopRemoteServer());
      set({ server });
    } catch (error) {
      set({ error: toErrorMessage(error) });
    } finally {
      set({ busy: null });
    }
  },

  async createPairing() {
    set({ busy: 'pairing', error: null });
    try {
      const pairing = await unwrap(getBridge().createRemotePairing());
      const server = get().server;
      if (server) {
        set({ server: { ...server, pairing } });
      }
      return true;
    } catch (error) {
      set({ error: toErrorMessage(error) });
      return false;
    } finally {
      set({ busy: null });
    }
  },

  async revokeDevice(deviceId) {
    set({ busy: 'revoke', error: null });
    try {
      await unwrap(getBridge().revokeDevice({ deviceId }));
      await get().refresh();
    } catch (error) {
      set({ error: toErrorMessage(error) });
    } finally {
      set({ busy: null });
    }
  },

  dismissError() {
    set({ error: null });
  },
}));
