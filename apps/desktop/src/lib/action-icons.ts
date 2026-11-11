import {
  AppWindow,
  CirclePlay,
  CircleStop,
  Clapperboard,
  Globe,
  Keyboard,
  Layers,
  Mic,
  Radio,
  Square,
  Volume2,
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
  NAV_NEXT_PAGE: Keyboard,
  NAV_PREV_PAGE: Clapperboard,
};

export function actionIcon(type: ActionType): LucideIcon {
  return byType[type] ?? Keyboard;
}
