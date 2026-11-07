import type { ObsSnapshot, ObsTestResult, SaveObsSettingsInput } from '@condeck/shared';
import { create } from 'zustand';
import { getBridge, toErrorMessage, unwrap } from '../lib/desktop-bridge';

type ObsLoadStatus = 'idle' | 'loading' | 'ready' | 'error';
type ObsBusy = 'save' | 'connect' | 'disconnect' | 'test' | null;

interface ObsState {
  status: ObsLoadStatus;
  /** Live view of the OBS connection; pushed by the main process. */
  snapshot: ObsSnapshot | null;
  error: string | null;
  busy: ObsBusy;
  testResult: ObsTestResult | null;
  initialize: () => Promise<void>;
  saveSettings: (input: SaveObsSettingsInput) => Promise<boolean>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  testConnection: (input: SaveObsSettingsInput) => Promise<void>;
  refreshScenes: () => Promise<void>;
  dismissTestResult: () => void;
  dismissError: () => void;
}

let unsubscribeStatus: (() => void) | null = null;

export const useObsStore = create<ObsState>((set, get) => ({
  status: 'idle',
  snapshot: null,
  error: null,
  busy: null,
  testResult: null,

  async initialize() {
    if (unsubscribeStatus) {
      return;
    }

    set({ status: get().snapshot ? 'ready' : 'loading' });
    try {
      const snapshot = await unwrap(getBridge().getObsSnapshot());
      set({ snapshot, status: 'ready', error: null });
    } catch (error) {
      set({ status: 'error', error: toErrorMessage(error) });
    }

    try {
      unsubscribeStatus = getBridge().onObsStatus((snapshot) => {
        set({ snapshot, status: 'ready', error: null });
      });
    } catch {
      unsubscribeStatus = null;
    }
  },

  async saveSettings(input) {
    set({ busy: 'save', error: null, testResult: null });
    try {
      const snapshot = await unwrap(getBridge().saveObsSettings(input));
      set({ snapshot });
      return true;
    } catch (error) {
      set({ error: toErrorMessage(error) });
      return false;
    } finally {
      set({ busy: null });
    }
  },

  async connect() {
    set({ busy: 'connect', error: null, testResult: null });
    try {
      const snapshot = await unwrap(getBridge().connectObs());
      set({ snapshot });
    } catch (error) {
      set({ error: toErrorMessage(error) });
    } finally {
      set({ busy: null });
    }
  },

  async disconnect() {
    set({ busy: 'disconnect', error: null });
    try {
      const snapshot = await unwrap(getBridge().disconnectObs());
      set({ snapshot });
    } catch (error) {
      set({ error: toErrorMessage(error) });
    } finally {
      set({ busy: null });
    }
  },

  async testConnection(input) {
    set({ busy: 'test', error: null, testResult: null });
    try {
      const result = await unwrap(getBridge().testObsConnection(input));
      set({ testResult: result });
    } catch (error) {
      set({ error: toErrorMessage(error) });
    } finally {
      set({ busy: null });
    }
  },

  async refreshScenes() {
    if (get().snapshot?.state !== 'CONNECTED') {
      return;
    }
    try {
      const scenes = await unwrap(getBridge().listObsScenes());
      const snapshot = get().snapshot;
      if (snapshot) {
        set({ snapshot: { ...snapshot, scenes } });
      }
    } catch {
      // The pushed status remains the source of truth when a refresh fails.
    }
  },

  dismissTestResult() {
    set({ testResult: null });
  },

  dismissError() {
    set({ error: null });
  },
}));
