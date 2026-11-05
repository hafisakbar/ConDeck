import {
  LayoutDashboard,
  LayoutGrid,
  Layers,
  PlugZap,
  Smartphone,
  ScrollText,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export type ViewId =
  | 'dashboard'
  | 'decks'
  | 'profiles'
  | 'integrations'
  | 'devices'
  | 'activity'
  | 'settings';

export interface NavigationItem {
  id: ViewId;
  label: string;
  headline: string;
  description: string;
  icon: LucideIcon;
}

/** Order and labels follow PRD §7.2 (Dashboard … Settings). */
export const navigationItems: readonly NavigationItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    headline: 'Dashboard',
    description: 'Your stream at a glance.',
    icon: LayoutDashboard,
  },
  {
    id: 'decks',
    label: 'My Deck',
    headline: 'My Deck',
    description: 'Design the buttons you press on stream.',
    icon: LayoutGrid,
  },
  {
    id: 'profiles',
    label: 'Profiles',
    headline: 'Profiles',
    description: 'Separate decks for streaming, gaming and everything else.',
    icon: Layers,
  },
  {
    id: 'integrations',
    label: 'Integrations',
    headline: 'Integrations',
    description: 'Connect ConDeck to OBS Studio.',
    icon: PlugZap,
  },
  {
    id: 'devices',
    label: 'Remote Devices',
    headline: 'Remote Devices',
    description: 'Pair a phone or tablet as a remote controller.',
    icon: Smartphone,
  },
  {
    id: 'activity',
    label: 'Activity Logs',
    headline: 'Activity Logs',
    description: 'Everything ConDeck has done recently.',
    icon: ScrollText,
  },
  {
    id: 'settings',
    label: 'Settings',
    headline: 'Settings',
    description: 'Application, network and storage details.',
    icon: Settings,
  },
];

export function getNavigationItem(view: ViewId): NavigationItem {
  const item = navigationItems.find((entry) => entry.id === view);
  if (!item) {
    throw new Error(`Unknown view: ${view}`);
  }
  return item;
}
