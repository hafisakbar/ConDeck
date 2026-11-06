import {
  Bell,
  Cast,
  Circle,
  Clock,
  Film,
  Gamepad2,
  Headphones,
  Image as ImageIcon,
  ListMusic,
  MessageSquare,
  Mic,
  MicOff,
  Monitor,
  Music,
  Pause,
  Play,
  Power,
  Radio,
  Scissors,
  Settings,
  SkipBack,
  SkipForward,
  Square,
  Star,
  Volume2,
  VolumeX,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { ButtonIconName } from '@condeck/shared';

/**
 * Maps the stored icon identifier (see `buttonIconNames` in @condeck/shared) to a
 * Lucide component. The database only ever stores the identifier.
 */
export const buttonIcons: Record<ButtonIconName, LucideIcon> = {
  bell: Bell,
  cast: Cast,
  circle: Circle,
  clock: Clock,
  film: Film,
  'gamepad-2': Gamepad2,
  headphones: Headphones,
  image: ImageIcon,
  'list-music': ListMusic,
  'message-square': MessageSquare,
  mic: Mic,
  'mic-off': MicOff,
  monitor: Monitor,
  music: Music,
  pause: Pause,
  play: Play,
  power: Power,
  radio: Radio,
  scissors: Scissors,
  settings: Settings,
  'skip-back': SkipBack,
  'skip-forward': SkipForward,
  square: Square,
  star: Star,
  'volume-2': Volume2,
  'volume-x': VolumeX,
  zap: Zap,
};

export function resolveButtonIcon(name: string | null): LucideIcon | null {
  if (!name) {
    return null;
  }
  return buttonIcons[name as ButtonIconName] ?? null;
}
