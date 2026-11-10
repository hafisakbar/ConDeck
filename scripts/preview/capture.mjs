import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

/**
 * Renders the production build of the desktop UI in Chromium with a mock bridge
 * and writes review screenshots. Run `pnpm --filter @condeck/desktop build`
 * first; this is a review tool, not a replacement for the Electron app.
 */
const root = fileURLToPath(new URL('../../', import.meta.url));
const dist = join(root, 'apps/desktop/dist');
const mockScript = join(root, 'scripts/preview/mock-bridge.js');
const output = join(root, 'docs/screenshots');

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};

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
const port = server.address().port;

await mkdir(output, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox'],
});

const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
page.on('console', (message) => {
  if (message.type() === 'error') {
    console.error('[renderer]', message.text());
  }
});
page.on('pageerror', (error) => console.error('[pageerror]', error.message));

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
console.log('step: workspace');

await page.screenshot({ path: join(output, 'workspace.png'), timeout: 90_000 });
console.log('step: menu');

await page.getByRole('button', { name: 'Open menu' }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: join(output, 'menu.png'), timeout: 90_000 });
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

const canvas = page.locator('canvas');
const box = await canvas.boundingBox();
if (box) {
  const candidates = [
    [0.5, 0.47],
    [0.5, 0.5],
    [0.45, 0.47],
    [0.55, 0.47],
    [0.5, 0.42],
    [0.5, 0.55],
  ];
  console.log('step: click candidate');
  for (const [fx, fy] of candidates) {
    await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
    await page.waitForTimeout(400);
    if ((await page.getByRole('dialog', { name: 'Button properties' }).count()) > 0) {
      console.log('properties panel opened at', fx, fy);
      break;
    }
  }
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(output, 'properties.png'), timeout: 90_000 });
  console.log(
    'dialog count',
    await page.getByRole('dialog').count(),
    'canvas size',
    Math.round(box.width),
    Math.round(box.height),
  );
}

await browser.close();
server.close();
console.log('Screenshots written to docs/screenshots');
