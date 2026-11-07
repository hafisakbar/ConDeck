import {
  countDecks,
  countDevices,
  countProfiles,
  getActiveProfile,
  getIntegrationByProvider,
  listRecentActivity,
  type ConDeckDb,
} from '@condeck/database';
import type { AppInfo, DashboardSummary, ObsStatus } from '@condeck/shared';

export interface DashboardContext {
  db: ConDeckDb;
  appInfo: AppInfo;
  activityLimit?: number;
  /** Live OBS state provider; falls back to the stored configuration. */
  obsStatus?: () => ObsStatus;
}

/**
 * Fallback OBS status derived from the integrations table, used before the OBS
 * service exists (tests) or when no live provider is injected. A configured
 * integration never claims to be connected on its own.
 */
function resolveObsStatus(db: ConDeckDb): ObsStatus {
  const integration = getIntegrationByProvider(db, 'obs');
  if (!integration) {
    return { state: 'NOT_CONFIGURED', message: 'OBS Studio has not been configured yet.' };
  }
  if (!integration.isEnabled) {
    return { state: 'DISABLED', message: 'OBS integration is disabled.' };
  }
  return { state: 'DISCONNECTED', message: 'OBS is configured but not connected.' };
}

export function buildDashboardSummary({
  db,
  appInfo,
  activityLimit = 8,
  obsStatus,
}: DashboardContext): DashboardSummary {
  return {
    app: appInfo,
    profile: {
      active: getActiveProfile(db),
      total: countProfiles(db),
    },
    deck: {
      total: countDecks(db),
    },
    devices: countDevices(db),
    obs: obsStatus ? obsStatus() : resolveObsStatus(db),
    activity: listRecentActivity(db, activityLimit),
  };
}
