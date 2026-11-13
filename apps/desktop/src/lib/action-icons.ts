import {
  AppWindow,
  CirclePlay,
  CircleStop,
  Clapperboard,
  Globe,
  Keyboard,
  Layers,
  Mic,
  MicOff,
  MonitorPlay,
  RadioTower,
  Video,
  VideoOff,
  Radio,
  Square,
  Volume2,
  Music4,
  type LucideIcon,
} from 'lucide-react';
import type { ActionType } from '@condeck/shared';

/** One icon per real action type; categories fall back to a neutral icon. */
const byType: Record<ActionType, LucideIcon> = {
  OBS_SWITCH_SCENE: Layers,
  OBS_START_STREAMING: Radio,
  OBS_STOP_STREAMING: Square,
  OBS_START_RECORDING: CirclePlay,
  OBS_STOP_RECORDING: CircleStop,
  OBS_TOGGLE_MUTE: Volume2,
  OBS_SET_MUTE: Mic,
  SYSTEM_OPEN_APP: AppWindow,
  SYSTEM_OPEN_URL: Globe,
  SOUNDBOARD_PLAY: Music4,
  NAV_NEXT_PAGE: Keyboard,
  NAV_PREV_PAGE: Clapperboard,
  TIKTOK_SWITCH_SCENE: MonitorPlay,
  TIKTOK_SET_SOURCE_VISIBILITY: Video,
  TIKTOK_TOGGLE_SOURCE: VideoOff,
  TIKTOK_SET_MIC_MUTED: MicOff,
  TIKTOK_TOGGLE_MIC: Mic,
  TIKTOK_SET_AUDIO_MUTED: Volume2,
  TIKTOK_TOGGLE_AUDIO: Volume2,
  TIKTOK_START_RECORDING: RadioTower,
  TIKTOK_STOP_RECORDING: Square,
  TIKTOK_GET_STATUS: Radio,
};

export function actionIcon(type: ActionType): LucideIcon {
  return byType[type] ?? Keyboard;
}
