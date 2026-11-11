import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createButton,
  createDeck,
  createProfile,
  getDeckDetail,
  openDatabase,
  setButtonAction,
  type ConDeckDatabase,
} from '@condeck/database';
import type { ActionExecutionResult } from '@condeck/shared';
import { chromium, type Browser, type Page } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createRemoteServer,
  type RemoteServer,
} from '../apps/desktop/electron/main/services/remote-server.service';

/**
 * End-to-end test of the real mobile PWA against the real desktop remote server:
 * built assets are served over HTTP, the WebSocket protocol runs, and presses
 * reach the same executeAction callback the desktop app wires to its Action Engine.
 */
const mobileDir = fileURLToPath(new URL('../apps/mobile/dist', import.meta.url));

let browser: Browser;
let database: ConDeckDatabase;
let server: RemoteServer;
let port = 0;
let deckId = '';
let buttonId = '';
const pressed: string[] = [];

const successResult: ActionExecutionResult = {
  buttonId: '',
  actionType: 'OBS_START_STREAMING',
  status: 'SUCCESS',
  code: null,
  message: 'OBS is now streaming.',
  durationMs: 8,
};

beforeAll(async () => {
  expect(
    existsSync(join(mobileDir, 'index.html')),
    'The mobile PWA has not been built. Run `pnpm build` before the E2E suite.',
  ).toBe(true);

  database = openDatabase({ filePath: ':memory:' });
  const profile = createProfile(database.db, { name: 'Streaming' });
  const deck = createDeck(database.db, {
    profileId: profile.id,
    name: 'Main deck',
    columns: 3,
    rows: 3,
  });
  deckId = deck.deck.id;
  const pageId = deck.pages[0]?.id ?? '';
  const button = createButton(database.db, { pageId, position: 0, label: 'Go live' });
  buttonId = button.id;
  setButtonAction(database.db, {
    buttonId,
    actionType: 'OBS_START_STREAMING',
    config: {},
  });

  server = createRemoteServer({
    db: database.db,
    executeAction: async (id) => {
      pressed.push(id);
      return { ...successResult, buttonId: id };
    },
    getActiveDeck: () => getDeckDetail(database.db, deckId),
    getObsSnapshot: () => null,
    mobileAssetsDir: mobileDir,
    port: 0,
    host: '127.0.0.1',
    pairingTtlMs: 60_000,
  });

  const status = await server.start();
  port = status.port;

  browser = await chromium.launch();
}, 60_000);

afterAll(async () => {
  await browser?.close();
  await server?.stop();
  database?.close();
});

function bodyContains(page: Page, text: string, timeout = 15_000): Promise<unknown> {
  return page.waitForFunction(
    (expected) => document.body.textContent?.includes(expected) === true,
    text,
    { timeout },
  );
}

async function pairPage(): Promise<Page> {
  const pairing = await server.createPairing();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`http://127.0.0.1:${port}/#pair=${pairing.token}`);

  const confirm = page.getByRole('button', { name: /pair this phone/i });
  await confirm.waitFor({ state: 'visible', timeout: 15_000 });
  await confirm.click();

  await bodyContains(page, 'Go live');
  return page;
}

describe('mobile remote end to end', () => {
  it('serves the built PWA with a locked-down content policy', async () => {
    const response = await fetch(`http://127.0.0.1:${port}/`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(response.headers.get('x-frame-options')).toBe('DENY');

    const manifest = await fetch(`http://127.0.0.1:${port}/manifest.webmanifest`);
    expect(manifest.status).toBe(200);
    expect((await manifest.json()) as { name: string }).toMatchObject({
      name: expect.stringContaining('StreamKey'),
    });
  });

  it('pairs from the QR link, renders the deck, and presses a button', async () => {
    const page = await pairPage();

    await bodyContains(page, 'Main deck');
    await page.getByText('Go live', { exact: true }).waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Go live' }).click();

    await bodyContains(page, 'OBS is now streaming.', 10_000);
    expect(pressed).toEqual([buttonId]);

    await page.close();
  });

  it('shows a readable error for an unknown pairing code instead of connecting', async () => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`http://127.0.0.1:${port}/#pair=${'a'.repeat(43)}`);

    const confirm = page.getByRole('button', { name: /pair this phone/i });
    await confirm.waitFor({ state: 'visible', timeout: 15_000 });
    await confirm.click();

    const alert = page.getByRole('alert');
    await alert.waitFor({ state: 'visible', timeout: 10_000 });
    expect((await alert.textContent())?.trim().length ?? 0).toBeGreaterThan(0);
    expect(pressed).toHaveLength(1);

    await page.close();
  });
});
