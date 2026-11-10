import { create } from 'zustand';
import type { ViewId } from '../lib/navigation';

interface NavigationState {
  view: ViewId;
  setView: (view: ViewId) => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  // Device-first: the 3D deck is the landing screen, not an admin dashboard.
  view: 'decks',
  setView: (view) => set({ view }),
}));
