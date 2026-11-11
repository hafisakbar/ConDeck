import {
  CUSTOM_ICON_MAX_BYTES,
  customIconId,
  customIconMimeTypes,
  type ButtonIcon,
  type CustomIcon,
} from '@condeck/shared';
import { useEffect } from 'react';
import { create } from 'zustand';
import { getBridge, toErrorMessage, unwrap } from '../lib/desktop-bridge';

interface IconState {
  status: 'idle' | 'loading' | 'ready';
  icons: CustomIcon[];
  sources: Record<string, string>;
  error: string | null;
  load: () => Promise<void>;
  upload: (file: File) => Promise<ButtonIcon | null>;
  remove: (iconId: string) => Promise<void>;
  clearError: () => void;
}

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('The image could not be read.'));
    reader.readAsDataURL(file);
  });
}

export const useIconStore = create<IconState>((set, get) => ({
  status: 'idle',
  icons: [],
  sources: {},
  error: null,

  async load() {
    set({ status: 'loading', error: null });
    try {
      const icons = await unwrap(getBridge().listCustomIcons());
      set({
        icons,
        sources: Object.fromEntries(icons.map((icon) => [icon.id, icon.dataUrl])),
        status: 'ready',
      });
    } catch (error) {
      set({ status: 'ready', error: toErrorMessage(error) });
    }
  },

  async upload(file) {
    set({ error: null });
    if (!customIconMimeTypes.includes(file.type as (typeof customIconMimeTypes)[number])) {
      set({ error: 'invalid' });
      return null;
    }
    if (file.size > CUSTOM_ICON_MAX_BYTES) {
      set({ error: 'invalid' });
      return null;
    }
    try {
      const dataUrl = await readDataUrl(file);
      const name = file.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'Custom icon';
      const icon = await unwrap(getBridge().createCustomIcon({ name, dataUrl }));
      set((state) => ({
        icons: [icon, ...state.icons],
        sources: { ...state.sources, [icon.id]: icon.dataUrl },
        status: 'ready',
      }));
      return `custom:${icon.id}`;
    } catch (error) {
      set({ error: toErrorMessage(error) });
      return null;
    }
  },

  async remove(iconId) {
    set({ error: null });
    try {
      await unwrap(getBridge().deleteCustomIcon({ iconId }));
      set((state) => {
        const sources = { ...state.sources };
        delete sources[iconId];
        return { icons: state.icons.filter((icon) => icon.id !== iconId), sources };
      });
    } catch (error) {
      set({ error: toErrorMessage(error) });
    }
  },

  clearError() {
    set({ error: null });
  },
}));

/** Data URL for a `custom:<uuid>` icon reference, loading the library on demand. */
export function useIconSource(icon: ButtonIcon | null | undefined): string | null {
  const id = customIconId(icon);
  const source = useIconStore((state) => (id ? (state.sources[id] ?? null) : null));
  const status = useIconStore((state) => state.status);
  const load = useIconStore((state) => state.load);

  useEffect(() => {
    if (id && !source && status === 'idle') {
      void load();
    }
  }, [id, source, status, load]);

  return source;
}
