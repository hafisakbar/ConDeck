import type { NavigationDirection } from '@condeck/shared';

/**
 * Everything an action handler may know about the button that triggered it.
 * The mobile remote (Phase 5) will provide the same context from a button id.
 */
export interface ActionContext {
  buttonId: string;
  buttonLabel: string;
  pageId: string;
  deckId: string;
}

/**
 * OBS operations. The desktop supplies the obs-websocket-js implementation
 * (packages/obs-integration); while OBS is not connected the port reports
 * `OBS_DISCONNECTED` instead of pretending to work (ADR-014, ADR-020).
 */
export interface ObsPort {
  isConnected(): boolean;
  switchScene(sceneName: string): Promise<void>;
  startStreaming(): Promise<void>;
  stopStreaming(): Promise<void>;
  startRecording(): Promise<void>;
  stopRecording(): Promise<void>;
  getInputMute(inputName: string): Promise<boolean>;
  setInputMute(inputName: string, muted: boolean): Promise<void>;
}

/**
 * Desktop OS operations. Both calls take a single, already validated value:
 * there is no shell, no argument list and no free-form command.
 */
export interface SystemPort {
  openApplication(applicationPath: string): Promise<void>;
  openUrl(url: string): Promise<void>;
}

/** Page navigation is owned by the renderer, so the desktop port forwards it. */
export interface NavigationPort {
  navigate(direction: NavigationDirection, context: ActionContext): void | Promise<void>;
}

/**
 * Soundboard playback lives in the renderer (it owns the audio device), so the
 * desktop port validates the file and forwards the request. Returns the sound
 * name so the execution message can mention it.
 */
export interface SoundboardPort {
  play(soundId: string, mode: 'restart' | 'ignore'): Promise<string>;
}

export interface ActionPorts {
  obs: ObsPort;
  system: SystemPort;
  navigation: NavigationPort;
  soundboard: SoundboardPort;
}
