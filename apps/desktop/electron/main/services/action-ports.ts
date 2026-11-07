import type { ActionPorts, NavigationPort, ObsPort, SystemPort } from '@condeck/action-engine';
import { AppError, type NavigationRequest } from '@condeck/shared';
import { shell } from 'electron';

/**
 * Opens a path or a URL with the OS default handler. No shell is involved, so a
 * stored value can never turn into an arbitrary command with extra arguments.
 */
function createSystemPort(): SystemPort {
  return {
    async openApplication(applicationPath) {
      const failure = await shell.openPath(applicationPath);
      if (failure.length > 0) {
        throw new AppError('ACTION_FAILED', `The application could not be opened: ${failure}`);
      }
    },
    async openUrl(url) {
      try {
        await shell.openExternal(url);
      } catch {
        throw new AppError('ACTION_FAILED', 'The URL could not be opened in the default browser.');
      }
    },
  };
}

/**
 * Page navigation belongs to the renderer, because that is where the active
 * page lives. The port forwards the request over IPC.
 */
function createNavigationPort(
  sendNavigation: (request: NavigationRequest) => void,
): NavigationPort {
  return {
    navigate(direction, context) {
      sendNavigation({ direction, buttonId: context.buttonId });
    },
  };
}

export interface ActionPortsOptions {
  sendNavigation: (request: NavigationRequest) => void;
  /** Live OBS connection owned by the OBS service. */
  obs: ObsPort;
}

export function createActionPorts({ sendNavigation, obs }: ActionPortsOptions): ActionPorts {
  return {
    obs,
    system: createSystemPort(),
    navigation: createNavigationPort(sendNavigation),
  };
}
