import { remoteDefaults } from '@condeck/websocket-protocol';

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,256}$/;

/**
 * The QR code opens `http://<host>:<port>/#pair=<token>`. The token lives in the
 * fragment, so it is never sent to the desktop's HTTP server or a proxy log.
 */
export function parsePairingToken(hashOrSearch: string): string | null {
  const raw = hashOrSearch.startsWith('#') || hashOrSearch.startsWith('?')
    ? hashOrSearch.slice(1)
    : hashOrSearch;

  if (raw.length === 0) {
    return null;
  }

  for (const part of raw.split('&')) {
    const [key, value] = part.split('=');
    if (key === 'pair' && value) {
      let decoded: string;
      try {
        decoded = decodeURIComponent(value);
      } catch {
        return null;
      }
      return TOKEN_PATTERN.test(decoded) ? decoded : null;
    }
  }
  return null;
}

/** `ws://` only, matching the desktop host (TECHNICAL_SPECIFICATION.md §8). */
export function buildWebSocketUrl(host: string, port: number): string {
  const withoutScheme = host.trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  const hostAndPort = withoutScheme.replace(/\/.*$/, '').trim();
  // Accept a pasted "host:port" and bracketed IPv6 literals, but always use
  // the port the user configured.
  const hostname = hostAndPort.startsWith('[')
    ? hostAndPort.replace(/^(\[[^\]]+\]).*$/, '$1')
    : hostAndPort.replace(/:\d+$/, '');

  return `ws://${hostname}:${port}${remoteDefaults.wsPath}`;
}

export interface ConnectionTarget {
  host: string;
  port: number;
}

/**
 * When the page is served by the desktop host, the address is already known.
 * During mobile development the URL is a dev server, so the user types the host.
 */
export function targetFromLocation(
  location: { hostname: string; port: string; protocol: string },
): ConnectionTarget | null {
  const isDesktopHost = location.protocol === 'http:' || location.protocol === 'https:';
  if (!isDesktopHost) {
    return null;
  }

  const port = Number(location.port || (location.protocol === 'https:' ? 443 : 80));
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    return null;
  }

  // Vite's dev server is not a ConDeck host, so do not prefill its address.
  if (location.port === '5274') {
    return null;
  }

  return { host: location.hostname, port };
}
