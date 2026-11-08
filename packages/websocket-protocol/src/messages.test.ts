import { describe, expect, it } from 'vitest';
import {
  createClientMessage,
  createRequestId,
  createServerMessage,
  parseClientMessage,
  parseServerMessage,
  serializeMessage,
} from './messages';
import { remoteDefaults, remoteProtocolVersion } from './protocol';

const token = 'a'.repeat(43);

function pairFrame(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    type: 'auth.pair',
    requestId: createRequestId(),
    timestamp: new Date().toISOString(),
    payload: { pairingToken: token, deviceName: 'My phone', deviceType: 'mobile' },
    ...overrides,
  });
}

describe('remote protocol constants', () => {
  it('matches the documented defaults', () => {
    expect(remoteProtocolVersion).toBe(1);
    expect(remoteDefaults.port).toBe(43821);
    expect(remoteDefaults.wsPath).toBe('/ws');
    expect(remoteDefaults.pairingTokenTtlMs).toBeLessThanOrEqual(5 * 60 * 1000);
    expect(remoteDefaults.maxMessageBytes).toBe(8 * 1024);
  });
});

describe('createRequestId', () => {
  it('returns unique UUIDs', () => {
    const ids = new Set(Array.from({ length: 50 }, () => createRequestId()));
    expect(ids.size).toBe(50);
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
  });
});

describe('parseClientMessage', () => {
  it('accepts a valid pairing request and applies the default device type', () => {
    const frame = JSON.stringify({
      type: 'auth.pair',
      requestId: createRequestId(),
      timestamp: new Date().toISOString(),
      payload: { pairingToken: token, deviceName: '  Phone  ' },
    });

    const result = parseClientMessage(frame);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.message.type).toBe('auth.pair');
    if (result.message.type !== 'auth.pair') {
      return;
    }
    expect(result.message.payload.deviceName).toBe('Phone');
    expect(result.message.payload.deviceType).toBe('mobile');
  });

  it('rejects an unknown message type', () => {
    const frame = pairFrame({ type: 'shell.run' });
    const result = parseClientMessage(frame);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.code).toBe('INVALID_REQUEST');
    expect(result.closeConnection).toBe(false);
    expect(result.requestId).not.toBeNull();
  });

  it('rejects a pairing token that is too short', () => {
    const frame = pairFrame({
      payload: { pairingToken: 'short', deviceName: 'Phone', deviceType: 'mobile' },
    });
    const result = parseClientMessage(frame);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.message).toContain('pairingToken');
  });

  it('rejects payload fields the protocol does not define', () => {
    const frame = pairFrame({
      payload: {
        pairingToken: token,
        deviceName: 'Phone',
        deviceType: 'mobile',
        command: 'rm -rf /',
      },
    });
    expect(parseClientMessage(frame).ok).toBe(false);
  });

  it('rejects oversized frames and asks to close the socket', () => {
    const frame = JSON.stringify({
      type: 'auth.pair',
      requestId: createRequestId(),
      timestamp: new Date().toISOString(),
      payload: { pairingToken: token, deviceName: 'x'.repeat(9_000), deviceType: 'mobile' },
    });

    const result = parseClientMessage(frame);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.code).toBe('INVALID_REQUEST');
    expect(result.closeConnection).toBe(true);
    expect(result.bytes).toBeGreaterThan(remoteDefaults.maxMessageBytes);
  });

  it('rejects invalid JSON without closing the connection', () => {
    const result = parseClientMessage('{not json');
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.closeConnection).toBe(false);
    expect(result.message).toMatch(/JSON/);
  });

  it('rejects a message without a request id', () => {
    const frame = JSON.stringify({
      type: 'ping',
      timestamp: new Date().toISOString(),
      payload: {},
    });
    expect(parseClientMessage(frame).ok).toBe(false);
  });
});

describe('server messages', () => {
  const snapshot = {
    deckId: createRequestId(),
    name: 'Main Deck',
    columns: 3,
    rows: 3,
    pages: [
      {
        id: createRequestId(),
        name: 'Main',
        position: 0,
        buttons: [
          {
            id: createRequestId(),
            position: 0,
            label: 'Go live',
            icon: 'play',
            backgroundColor: '#1b2030',
            textColor: '#e8ebf2',
            isEnabled: true,
            hasAction: true,
          },
        ],
      },
    ],
  };

  it('creates a typed snapshot envelope that the client can parse', () => {
    const message = createServerMessage('deck.snapshot', snapshot);
    expect(message.type).toBe('deck.snapshot');
    expect(message.timestamp).toBeTruthy();

    const parsed = parseServerMessage(serializeMessage(message));
    expect(parsed?.type).toBe('deck.snapshot');
    if (parsed?.type !== 'deck.snapshot' || parsed.payload === null) {
      return;
    }
    expect(parsed.payload.pages[0]?.buttons[0]?.label).toBe('Go live');
  });

  it('allows a null snapshot when the active profile has no deck', () => {
    const message = createServerMessage('deck.snapshot', null);
    const parsed = parseServerMessage(serializeMessage(message));

    expect(parsed?.type).toBe('deck.snapshot');
    expect(parsed?.payload).toBeNull();
  });

  it('rejects a snapshot that leaks button configuration', () => {
    const message = createServerMessage('deck.snapshot', snapshot);
    const base = message.payload;
    expect(base).not.toBeNull();
    if (base === null) {
      return;
    }

    const leaked = {
      ...message,
      payload: {
        ...base,
        pages: [
          {
            ...base.pages[0],
            buttons: [
              {
                ...base.pages[0]?.buttons[0],
                config: { sceneName: 'secret' },
              },
            ],
          },
        ],
      },
    };

    expect(parseServerMessage(JSON.stringify(leaked))).toBeNull();
  });

  it('rejects unknown server messages', () => {
    expect(parseServerMessage(JSON.stringify({ type: 'deck.delete', payload: {} }))).toBeNull();
  });
});

describe('createClientMessage', () => {
  it('adds the envelope fields', () => {
    const message = createClientMessage('button.press', { buttonId: createRequestId() });
    expect(message.type).toBe('button.press');
    expect(message.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Date(message.timestamp).toISOString()).toBe(message.timestamp);
  });
});
