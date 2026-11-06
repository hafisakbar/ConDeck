import type { ActivityLog, AppInfo, DashboardSummary, Device, Profile } from '@condeck/shared';
import { create } from 'zustand';
import { getBridge, toErrorMessage, unwrap } from '../lib/desktop-bridge';

type LoadStatus = 'loading' | 'ready' | 'error';

interface AppState {
  status: LoadStatus;
  error: string | null;
  appInfo: AppInfo | null;
  summary: DashboardSummary | null;
  profiles: Profile[];
  devices: Device[];
  activity: ActivityLog[];
  busyProfileId: string | null;
  refresh: () => Promise<void>;
  createProfile: (input: { name: string; description?: string }) => Promise<boolean>;
  updateProfile: (input: {
    profileId: string;
    name?: string;
    description?: string | null;
  }) => Promise<boolean>;
  activateProfile: (profileId: string) => Promise<void>;
  deleteProfile: (profileId: string) => Promise<boolean>;
  dismissError: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  status: 'loading',
  error: null,
  appInfo: null,
  summary: null,
  profiles: [],
  devices: [],
  activity: [],
  busyProfileId: null,

  async refresh() {
    try {
      const bridge = getBridge();
      const [summary, profiles, devices, activity] = await Promise.all([
        unwrap(bridge.getDashboardSummary()),
        unwrap(bridge.listProfiles()),
        unwrap(bridge.listDevices()),
        unwrap(bridge.listActivity({ limit: 50 })),
      ]);

      set({
        status: 'ready',
        error: null,
        summary,
        appInfo: summary.app,
        profiles,
        devices,
        activity,
      });
    } catch (error) {
      set({ status: 'error', error: toErrorMessage(error) });
    }
  },

  async createProfile(input) {
    try {
      const bridge = getBridge();
      await unwrap(bridge.createProfile(input));
      await get().refresh();
      return true;
    } catch (error) {
      set({ error: toErrorMessage(error) });
      return false;
    }
  },

  async updateProfile(input) {
    try {
      const bridge = getBridge();
      await unwrap(bridge.updateProfile(input));
      await get().refresh();
      return true;
    } catch (error) {
      set({ error: toErrorMessage(error) });
      return false;
    }
  },

  async activateProfile(profileId) {
    set({ busyProfileId: profileId });
    try {
      const bridge = getBridge();
      await unwrap(bridge.setActiveProfile({ profileId }));
      await get().refresh();
    } catch (error) {
      set({ error: toErrorMessage(error) });
    } finally {
      set({ busyProfileId: null });
    }
  },

  async deleteProfile(profileId) {
    set({ busyProfileId: profileId });
    try {
      const bridge = getBridge();
      await unwrap(bridge.deleteProfile({ profileId }));
      await get().refresh();
      return true;
    } catch (error) {
      set({ error: toErrorMessage(error) });
      return false;
    } finally {
      set({ busyProfileId: null });
    }
  },

  dismissError() {
    set({ error: null });
  },
}));
