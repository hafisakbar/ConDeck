import type {
  SaveTikTokSettingsInput,
  TikTokSnapshot,
  TikTokTestResult,
} from '@condeck/shared';
import { create } from 'zustand';
import { getBridge, toErrorMessage, unwrap } from '../lib/desktop-bridge';

type TikTokLoadStatus = 'idle' | 'loading' | 'ready' | 'error';
type TikTokBusy = 'save' | 'connect' | 'disconnect' | 'test' | null;

interface TikTokState {
  status: TikTokLoadStatus;
  /** Live view of the LIVE Studio connection; pushed by the main process. */
  snapshot: TikTokSnapshot | null;
  error: string | null;
  busy: TikTokBusy;
  testResult: TikTokTestResult | null;
  initialize: () => Promise<void>;
  saveSettings: (input: SaveTikTokSettingsInput) => Promise<boolean>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  testConnection: () => Promise<void>;
  dismissTestResult: () => void;
  dismissError: () => void;
}

let unsubscribeStatus: (() => void) | null = null;

export const useTikTokStore = create<TikTokState>((set, get) => ({
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
      const snapshot = await unwrap(getBridge().getTikTokSnapshot());
      set({ snapshot, status: 'ready', error: null });
    } catch (error) {
      set({ status: 'error', error: toErrorMessage(error) });
    }

    try {
      unsubscribeStatus = getBridge().onTikTokStatus((snapshot) => {
        set({ snapshot, status: 'ready' });
      });
    } catch {
      unsubscribeStatus = null;
    }
  },

  async saveSettings(input) {
    set({ busy: 'save', error: null, testResult: null });
    try {
      const snapshot = await unwrap(getBridge().saveTikTokSettings(input));
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
      const snapshot = await unwrap(getBridge().connectTikTok());
      set({ snapshot });
    } catch (error) {
      set({ error: toErrorMessage(error) });
    } finally {
      set({ busy: null });
    }
  },

  async disconnect() {
    set({ busy: 'disconnect', error: null, testResult: null });
    try {
      const snapshot = await unwrap(getBridge().disconnectTikTok());
      set({ snapshot });
    } catch (error) {
      set({ error: toErrorMessage(error) });
    } finally {
      set({ busy: null });
    }
  },

  async testConnection() {
    set({ busy: 'test', error: null, testResult: null });
    try {
      const result = await unwrap(getBridge().testTikTokConnection());
      set({ testResult: result });
    } catch (error) {
      set({ error: toErrorMessage(error) });
    } finally {
      set({ busy: null });
    }
  },

  dismissTestResult() {
    set({ testResult: null });
  },

  dismissError() {
    set({ error: null });
  },
}));
