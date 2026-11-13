import { actionConfigSchemas, AppError, type TikTokState } from '@condeck/shared';
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

function requireTikTok(ports: ActionPorts): TikTokState {
  const state = ports.tiktok.getState();
  if (!ports.tiktok.isConnected() || !state) {
    throw new AppError(
      'TIKTOK_DISCONNECTED',
      'TikTok LIVE Studio is not connected. Open Integrations, connect to LIVE Studio, then try again.',
    );
  }
  return state;
}

function tiktokStatusMessage(state: TikTokState): string {
  const scene = state.sceneName ? `scene “${state.sceneName}”` : 'no active scene';
  return [
    `TikTok LIVE Studio is connected (${scene}).`,
    `Microphone ${state.micMuted ? 'muted' : 'live'},`,
    `audio ${state.audioMuted ? 'muted' : 'on'},`,
    `recording ${state.recording ? 'on' : 'off'}.`,
  ].join(' ');
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

  defineAction('TIKTOK_SWITCH_SCENE', actionConfigSchemas.TIKTOK_SWITCH_SCENE, async (config, ports) => {
    requireTikTok(ports);
    const state = await ports.tiktok.switchScene(config.sceneName);
    return `TikTok LIVE Studio switched to “${state.sceneName ?? config.sceneName}”.`;
  }),

  defineAction(
    'TIKTOK_SET_SOURCE_VISIBILITY',
    actionConfigSchemas.TIKTOK_SET_SOURCE_VISIBILITY,
    async (config, ports) => {
      requireTikTok(ports);
      const state = await ports.tiktok.setSourceVisible(
        config.sceneName,
        config.sourceId,
        config.visible,
      );
      const scene = state.scenes.find((entry) => entry.name === config.sceneName);
      const source = scene?.visibleSources.find((entry) => entry.value === config.sourceId);
      return `“${source?.label ?? config.sourceId}” is now ${config.visible ? 'visible' : 'hidden'} in “${config.sceneName}”.`;
    },
  ),

  defineAction('TIKTOK_TOGGLE_SOURCE', actionConfigSchemas.TIKTOK_TOGGLE_SOURCE, async (config, ports) => {
    const current = requireTikTok(ports);
    const scene = current.scenes.find((entry) => entry.name === config.sceneName);
    if (!scene) {
      throw new AppError(
        'ACTION_FAILED',
        `Scene “${config.sceneName}” is not present in TikTok LIVE Studio right now.`,
      );
    }
    const source = scene.sources.find((entry) => entry.value === config.sourceId);
    if (!source) {
      throw new AppError(
        'ACTION_FAILED',
        `Source “${config.sourceId}” is not part of scene “${config.sceneName}” right now.`,
      );
    }
    const visible = scene.visibleSources.some((entry) => entry.value === config.sourceId);
    const state = await ports.tiktok.setSourceVisible(
      config.sceneName,
      config.sourceId,
      !visible,
    );
    const after = state.scenes
      .find((entry) => entry.name === config.sceneName)
      ?.visibleSources.some((entry) => entry.value === config.sourceId);
    return `“${source.label}” is now ${after ? 'visible' : 'hidden'}.`;
  }),

  defineAction(
    'TIKTOK_SET_MIC_MUTED',
    actionConfigSchemas.TIKTOK_SET_MIC_MUTED,
    async (config, ports) => {
      requireTikTok(ports);
      const state = await ports.tiktok.setMicMuted(config.muted);
      return `TikTok microphone is ${state.micMuted ? 'muted' : 'live'}.`;
    },
  ),

  defineAction('TIKTOK_TOGGLE_MIC', actionConfigSchemas.TIKTOK_TOGGLE_MIC, async (_config, ports) => {
    const current = requireTikTok(ports);
    const state = await ports.tiktok.setMicMuted(!current.micMuted);
    return `TikTok microphone is ${state.micMuted ? 'muted' : 'live'}.`;
  }),

  defineAction(
    'TIKTOK_SET_AUDIO_MUTED',
    actionConfigSchemas.TIKTOK_SET_AUDIO_MUTED,
    async (config, ports) => {
      requireTikTok(ports);
      const state = await ports.tiktok.setAudioMuted(config.muted);
      return `TikTok audio is ${state.audioMuted ? 'muted' : 'on'}.`;
    },
  ),

  defineAction('TIKTOK_TOGGLE_AUDIO', actionConfigSchemas.TIKTOK_TOGGLE_AUDIO, async (_config, ports) => {
    const current = requireTikTok(ports);
    const state = await ports.tiktok.setAudioMuted(!current.audioMuted);
    return `TikTok audio is ${state.audioMuted ? 'muted' : 'on'}.`;
  }),

  defineAction(
    'TIKTOK_START_RECORDING',
    actionConfigSchemas.TIKTOK_START_RECORDING,
    async (_config, ports) => {
      const current = requireTikTok(ports);
      if (current.recording) {
        return 'TikTok LIVE Studio is already recording.';
      }
      const state = await ports.tiktok.setRecording(true);
      return state.recording ? 'TikTok recording started.' : 'Recording did not start.';
    },
  ),

  defineAction(
    'TIKTOK_STOP_RECORDING',
    actionConfigSchemas.TIKTOK_STOP_RECORDING,
    async (_config, ports) => {
      const current = requireTikTok(ports);
      if (!current.recording) {
        return 'TikTok LIVE Studio is not recording.';
      }
      const state = await ports.tiktok.setRecording(false);
      return state.recording ? 'Recording did not stop.' : 'TikTok recording stopped.';
    },
  ),

  defineAction('TIKTOK_GET_STATUS', actionConfigSchemas.TIKTOK_GET_STATUS, async (_config, ports) => {
    return tiktokStatusMessage(requireTikTok(ports));
  }),

  defineAction('SYSTEM_OPEN_APP', actionConfigSchemas.SYSTEM_OPEN_APP, async (config, ports) => {
    await ports.system.openApplication(config.applicationPath);
    return `Opened ${config.applicationPath}.`;
  }),

  defineAction('SYSTEM_OPEN_URL', actionConfigSchemas.SYSTEM_OPEN_URL, async (config, ports) => {
    await ports.system.openUrl(config.url);
    return `Opened ${config.url}.`;
  }),

  defineAction('SOUNDBOARD_PLAY', actionConfigSchemas.SOUNDBOARD_PLAY, async (config, ports) => {
    const name = await ports.soundboard.play(config.soundId, config.mode);
    return `Playing "${name}".`;
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
