import { launchPreviewBrowser, startPreviewServer } from './harness.mjs';
import { colorDelta, meanColor } from './png.mjs';

/**
 * Measures the hover behaviour of the 3D keys instead of eyeballing it.
 *
 * Canvas-relative points: two neighbouring keys (A and B) and a spot off the
 * device. A small crop inside each key is compared across states; a hover must
 * brighten only the key under the pointer, must hold steady while the pointer
 * rests, and must clear when the pointer leaves. Later sessions check the press
 * and that a selected key is not restyled by hover.
 *
 * The software renderer in this container reliably dies after a handful of
 * screenshots, so each phase gets a fresh browser. Splitting the run is the
 * price of measuring real pixels here.
 */
const KEY_A = { x: 0.5, y: 0.47 };
const KEY_B = { x: 0.63, y: 0.47 };
const OFF = { x: 0.04, y: 0.08 };
/** Crop side in device pixels; a key face is roughly 130 px wide. */
const CROP = 70;
/** A change smaller than this is treated as noise from the software renderer. */
const NOISE = 0.8;
/** A hover has to be clearly visible to count. */
const VISIBLE = 1.2;

const failures = [];
function check(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} — ${detail}`);
  if (!ok) {
    failures.push(name);
  }
}

async function withSession(run) {
  const server = await startPreviewServer();
  const browser = await launchPreviewBrowser();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('crash', () => errors.push('renderer crashed'));

  await page.goto(server.url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2200);

  const box = await page.locator('canvas').boundingBox();
  if (!box) {
    throw new Error('The 3D canvas never appeared; nothing to measure.');
  }

  const point = (target) => ({ x: box.x + box.width * target.x, y: box.y + box.height * target.y });
  const crop = (target) => {
    const { x, y } = point(target);
    return { x: Math.round(x - CROP / 2), y: Math.round(y - CROP / 2), width: CROP, height: CROP };
  };
  const cropA = crop(KEY_A);
  const cropB = crop(KEY_B);
  const region = {
    x: cropA.x,
    y: cropA.y,
    width: cropB.x + cropB.width - cropA.x,
    height: CROP,
  };
  const cropBInRegion = { x: cropB.x - region.x, y: cropB.y - region.y, width: CROP, height: CROP };

  const move = async (target, settle = 950) => {
    const { x, y } = point(target);
    await page.mouse.move(x, y);
    await page.waitForTimeout(settle);
  };
  const sample = async () => {
    const png = await page.screenshot({ clip: region, timeout: 60_000 });
    return {
      a: meanColor(png, { x: 0, y: 0, width: CROP, height: CROP }),
      b: meanColor(png, cropBInRegion),
    };
  };

  const result = await run({ page, move, sample, point });
  result.errors = errors;
  await browser.close();
  await server.close();
  return result;
}

// Session 1: hover isolation, stability and clearing.
const hover = await withSession(async ({ move, sample }) => {
  await move(OFF);
  const rest = await sample();
  await move(KEY_A);
  const onA = await sample();
  await new Promise((resolve) => setTimeout(resolve, 150));
  const onAAgain = await sample();
  await move(KEY_B);
  const onB = await sample();
  await move(OFF);
  const cleared = await sample();
  return { rest, onA, onAAgain, onB, cleared };
});

const aFromHover = colorDelta(hover.onA.a, hover.rest.a);
const bFromHover = colorDelta(hover.onB.b, hover.rest.b);
check(
  'hover brightens the key under the pointer',
  aFromHover >= VISIBLE && bFromHover >= VISIBLE,
  `A +${aFromHover.toFixed(2)}, B +${bFromHover.toFixed(2)}`,
);

const bWhileA = colorDelta(hover.onA.b, hover.rest.b);
const aWhileB = colorDelta(hover.onB.a, hover.rest.a);
check(
  'hover never bleeds onto a neighbouring key',
  bWhileA <= NOISE && aWhileB <= NOISE,
  `B +${bWhileA.toFixed(2)}, A +${aWhileB.toFixed(2)}`,
);

const still = colorDelta(hover.onAAgain.a, hover.onA.a);
check('hover holds steady while the pointer rests', still <= NOISE, `frame delta ${still.toFixed(2)}`);

const clearedDelta = colorDelta(hover.cleared.a, hover.rest.a);
check('hover clears when the pointer leaves the device', clearedDelta <= NOISE, `A +${clearedDelta.toFixed(2)}`);
check('no console errors during hover', hover.errors.length === 0, hover.errors.slice(0, 2).join(' | ') || 'clean');

// Session 2: press feedback in Live mode. Releasing in edit mode selects the
// key, and the selection frame would legitimately change the post-release look.
const press = await withSession(async ({ page, move, sample }) => {
  await page.getByRole('button', { name: 'Live' }).click();
  await page.waitForTimeout(500);
  await move(KEY_A);
  const hovered = await sample();
  await page.mouse.down();
  await page.waitForTimeout(220);
  const pressed = await sample();
  await page.mouse.up();
  await page.waitForTimeout(1100);
  const released = await sample();
  return { hovered, pressed, released };
});

const pressDelta = colorDelta(press.pressed.a, press.hovered.a);
const releaseDelta = colorDelta(press.released.a, press.hovered.a);
check(
  'press is visible and settles back',
  pressDelta >= VISIBLE && releaseDelta <= NOISE,
  `press +${pressDelta.toFixed(2)}, release +${releaseDelta.toFixed(2)}`,
);
check('no console errors during press', press.errors.length === 0, press.errors.slice(0, 2).join(' | ') || 'clean');

// Session 3: selection must survive the pointer, other keys must still hover.
const selection = await withSession(async ({ page, move, sample, point }) => {
  await move(KEY_A);
  const { x, y } = point(KEY_A);
  await page.mouse.click(x, y);
  await page.waitForTimeout(700);
  await move(OFF);
  const selectedRest = await sample();
  await move(KEY_A);
  const selectedHovered = await sample();
  await move(KEY_B);
  const neighbourHovered = await sample();
  return { selectedRest, selectedHovered, neighbourHovered };
});

const selectedDelta = colorDelta(selection.selectedHovered.a, selection.selectedRest.a);
check('a selected key keeps its look when hovered', selectedDelta <= NOISE, `A +${selectedDelta.toFixed(2)}`);

const neighbourDelta = colorDelta(selection.neighbourHovered.b, selection.selectedRest.b);
check('other keys still hover while one is selected', neighbourDelta >= VISIBLE, `B +${neighbourDelta.toFixed(2)}`);
check('no console errors during selection', selection.errors.length === 0, selection.errors.slice(0, 2).join(' | ') || 'clean');

if (failures.length > 0) {
  console.error(`\n${failures.length} hover check(s) failed: ${failures.join(', ')}`);
} else {
  console.log('\nAll hover checks passed.');
}
// Exit explicitly: a crashed renderer can leave Playwright's close() waiting.
process.exit(failures.length > 0 ? 1 : 0);
