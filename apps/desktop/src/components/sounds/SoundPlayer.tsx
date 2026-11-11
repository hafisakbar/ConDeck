import { useEffect } from 'react';
import { getBridge } from '../../lib/desktop-bridge';
import { useSoundStore } from '../../stores/sound-store';

/**
 * Headless bridge between the main process and the renderer's audio output.
 * Mounted once in App so both deck presses and mobile remotes play through the
 * same windows.
 */
export function SoundPlayer() {
  useEffect(() => {
    const bridge = getBridge();
    void useSoundStore.getState().load();
    const unsubscribe = bridge.onSoundPlay((event) => {
      void useSoundStore.getState().playEvent(event);
    });
    return unsubscribe;
  }, []);

  return null;
}
