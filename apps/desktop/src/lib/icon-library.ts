import { buttonIconNames, type ButtonIconName } from '@condeck/shared';

export const iconCategories = ['general', 'media', 'audio', 'system', 'gaming', 'extras'] as const;
export type IconCategory = (typeof iconCategories)[number];

export interface LibraryIcon {
  name: ButtonIconName;
  category: IconCategory;
  /** Space separated haystack: the identifier plus any extra words. */
  keywords: string;
}

/**
 * Category hints for the curated identifiers. Anything not listed lands in
 * "extras", so adding an icon to the shared list never breaks the picker.
 */
const groups: Partial<Record<IconCategory, readonly string[]>> = {
  media: [
    'play', 'pause', 'stop-circle', 'skip-back', 'skip-forward', 'rewind', 'fast-forward',
    'video', 'video-off', 'camera', 'camera-off', 'film', 'clapperboard', 'image', 'images',
    'gallery-horizontal', 'monitor-play', 'monitor-pause', 'monitor-stop', 'tv', 'youtube', 'twitch',
  ],
  audio: [
    'mic', 'mic-off', 'headphones', 'music', 'list-music', 'volume', 'volume-1', 'volume-2',
    'volume-x', 'audio-lines', 'audio-waveform', 'radio', 'disc-3', 'speaker', 'bell', 'bell-ring',
  ],
  system: [
    'settings', 'power', 'lock', 'unlock', 'shield', 'wifi', 'bluetooth', 'battery', 'cpu',
    'terminal', 'folder', 'file-text', 'trash-2', 'download', 'upload', 'refresh-cw', 'rotate-ccw',
    'sun', 'moon', 'monitor', 'laptop', 'smartphone', 'plug', 'gauge', 'keyboard', 'mouse',
  ],
  gaming: [
    'gamepad', 'gamepad-2', 'joystick', 'swords', 'sword', 'crosshair', 'target', 'trophy', 'crown',
    'dice-5', 'ghost', 'skull', 'flame', 'zap', 'rocket', 'puzzle', 'shield-half',
  ],
  general: [
    'home', 'layout-grid', 'layout-dashboard', 'star', 'heart', 'bookmark', 'flag', 'tag', 'link',
    'clipboard', 'share-2', 'thumbs-up', 'smile', 'sparkles', 'lightbulb', 'circle', 'square',
    'triangle', 'hash', 'plus', 'minus', 'check', 'x', 'arrow-right', 'arrow-left', 'chevron-right',
    'message-square', 'users', 'user', 'calendar', 'clock', 'gift', 'megaphone', 'palette',
  ],
};

const categoryOf = new Map<string, IconCategory>();
for (const [category, names] of Object.entries(groups) as [IconCategory, readonly string[]][]) {
  for (const name of names) {
    categoryOf.set(name, category);
  }
}

export const iconLibrary: readonly LibraryIcon[] = buttonIconNames.map((name) => ({
  name,
  category: categoryOf.get(name) ?? 'extras',
  keywords: `${name} ${name.replace(/-/g, ' ')}`.toLowerCase(),
}));

export function filterIcons(
  icons: readonly LibraryIcon[],
  query: string,
  category: IconCategory | 'all',
): LibraryIcon[] {
  const needle = query.trim().toLowerCase();
  return icons.filter((icon) => {
    if (category !== 'all' && icon.category !== category) {
      return false;
    }
    return needle.length === 0 || icon.keywords.includes(needle);
  });
}
