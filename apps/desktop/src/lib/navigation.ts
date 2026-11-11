import { LayoutDashboard, LayoutGrid, Layers, PlugZap, Settings, Smartphone, type LucideIcon } from 'lucide-react';
import type { MessageKey } from '../i18n';

export type ViewId = 'dashboard' | 'decks' | 'profiles' | 'integrations' | 'devices' | 'settings';

export interface NavigationItem {
  id: ViewId;
  labelKey: MessageKey;
  icon: LucideIcon;
}

/**
 * Order follows PRD §7.2. Activity no longer has its own tab: it is shown on the
 * dashboard and opened as a temporary view from there.
 */
export const navigationItems: readonly NavigationItem[] = [
  { id: 'dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { id: 'decks', labelKey: 'nav.decks', icon: LayoutGrid },
  { id: 'profiles', labelKey: 'nav.profiles', icon: Layers },
  { id: 'integrations', labelKey: 'nav.integrations', icon: PlugZap },
  { id: 'devices', labelKey: 'nav.devices', icon: Smartphone },
  { id: 'settings', labelKey: 'nav.settings', icon: Settings },
];

export function getNavigationItem(view: ViewId): NavigationItem {
  const item = navigationItems.find((entry) => entry.id === view);
  if (!item) {
    throw new Error(`Unknown view: ${view}`);
  }
  return item;
}
