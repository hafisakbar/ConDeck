import { integrations, openDatabase, type ConDeckDb } from '@condeck/database';
import type { ObsClient, ObsClientStatus, ObsConnectionConfig } from '@condeck/obs-integration';
import { AppError, type SaveObsSettingsInput } from '@condeck/shared';
import { describe, expect, it, vi } from 'vitest';
import type { SecretStore } from './obs-secrets';
import { createObsService } from './obs.service';

class FakeSecrets implements SecretStore {
  available = true;
  readonly encrypt = vi.fn((value: string) =>
    `safeStorage:v1:${Buffer.from(value).toString('base64')}`,
  );
  readonly decrypt = vi.fn((reference: string) => {
    if (!reference.startsWith('safeStorage:v1:')) {
      throw new AppError('OBS_CONNECTION_FAILED', 'The saved OBS password could not be read.');
    }
    return Buffer.from(reference.slice('safeStorage:v1:'.length), 'base64').toString();
  });

  isAvailable(): boolean {
    return this.available;
  }
}

class FakeClient implements ObsClient {
  readonly connectCalls: ObsConnectionConfig[] = [];
  readonly connect = vi.fn(async (config: ObsConnectionConfig) => {
    this.connectCalls.push(config);
    if (this.failWith) {
      throw this.failWith;
    }
    this.connected = true;
    this.status = {
      ...this.status,
      connected: true,
      scenes: ['Main', 'Starting soon'],
      sceneName: this.sceneName,
    };
    this.notify();
  });

  readonly disconnect = vi.fn(async () => {
    this.connected = false;
    this.status = emptyStatus();
    this.notify();
  });

  failWith: Error | null = null;
  connected = false;
  sceneName = 'Starting soon';
  status: ObsClientStatus = emptyStatus();

  private listeners = new Set<(status: ObsClientStatus) => void>();

  isConnected(): boolean {
    return this.connected;
  }

  snapshot(): ObsClientStatus {
    return { ...this.status, scenes: [...this.status.scenes] };
  }

  subscribe(listener: (status: ObsClientStatus) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  notify(): void {
    const snapshot = this.snapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  readonly listScenes = vi.fn(async () => this.status.scenes);
  readonly switchScene = vi.fn(async () => undefined);
  readonly startStreaming = vi.fn(async () => undefined);
  readonly stopStreaming = vi.fn(async () => undefined);
  readonly startRecording = vi.fn(async () => undefined);
  readonly stopRecording = vi.fn(async () => undefined);
  readonly getInputMute = vi.fn(async () => false);
  readonly setInputMute = vi.fn(async () => undefined);
}

function emptyStatus(): ObsClientStatus {
  return {
    connected: false,
    sceneName: null,
    scenes: [],
    isStreaming: false,
    isRecording: false,
    mutedInputs: {},
  };
}

function settings(overrides: Partial<SaveObsSettingsInput> = {}): SaveObsSettingsInput {
  return { host: '127.0.0.1', port: 4455, isEnabled: true, ...overrides };
}

function setup(options: { available?: boolean; failConnections?: boolean } = {}) {
  const database = openDatabase({ filePath: ':memory:' });
  const secrets = new FakeSecrets();
  secrets.available = options.available ?? true;
  const clients: FakeClient[] = [];
  const changes: unknown[] = [];

  const service = createObsService({
    db: database.db,
    secrets,
    createClient: () => {
      const client = new FakeClient();
      if (options.failConnections) {
        client.failWith = new AppError('OBS_CONNECTION_FAILED', 'Could not connect to OBS.');
      }
      clients.push(client);
      return client;
    },
    onChange: (snapshot) => changes.push(snapshot),
  });

  return { service, secrets, clients, changes, db: database.db, close: () => database.close() };
}

function integrationRows(db: ConDeckDb) {
  return db.select().from(integrations).all();
}

describe('OBS settings', () => {
  it('reports a fresh install as not configured', () => {
    const { service, close } = setup();

    expect(service.getSnapshot()).toMatchObject({
      state: 'NOT_CONFIGURED',
      host: null,
      port: null,
      hasPassword: false,
    });
    close();
  });

  it('stores host, port and an encrypted password reference', () => {
    const { service, secrets, db, close } = setup();

    const snapshot = service.saveSettings(settings({ password: 'sup3r-secret' }));

    expect(snapshot).toMatchObject({
      state: 'DISCONNECTED',
      host: '127.0.0.1',
      port: 4455,
      isEnabled: true,
      hasPassword: true,
    });
    expect(secrets.encrypt).toHaveBeenCalledWith('sup3r-secret');

    const row = integrationRows(db)[0];
    expect(row?.credentialReference).not.toContain('sup3r-secret');
    expect(row?.credentialReference).toMatch(/^safeStorage:v1:/);
    close();
  });

  it('keeps the stored password when the field is left blank', () => {
    const { service, db, close } = setup();
    service.saveSettings(settings({ password: 'secret' }));
    const first = integrationRows(db)[0]?.credentialReference;

    service.saveSettings(settings({ host: '192.168.1.20' }));

    const row = integrationRows(db)[0];
    expect(row?.host).toBe('192.168.1.20');
    expect(row?.credentialReference).toBe(first);
    close();
  });

  it('removes the stored password when an empty string is saved', () => {
    const { service, db, close } = setup();
    service.saveSettings(settings({ password: 'secret' }));

    const snapshot = service.saveSettings(settings({ password: '' }));

    expect(snapshot.hasPassword).toBe(false);
    expect(integrationRows(db)[0]?.credentialReference).toBeNull();
    close();
  });

  it('refuses to store a password when the OS has no secure store', () => {
    const { service, close } = setup({ available: false });

    expect(() => service.saveSettings(settings({ password: 'secret' }))).toThrowError(
      /secure credential store/i,
    );
    close();
  });

  it('still saves an address-only configuration without a secure store', () => {
    const { service, close } = setup({ available: false });

    expect(() => service.saveSettings(settings())).not.toThrow();
    close();
  });

  it('does not claim to be connected after settings change', () => {
    const { service, clients, close } = setup();
    service.saveSettings(settings());
    clients[0]!.connected = true;

    const snapshot = service.saveSettings(settings({ port: 4456 }));

    expect(clients[0]!.disconnect).toHaveBeenCalled();
    expect(snapshot.state).toBe('DISCONNECTED');
    close();
  });
});

describe('OBS connection', () => {
  it('connects with the saved address and decrypted password', async () => {
    const { service, secrets, clients, close } = setup();
    service.saveSettings(settings({ password: 'secret' }));

    const snapshot = await service.connect();

    expect(secrets.decrypt).toHaveBeenCalled();
    expect(clients[0]?.connectCalls).toEqual([
      { host: '127.0.0.1', port: 4455, password: 'secret' },
    ]);
    expect(snapshot).toMatchObject({
      state: 'CONNECTED',
      sceneName: 'Starting soon',
      scenes: ['Main', 'Starting soon'],
    });
    close();
  });

  it('refuses to connect before the address is configured', async () => {
    const { service, close } = setup();

    await expect(service.connect()).rejects.toThrowError(/has not been configured/i);
    close();
  });

  it('refuses to connect while the integration is disabled', async () => {
    const { service, close } = setup();
    service.saveSettings(settings({ isEnabled: false }));

    await expect(service.connect()).rejects.toThrowError(/disabled/i);
    close();
  });

  it('keeps the failure message and stays disconnected when OBS refuses', async () => {
    const { service, clients, changes, close } = setup();
    service.saveSettings(settings());
    clients[0]!.failWith = new AppError(
      'OBS_CONNECTION_FAILED',
      'Could not connect to OBS at 127.0.0.1:4455.',
    );

    await expect(service.connect()).rejects.toThrowError(/Could not connect/);

    const snapshot = service.getSnapshot();
    expect(snapshot.state).toBe('DISCONNECTED');
    expect(snapshot.message).toMatch(/Could not connect/);
    expect(changes.length).toBeGreaterThan(0);
    close();
  });

  it('disconnects and returns to the configured state', async () => {
    const { service, clients, close } = setup();
    service.saveSettings(settings());
    await service.connect();

    const snapshot = await service.disconnect();

    expect(clients[0]?.disconnect).toHaveBeenCalled();
    expect(snapshot.state).toBe('DISCONNECTED');
    expect(snapshot.scenes).toEqual([]);
    close();
  });

  it('pushes live OBS changes to the desktop listener', async () => {
    const { service, clients, changes, close } = setup();
    service.saveSettings(settings());
    await service.connect();
    changes.length = 0;

    clients[0]!.status = { ...clients[0]!.status, isStreaming: true };
    clients[0]!.notify();

    const last = changes[changes.length - 1] as { isStreaming: boolean; state: string };
    expect(last.state).toBe('CONNECTED');
    expect(last.isStreaming).toBe(true);
    close();
  });
});

describe('OBS test connection', () => {
  it('probes the address from the form without saving it', async () => {
    const { service, clients, db, close } = setup();

    const result = await service.testConnection(settings({ host: '10.0.0.5', port: 4456 }));

    expect(result.ok).toBe(true);
    expect(result.scenes).toEqual(['Main', 'Starting soon']);
    expect(clients[1]?.connectCalls).toEqual([
      { host: '10.0.0.5', port: 4456, password: null },
    ]);
    expect(clients[1]?.disconnect).toHaveBeenCalled();
    expect(integrationRows(db)).toHaveLength(0);
    close();
  });

  it('returns the failure as data so the form can show it', async () => {
    const { service, close } = setup({ failConnections: true });

    const result = await service.testConnection(settings());

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/Could not connect/);
    close();
  });
});

describe('OBS dashboard status and action port', () => {
  it('maps the live state for the dashboard', async () => {
    const { service, close } = setup();
    expect(service.getStatus().state).toBe('NOT_CONFIGURED');

    service.saveSettings(settings());
    expect(service.getStatus()).toEqual({
      state: 'DISCONNECTED',
      message: 'OBS is configured but not connected.',
    });

    await service.connect();
    expect(service.getStatus()).toEqual({ state: 'CONNECTED', message: 'Scene: Starting soon' });
    close();
  });

  it('delegates action commands to the connected client', async () => {
    const { service, clients, close } = setup();
    service.saveSettings(settings());
    await service.connect();
    const port = service.getActionPort();

    expect(port.isConnected()).toBe(true);
    await port.switchScene('Main');
    await port.setInputMute('Mic/Aux', true);

    expect(clients[0]?.switchScene).toHaveBeenCalledWith('Main');
    expect(clients[0]?.setInputMute).toHaveBeenCalledWith('Mic/Aux', true);
    close();
  });
});
