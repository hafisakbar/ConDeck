import type { ActionPorts, NavigationPort, ObsPort, SystemPort } from '@condeck/action-engine';
import { AppError, type NavigationRequest } from '@condeck/shared';
import { shell } from 'electron';

const OBS_UNAVAILABLE =
  'OBS is not connected. Live OBS control arrives with the Phase 4 integration.';

/**
 * Phase 3 has no OBS WebSocket client yet. Every OBS operation fails with
 * OBS_DISCONNECTED instead of reporting a fake success, and the UI shows that
 * message on the button.
 */
function createObsPort(): ObsPort {
  const unavailable = async (): Promise<never> => {
    throw new AppError('OBS_DISCONNECTED', OBS_UNAVAILABLE);
  };

  return {
    isConnected: () => false,
    switchScene: unavailable,
    startStreaming: unavailable,
    stopStreaming: unavailable,
    startRecording: unavailable,
    stopRecording: unavailable,
    getInputMute: unavailable,
    setInputMute: unavailable,
  };
}

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
}

export function createActionPorts({ sendNavigation }: ActionPortsOptions): ActionPorts {
  return {
    obs: createObsPort(),
    system: createSystemPort(),
    navigation: createNavigationPort(sendNavigation),
  };
}
