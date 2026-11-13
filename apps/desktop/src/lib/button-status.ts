import type { DeckButtonWithAction, ObsSnapshot, TikTokSnapshot } from '@condeck/shared';

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
  tiktok: TikTokSnapshot | null = null,
): boolean {
  const action = button.action;
  if (!action) {
    return false;
  }

  switch (action.actionType) {
    case 'TIKTOK_SWITCH_SCENE': {
      const sceneName = action.config.sceneName;
      return (
        tiktok?.state === 'CONNECTED' &&
        typeof sceneName === 'string' &&
        tiktok.sceneName === sceneName
      );
    }
    case 'TIKTOK_SET_MIC_MUTED':
    case 'TIKTOK_TOGGLE_MIC':
      return tiktok?.state === 'CONNECTED' && tiktok.micMuted;
    case 'TIKTOK_SET_AUDIO_MUTED':
    case 'TIKTOK_TOGGLE_AUDIO':
      return tiktok?.state === 'CONNECTED' && tiktok.audioMuted;
    case 'TIKTOK_START_RECORDING':
    case 'TIKTOK_STOP_RECORDING':
      return tiktok?.state === 'CONNECTED' && tiktok.recording;
    case 'OBS_START_STREAMING':
    case 'OBS_STOP_STREAMING':
      return obs?.state === 'CONNECTED' && obs.isStreaming;
    case 'OBS_START_RECORDING':
    case 'OBS_STOP_RECORDING':
      return obs?.state === 'CONNECTED' && obs.isRecording;
    case 'OBS_SWITCH_SCENE': {
      const sceneName = action.config.sceneName;
      return (
        obs?.state === 'CONNECTED' &&
        typeof sceneName === 'string' &&
        obs.sceneName === sceneName
      );
    }
    case 'OBS_TOGGLE_MUTE':
    case 'OBS_SET_MUTE': {
      const inputName = action.config.inputName;
      return (
        obs?.state === 'CONNECTED' &&
        typeof inputName === 'string' &&
        obs.mutedInputs[inputName] === true
      );
    }
    default:
      return false;
  }
}
