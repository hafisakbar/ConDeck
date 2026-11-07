/**
 * The OBS client talks to a narrow socket interface instead of
 * `obs-websocket-js` directly. The desktop supplies the real adapter; tests
 * supply a fake, so no test ever opens a network connection.
 */
export interface ObsSocket {
  connect(url: string, password?: string): Promise<unknown>;
  disconnect(): Promise<void>;
  call(requestType: string, requestData?: unknown): Promise<unknown>;
  on(event: string, listener: (payload: unknown) => void): void;
  removeAllListeners(): void;
}

export type ObsSocketFactory = () => ObsSocket;

export interface ObsConnectionConfig {
  host: string;
  port: number;
  /** `null` / `undefined` connects without a password. */
  password?: string | null;
}

/**
 * Snapshot of everything ConDeck knows about OBS. It is pushed to the renderer
 * after every OBS event, so the UI never polls and never guesses a state.
 */
export interface ObsClientStatus {
  connected: boolean;
  sceneName: string | null;
  scenes: string[];
  isStreaming: boolean;
  isRecording: boolean;
  mutedInputs: Record<string, boolean>;
}

export interface ObsClientOptions {
  createSocket?: ObsSocketFactory;
  /** How long a connection attempt may take. */
  connectTimeoutMs?: number;
  /** How long a single OBS request may take. */
  requestTimeoutMs?: number;
}

export interface ObsClient {
  connect(config: ObsConnectionConfig): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  snapshot(): ObsClientStatus;
  subscribe(listener: (status: ObsClientStatus) => void): () => void;
  listScenes(): Promise<string[]>;
  switchScene(sceneName: string): Promise<void>;
  startStreaming(): Promise<void>;
  stopStreaming(): Promise<void>;
  startRecording(): Promise<void>;
  stopRecording(): Promise<void>;
  getInputMute(inputName: string): Promise<boolean>;
  setInputMute(inputName: string, muted: boolean): Promise<void>;
}
