// Reproduce the user-reported bug: install the extension, navigate to the
// onboarding demo, hover the fallback headline, expect the chip.

import { test, expect, chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

let context, sw, userDataDir, extId, demoUrl;

test.beforeAll(async () => {
  userDataDir = mkdtempSync(path.join(tmpdir(), 'fontlens-hover-'));
  context = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    channel: 'chromium',
    args: [
      `--disable-extensions-except=${ROOT}`,
      `--load-extension=${ROOT}`,
      '--no-sandbox',
    ],
  });
  sw = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', { timeout: 10000 });
  extId = sw.url().match(/chrome-extension:\/\/([^\/]+)/)[1];
  demoUrl = `chrome-extension://${extId}/onboarding/demo.html`;
});

test.afterAll(async () => {
  if (context) await context.close();
  if (userDataDir) rmSync(userDataDir, { recursive: true, force: true });
});

test('content script injects into demo and chip appears on hover', async () => {
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));

  await page.goto(demoUrl);
  await page.bringToFront();
  await page.waitForLoadState('networkidle');

  // Demo page now boots the content script inline via <script type="module">.
  // Wait for the overlay host to mount.
  await page.waitForFunction(() => !!document.querySelector('fontlens-overlay'), { timeout: 5000 });

  // Move the mouse over the fallback headline.
  const headline = await page.locator('.fallback-headline').first().boundingBox();
  expect(headline, 'headline has a bounding box').not.toBeNull();
  await page.mouse.move(headline.x + 40, headline.y + 20);
  // rAF + 80ms ease + detect time
  await page.waitForTimeout(400);

  const chipState = await page.evaluate(() => {
    const host = document.querySelector('fontlens-overlay');
    const chip = host?.shadowRoot?.querySelector('.chip');
    if (!chip) return { display: 'no-chip' };
    return {
      display: chip.style.display || 'unset',
      line1: chip.querySelector('.line1')?.textContent || null,
      hasFallback: !!chip.querySelector('.fallback'),
      requested: chip.querySelector('.requested')?.textContent || null,
    };
  });

  test.info().annotations.push({ type: 'chip-state', description: JSON.stringify(chipState) });
  test.info().annotations.push({ type: 'pageerrors', description: pageErrors.join('\n') || '(none)' });

  expect(chipState.display).not.toBe('no-chip');
  expect(chipState.display).not.toBe('none');
  expect(chipState.line1, 'chip line 1 should show rendered font name').toBeTruthy();
});
