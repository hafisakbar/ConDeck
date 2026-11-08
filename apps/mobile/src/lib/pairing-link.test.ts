import { describe, expect, it } from 'vitest';
import { buildWebSocketUrl, parsePairingToken, targetFromLocation } from './pairing-link';

const TOKEN = 'Zm9vYmFyYmF6cXV1eDEyMzQ1Njc4OTA';

describe('parsePairingToken', () => {
  it('reads the token from the QR link fragment', () => {
    expect(parsePairingToken(`#pair=${TOKEN}`)).toBe(TOKEN);
  });

  it('also accepts a query string and extra parameters', () => {
    expect(parsePairingToken(`?debug=1&pair=${TOKEN}`)).toBe(TOKEN);
  });

  it('decodes percent-encoded tokens', () => {
    expect(parsePairingToken('#pair=abc%2Ddefghijklmnopqrstuvwxyz0123')).toBe(
      'abc-defghijklmnopqrstuvwxyz0123',
    );
  });

  it('rejects missing, short and malformed tokens', () => {
    expect(parsePairingToken('')).toBeNull();
    expect(parsePairingToken('#')).toBeNull();
    expect(parsePairingToken('#pair=short')).toBeNull();
    expect(parsePairingToken('#pair=%E0%A4%A')).toBeNull();
    expect(parsePairingToken('#other=value')).toBeNull();
    expect(parsePairingToken(`#pair=${'a'.repeat(300)}`)).toBeNull();
  });
});

describe('buildWebSocketUrl', () => {
  it('builds the contract URL with the /ws path', () => {
    expect(buildWebSocketUrl('192.168.1.20', 43821)).toBe('ws://192.168.1.20:43821/ws');
  });

  it('cleans pasted hosts that include a scheme, port or path', () => {
    expect(buildWebSocketUrl('http://condeck.local:43821/', 43821)).toBe('ws://condeck.local:43821/ws');
    expect(buildWebSocketUrl('  ws://10.0.0.5  ', 9000)).toBe('ws://10.0.0.5:9000/ws');
    expect(buildWebSocketUrl('192.168.1.20:9999', 43821)).toBe('ws://192.168.1.20:43821/ws');
    expect(buildWebSocketUrl('[fe80::1]:43821', 43821)).toBe('ws://[fe80::1]:43821/ws');
  });
});

describe('targetFromLocation', () => {
  it('uses the desktop origin when the remote is served by the host', () => {
    expect(targetFromLocation({ hostname: '192.168.1.20', port: '43821', protocol: 'http:' })).toEqual({
      host: '192.168.1.20',
      port: 43821,
    });
  });

  it('does not prefill the Vite development server', () => {
    expect(targetFromLocation({ hostname: 'localhost', port: '5274', protocol: 'http:' })).toBeNull();
  });

  it('falls back to the protocol default port when none is given', () => {
    expect(targetFromLocation({ hostname: 'condeck.local', port: '', protocol: 'http:' })).toEqual({
      host: 'condeck.local',
      port: 80,
    });
  });
});
