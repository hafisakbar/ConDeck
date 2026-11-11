import type { Sound, SoundPlayEvent } from '@condeck/shared';
import { create } from 'zustand';
import { getBridge, toErrorMessage, unwrap } from '../lib/desktop-bridge';

interface SoundState {
  sounds: Sound[];
  status: 'idle' | 'loading' | 'ready';
  error: string | null;
  playing: Record<string, boolean>;
  load: () => Promise<void>;
  importSounds: () => Promise<void>;
  remove: (soundId: string) => Promise<boolean>;
  togglePreview: (soundId: string) => Promise<void>;
  playEvent: (event: SoundPlayEvent) => Promise<void>;
  stop: (soundId: string) => void;
  stopAll: () => void;
  clearError: () => void;
}

/**
 * Audio elements live outside React. Playback happens in the renderer because
 * that is the process with the Windows output device; the main process only
 * validates the file and tells us which sound to play.
 */
const players = new Map<string, HTMLAudioElement>();
const audioCache = new Map<string, string>();
const pending = new Map<string, Promise<string>>();

function isPlaying(audio: HTMLAudioElement | undefined): boolean {
  return Boolean(audio) && !audio!.paused && !audio!.ended;
}

async function loadAudio(soundId: string): Promise<string> {
  const cached = audioCache.get(soundId);
  if (cached) {
    return cached;
  }
  const inFlight = pending.get(soundId);
  if (inFlight) {
    return inFlight;
  }
  const request = unwrap(getBridge().getSoundAudio({ soundId }))
    .then((audio) => {
      audioCache.set(soundId, audio.dataUrl);
      return audio.dataUrl;
    })
    .finally(() => pending.delete(soundId));
  pending.set(soundId, request);
  return request;
}

export const useSoundStore = create<SoundState>((set, get) => ({
  sounds: [],
  status: 'idle',
  error: null,
  playing: {},

  async load() {
    set({ status: 'loading' });
    try {
      const sounds = await unwrap(getBridge().listSounds());
      set({ sounds, status: 'ready', error: null });
    } catch (error) {
      set({ status: 'ready', error: toErrorMessage(error) });
    }
  },

  async importSounds() {
    try {
      const imported = await unwrap(getBridge().importSounds());
      if (imported.length === 0) {
        return;
      }
      set((state) => {
        const ids = new Set(imported.map((sound) => sound.id));
        return {
          sounds: [...imported, ...state.sounds.filter((sound) => !ids.has(sound.id))].sort((a, b) =>
            a.name.localeCompare(b.name),
          ),
          error: null,
        };
      });
    } catch (error) {
      set({ error: toErrorMessage(error) });
    }
  },

  async remove(soundId) {
    try {
      await unwrap(getBridge().deleteSound({ soundId }));
      audioCache.delete(soundId);
      players.get(soundId)?.pause();
      players.delete(soundId);
      set((state) => {
        const playing = { ...state.playing };
        delete playing[soundId];
        return {
          sounds: state.sounds.filter((sound) => sound.id !== soundId),
          playing,
          error: null,
        };
      });
      return true;
    } catch (error) {
      set({ error: toErrorMessage(error) });
      return false;
    }
  },

  async togglePreview(soundId) {
    const current = players.get(soundId);
    if (isPlaying(current)) {
      current!.pause();
      set((state) => ({ playing: { ...state.playing, [soundId]: false } }));
      return;
    }
    try {
      const dataUrl = await loadAudio(soundId);
      const audio = current ?? new Audio(dataUrl);
      if (!current) {
        audio.addEventListener('ended', () => {
          set((state) => ({ playing: { ...state.playing, [soundId]: false } }));
        });
        audio.addEventListener('error', () => {
          set((state) => ({
            playing: { ...state.playing, [soundId]: false },
            error: 'The audio file could not be played.',
          }));
        });
        players.set(soundId, audio);
      }
      audio.currentTime = 0;
      await audio.play();
      set((state) => ({ playing: { ...state.playing, [soundId]: true } }));
    } catch (error) {
      set({ error: toErrorMessage(error) });
    }
  },

  async playEvent({ soundId, mode }) {
    try {
      const dataUrl = await loadAudio(soundId);
      const existing = players.get(soundId);
      if (mode === 'ignore' && isPlaying(existing)) {
        return;
      }
      const audio = existing ?? new Audio(dataUrl);
      if (!existing) {
        audio.addEventListener('ended', () => {
          set((state) => ({ playing: { ...state.playing, [soundId]: false } }));
        });
        players.set(soundId, audio);
      }
      audio.currentTime = 0;
      await audio.play();
      set((state) => ({ playing: { ...state.playing, [soundId]: true } }));
    } catch (error) {
      set({ error: toErrorMessage(error) });
    }
  },

  stop(soundId) {
    const audio = players.get(soundId);
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    set((state) => ({ playing: { ...state.playing, [soundId]: false } }));
  },

  stopAll() {
    for (const audio of players.values()) {
      audio.pause();
      audio.currentTime = 0;
    }
    set({ playing: {} });
  },

  clearError() {
    set({ error: null });
  },
}));
