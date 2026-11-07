import { actionConfigSchemas, AppError } from '@condeck/shared';
import type { ActionPorts } from './ports';
import { createActionRegistry, defineAction, type ActionDefinition } from './registry';

/**
 * All action types declared in PRD §5.4. Handlers only call ports: they never
 * touch Electron, the database or the network directly, which keeps them
 * testable and keeps execution behind the registry.
 */

function requireObs(ports: ActionPorts): void {
  if (!ports.obs.isConnected()) {
    throw new AppError(
      'OBS_DISCONNECTED',
      'OBS is not connected. Open Integrations, connect to OBS Studio, then try again.',
    );
  }
}

export const actionDefinitions: readonly ActionDefinition[] = [
  defineAction('OBS_SWITCH_SCENE', actionConfigSchemas.OBS_SWITCH_SCENE, async (config, ports) => {
    requireObs(ports);
    await ports.obs.switchScene(config.sceneName);
    return `Scene switched to "${config.sceneName}".`;
  }),

  defineAction(
    'OBS_START_STREAMING',
    actionConfigSchemas.OBS_START_STREAMING,
    async (_config, ports) => {
      requireObs(ports);
      await ports.obs.startStreaming();
      return 'Streaming started.';
    },
  ),

  defineAction(
    'OBS_STOP_STREAMING',
    actionConfigSchemas.OBS_STOP_STREAMING,
    async (_config, ports) => {
      requireObs(ports);
      await ports.obs.stopStreaming();
      return 'Streaming stopped.';
    },
  ),

  defineAction(
    'OBS_START_RECORDING',
    actionConfigSchemas.OBS_START_RECORDING,
    async (_config, ports) => {
      requireObs(ports);
      await ports.obs.startRecording();
      return 'Recording started.';
    },
  ),

  defineAction(
    'OBS_STOP_RECORDING',
    actionConfigSchemas.OBS_STOP_RECORDING,
    async (_config, ports) => {
      requireObs(ports);
      await ports.obs.stopRecording();
      return 'Recording stopped.';
    },
  ),

  defineAction('OBS_TOGGLE_MUTE', actionConfigSchemas.OBS_TOGGLE_MUTE, async (config, ports) => {
    requireObs(ports);
    const muted = await ports.obs.getInputMute(config.inputName);
    await ports.obs.setInputMute(config.inputName, !muted);
    return `"${config.inputName}" is now ${muted ? 'unmuted' : 'muted'}.`;
  }),

  defineAction('OBS_SET_MUTE', actionConfigSchemas.OBS_SET_MUTE, async (config, ports) => {
    requireObs(ports);
    await ports.obs.setInputMute(config.inputName, config.muted);
    return `"${config.inputName}" is now ${config.muted ? 'muted' : 'unmuted'}.`;
  }),

  defineAction('SYSTEM_OPEN_APP', actionConfigSchemas.SYSTEM_OPEN_APP, async (config, ports) => {
    await ports.system.openApplication(config.applicationPath);
    return `Opened ${config.applicationPath}.`;
  }),

  defineAction('SYSTEM_OPEN_URL', actionConfigSchemas.SYSTEM_OPEN_URL, async (config, ports) => {
    await ports.system.openUrl(config.url);
    return `Opened ${config.url}.`;
  }),

  defineAction('NAV_NEXT_PAGE', actionConfigSchemas.NAV_NEXT_PAGE, async (_config, ports, context) => {
    await ports.navigation.navigate('next', context);
    return 'Moved to the next page.';
  }),

  defineAction('NAV_PREV_PAGE', actionConfigSchemas.NAV_PREV_PAGE, async (_config, ports, context) => {
    await ports.navigation.navigate('prev', context);
    return 'Moved to the previous page.';
  }),
];

export const actionRegistry = createActionRegistry(actionDefinitions);
