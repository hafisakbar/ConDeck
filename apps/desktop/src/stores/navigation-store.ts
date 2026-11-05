import { create } from 'zustand';
import type { ViewId } from '../lib/navigation';

interface NavigationState {
  view: ViewId;
  setView: (view: ViewId) => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  view: 'dashboard',
  setView: (view) => set({ view }),
}));
