import type { DeckButtonWithAction, ObsSnapshot } from '@condeck/shared';

/**
 * Whether a button's action is in a state that should light the key up.
 *
 * Only real state reported by OBS counts: a failed execution never turns a key
 * green, and an unreachable OBS connection clears every active key. Actions
 * without a persistent state (navigation, system, scene switch excepted) stay
 * in their normal look.
 */
export function isButtonActive(
  button: Pick<DeckButtonWithAction, 'action'>,
  obs: ObsSnapshot | null,
): boolean {
  const action = button.action;
  if (!action) {
    return false;
  }
  if (obs?.state !== 'CONNECTED') {
    return false;
  }

  switch (action.actionType) {
    case 'OBS_START_STREAMING':
    case 'OBS_STOP_STREAMING':
      return obs.isStreaming;
    case 'OBS_START_RECORDING':
    case 'OBS_STOP_RECORDING':
      return obs.isRecording;
    case 'OBS_SWITCH_SCENE': {
      const sceneName = action.config.sceneName;
      return typeof sceneName === 'string' && obs.sceneName === sceneName;
    }
    case 'OBS_TOGGLE_MUTE':
    case 'OBS_SET_MUTE': {
      const inputName = action.config.inputName;
      return typeof inputName === 'string' && obs.mutedInputs[inputName] === true;
    }
    default:
      return false;
  }
}
