import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchPreviewBrowser, startPreviewServer } from './harness.mjs';

/**
 * Renders the production build of the desktop UI in Chromium with a mock bridge
 * and writes review screenshots. Run `pnpm --filter @condeck/desktop build`
 * first; this is a review tool, not a replacement for the Electron app.
 */
const root = fileURLToPath(new URL('../../', import.meta.url));
const output = join(root, 'docs/screenshots');

await mkdir(output, { recursive: true });

const server = await startPreviewServer();
const browser = await launchPreviewBrowser();

const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
page.on('console', (message) => {
  if (message.type() === 'error') {
    console.error('[renderer]', message.text());
  }
});
page.on('pageerror', (error) => console.error('[pageerror]', error.message));

await page.goto(server.url, { waitUntil: 'networkidle' });
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
  // Hover a key, then leave the device: hover must light one key only and clear.
  console.log('step: hover');
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.47);
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(output, 'hover.png'), timeout: 90_000 });
  await page.mouse.move(box.x + box.width * 0.06, box.y + box.height * 0.1);
  await page.waitForTimeout(500);

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

  // Orbit the device to the right, then to the left: both sides of the chassis
  // must stay readable, which is what the lighting fix is judged on.
  async function orbit(direction) {
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.62);
    await page.mouse.down();
    for (let step = 1; step <= 12; step += 1) {
      await page.mouse.move(
        box.x + box.width * 0.5 + direction * step * 16,
        box.y + box.height * 0.62 - step * 2,
      );
      await page.waitForTimeout(16);
    }
    await page.mouse.up();
    await page.waitForTimeout(900);
  }

  console.log('step: orbit');
  await orbit(1);
  await page.screenshot({ path: join(output, 'orbit.png'), timeout: 90_000 });

  console.log('step: lighting from the other side');
  await orbit(-1);
  await orbit(-1);
  await page.screenshot({ path: join(output, 'lighting-left.png'), timeout: 90_000 });
  await orbit(1);
  await orbit(1);

  const activeTab = page.getByRole('tab', { name: 'Active' });
  if ((await activeTab.count()) > 0) {
    await activeTab.scrollIntoViewIfNeeded();
    await activeTab.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(output, 'appearance.png'), timeout: 90_000 });
    console.log('step: appearance');
  }

  console.log(
    'dialog count',
    await page.getByRole('dialog').count(),
    'canvas size',
    Math.round(box.width),
    Math.round(box.height),
  );
}

await browser.close();
await server.close();
console.log('Screenshots written to docs/screenshots');
