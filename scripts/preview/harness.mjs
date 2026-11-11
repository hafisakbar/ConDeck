import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

/**
 * Shared pieces for the preview harness scripts.
 *
 * The production renderer talks to `window.condeck` over IPC, so both scripts
 * serve the built desktop app with the mock bridge injected and launch the same
 * software-rendered Chromium. This is a review and verification tool, not a
 * replacement for the Electron app.
 */
const root = fileURLToPath(new URL('../../', import.meta.url));
const dist = join(root, 'apps/desktop/dist');
const mockScript = join(root, 'scripts/preview/mock-bridge.js');

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};

export async function startPreviewServer() {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.pathname === '/mock-bridge.js') {
      response.writeHead(200, { 'content-type': contentTypes['.js'] });
      response.end(await readFile(mockScript));
      return;
    }

    const relative = url.pathname === '/' ? '/index.html' : url.pathname;
    const file = join(dist, decodeURIComponent(relative));
    try {
      let body = await readFile(file);
      if (relative === '/index.html') {
        // The production CSP is injected for file://; the harness needs its mock script.
        body = Buffer.from(
          body
            .toString('utf8')
            .replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '')
            .replace('<script type="module"', '<script src="/mock-bridge.js"></script>\n    <script type="module"'),
        );
      }
      response.writeHead(200, { 'content-type': contentTypes[extname(file)] ?? 'application/octet-stream' });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end('Not found');
    }
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}/`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

export function launchPreviewBrowser() {
  return chromium.launch({
    args: [
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--disable-gpu-sandbox',
      // Small /dev/shm in containers makes Chromium die mid-screenshot.
      '--disable-dev-shm-usage',
      '--no-sandbox',
    ],
  });
}
