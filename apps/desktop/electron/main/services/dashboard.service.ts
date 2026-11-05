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
}

/**
 * OBS status is derived from the integrations table, never hard-coded.
 * The live OBS client arrives in Phase 4; until then a configured integration
 * reports DISCONNECTED instead of pretending to be connected.
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

export function buildDashboardSummary({ db, appInfo, activityLimit = 8 }: DashboardContext): DashboardSummary {
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
    obs: resolveObsStatus(db),
    activity: listRecentActivity(db, activityLimit),
  };
}
