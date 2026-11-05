import type { ObsStatus } from '@condeck/shared';
import type { StatusTone } from '../components/ui/StatusIndicator';

export const obsToneByState: Record<ObsStatus['state'], StatusTone> = {
  CONNECTED: 'online',
  DISCONNECTED: 'warning',
  DISABLED: 'offline',
  NOT_CONFIGURED: 'offline',
};

export const obsLabelByState: Record<ObsStatus['state'], string> = {
  CONNECTED: 'Connected',
  DISCONNECTED: 'Not connected',
  DISABLED: 'Disabled',
  NOT_CONFIGURED: 'Not configured',
};
