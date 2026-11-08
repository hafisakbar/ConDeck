import { readFile } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
import { extname, resolve, sep } from 'node:path';

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

/**
 * The mobile app runs from an IP address over plain HTTP, so it cannot use a
 * secure-context-only feature. The policy only allows its own origin and the
 * WebSocket connection back to this host.
 */
const MOBILE_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self' ws: wss:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; '),
};

export function applyMobileHeaders(response: ServerResponse): void {
  for (const [name, value] of Object.entries(MOBILE_HEADERS)) {
    response.setHeader(name, value);
  }
}

function hasExtension(pathname: string): boolean {
  return extname(pathname) !== '';
}

/**
 * Resolves a request path inside the mobile build directory without ever
 * escaping it, then sends the file. Returns false when nothing matches so the
 * caller can decide what to do next.
 */
export async function serveMobileFile(
  root: string,
  pathname: string,
  response: ServerResponse,
): Promise<boolean> {
  const decoded = safeDecode(pathname);
  if (decoded === null) {
    return false;
  }

  const isAppShell = decoded === '/' || !hasExtension(decoded);
  const relative = isAppShell ? '/index.html' : decoded;
  const target = resolve(root, `.${relative}`);

  if (target !== resolve(root, '.') && !target.startsWith(`${resolve(root)}${sep}`)) {
    return false;
  }

  let body: Buffer;
  try {
    body = await readFile(target);
  } catch {
    return false;
  }

  const extension = extname(target).toLowerCase();
  response.setHeader('Content-Type', CONTENT_TYPES[extension] ?? 'application/octet-stream');
  response.setHeader(
    'Cache-Control',
    relative.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
  );
  applyMobileHeaders(response);
  response.statusCode = 200;
  response.end(body);
  return true;
}

function safeDecode(pathname: string): string | null {
  try {
    const decoded = decodeURIComponent(pathname);
    return decoded.includes('\0') ? null : decoded;
  } catch {
    return null;
  }
}

/** Shown when the desktop build has no mobile bundle next to it. */
export function sendMobileNotBuiltPage(response: ServerResponse): void {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ConDeck Remote</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0a0c11; color: #e8ebf2; font-family: 'Segoe UI', system-ui, sans-serif; padding: 24px; }
      main { max-width: 34rem; }
      h1 { font-size: 1.25rem; margin: 0 0 8px; }
      p { color: #98a1b3; line-height: 1.6; font-size: 0.875rem; }
      code { background: #161a22; border: 1px solid #222834; border-radius: 6px; padding: 2px 6px; font-size: 0.8rem; }
    </style>
  </head>
  <body>
    <main>
      <h1>ConDeck Remote is not built yet</h1>
      <p>The desktop host is running and its WebSocket server is ready, but the mobile app bundle is missing.</p>
      <p>Run <code>pnpm --filter @condeck/mobile build</code> (or <code>pnpm build</code>) on the desktop, then reload this page.</p>
    </main>
  </body>
</html>`;

  applyMobileHeaders(response);
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.statusCode = 200;
  response.end(html);
}
