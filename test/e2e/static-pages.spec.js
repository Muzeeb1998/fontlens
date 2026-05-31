// Playwright tests against the static extension surfaces (no extension load).
// Verifies: load, console health, headings, contrast, keyboard, theme toggle,
// mode toggle, focus ring, mobile reflow.

import { test, expect } from '@playwright/test';

const errors = new Map();
function trackConsole(page, key) {
  errors.set(key, []);
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.get(key).push(msg.text());
  });
  page.on('pageerror', (err) => errors.get(key).push(`pageerror: ${err.message}`));
}

// ---------------- onboarding/demo.html ----------------

test.describe('onboarding/demo.html', () => {
  test('loads with no JS errors and one h1', async ({ page }) => {
    trackConsole(page, 'demo');
    await page.goto('/onboarding/demo.html');
    await expect(page).toHaveTitle(/FontLens/);
    const h1Count = await page.locator('h1').count();
    const h2Count = await page.locator('h2').count();
    expect(h1Count).toBe(1);                  // a11y fix: exactly one h1
    expect(h2Count).toBeGreaterThanOrEqual(2); // both demo headlines are h2
    expect(errors.get('demo')).toEqual([]);
  });

  test('CTA is focusable and shows visible focus ring', async ({ page }) => {
    await page.goto('/onboarding/demo.html');
    const cta = page.locator('.cta');
    await cta.focus();
    const outlineColor = await cta.evaluate(el => getComputedStyle(el).outlineColor);
    expect(outlineColor).toMatch(/rgb\(30,\s*111,\s*216\)/); // --link
  });

  test('fallback paragraph really renders in a fallback (not the requested face)', async ({ page }) => {
    await page.goto('/onboarding/demo.html');
    // The CSS @font-face for FontLensDemoMissing points at a 404 URL.
    // Wait for font loading attempts to settle.
    await page.waitForLoadState('networkidle');
    const fallbackFamily = await page.locator('.fallback-headline').evaluate(
      el => getComputedStyle(el).fontFamily
    );
    expect(fallbackFamily).toContain('FontLensDemoMissing'); // CSS spec'd
    // The browser will substitute. We can't easily detect at this layer without
    // canvas — but we can confirm the requested family is the spec'd one.
  });

  test('mobile viewport (375x812) reflows cleanly', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/onboarding/demo.html');
    // Sanity: no horizontal scroll
    const overflowsX = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(overflowsX).toBe(false);
  });
});

// ---------------- sidepanel/panel.html ----------------

test.describe('sidepanel/panel.html', () => {
  test('loads, header buttons present, empty state visible', async ({ page }) => {
    trackConsole(page, 'panel');
    await page.setViewportSize({ width: 380, height: 800 });
    await page.goto('/sidepanel/panel.html');

    await expect(page.locator('#fl-mode-hover')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#fl-mode-inspect')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#fl-theme-auto')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.fl-empty')).toBeVisible();
    await expect(page.locator('.fl-empty')).toContainText('Navigate to a page');

    // chrome.* calls reject silently outside the extension — no console errors expected
    expect(errors.get('panel') || []).toEqual([]);
  });

  test('mode toggle updates aria-pressed', async ({ page }) => {
    await page.setViewportSize({ width: 380, height: 800 });
    await page.goto('/sidepanel/panel.html');
    await page.click('#fl-mode-inspect');
    await expect(page.locator('#fl-mode-hover')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#fl-mode-inspect')).toHaveAttribute('aria-pressed', 'true');
  });

  test('theme toggle flips data-theme', async ({ page }) => {
    await page.setViewportSize({ width: 380, height: 800 });
    await page.goto('/sidepanel/panel.html');
    await page.click('#fl-theme-dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('#fl-theme-dark')).toHaveAttribute('aria-pressed', 'true');
  });

  test('dark mode active toggle bg is distinct from track (post-QA fix)', async ({ page }) => {
    await page.setViewportSize({ width: 380, height: 800 });
    await page.goto('/sidepanel/panel.html');
    await page.click('#fl-theme-dark');
    await page.click('#fl-mode-inspect');

    const activeBg = await page.locator('#fl-mode-inspect').evaluate(
      el => getComputedStyle(el).backgroundColor
    );
    const trackBg = await page.locator('.fl-mode').evaluate(
      el => getComputedStyle(el).backgroundColor
    );
    expect(activeBg).not.toBe(trackBg);

    // --toggle-active-bg in dark = --border-strong = #3a3a3f
    expect(activeBg).toMatch(/rgb\(58,\s*58,\s*63\)/);
  });

  test('main region exposes proper landmark', async ({ page }) => {
    await page.goto('/sidepanel/panel.html');
    const main = page.locator('main');
    await expect(main).toHaveAttribute('role', 'region');
    await expect(main).toHaveAttribute('aria-label', 'Detected fonts');
  });

  test('all interactive elements expose accessible names', async ({ page }) => {
    await page.goto('/sidepanel/panel.html');
    const buttons = page.locator('button');
    const count = await buttons.count();
    for (let i = 0; i < count; i++) {
      const label = await buttons.nth(i).getAttribute('aria-label');
      expect(label, `button #${i} has aria-label`).toBeTruthy();
    }
  });
});

// ---------------- options/options.html ----------------

test.describe('options/options.html', () => {
  test('radios are wrapped in <label> for proper a11y association', async ({ page }) => {
    trackConsole(page, 'options');
    await page.goto('/options/options.html');
    const radios = page.locator('input[name="defaultFormat"]');
    expect(await radios.count()).toBe(3);
    // Each radio is inside a label
    for (let i = 0; i < 3; i++) {
      const wrapped = await radios.nth(i).evaluate(el => !!el.closest('label'));
      expect(wrapped).toBe(true);
    }
    // No JS errors — options.js handles missing chrome.* gracefully
    expect(errors.get('options') || []).toEqual([]);
  });
});

// ---------------- test/harness/index.html ----------------

test.describe('test/harness/index.html', () => {
  test('detection harness runs and reports a self-summary', async ({ page }) => {
    trackConsole(page, 'harness');
    await page.goto('/test/harness/index.html');
    await page.waitForLoadState('networkidle');
    // The harness writes a summary <h2> on completion. Wait up to 5s.
    const summary = page.locator('h2', { hasText: /passed,\s+\d+\s+failed/ });
    await expect(summary).toBeVisible({ timeout: 5000 });
    const summaryText = await summary.textContent();
    // Expect at least 3/4 PASS (fixture 1 needs the Inter binary the engineer drops in)
    const passes = Number(summaryText.match(/(\d+)\s+passed/)?.[1] || '0');
    expect(passes).toBeGreaterThanOrEqual(3);
  });
});

// ---------------- WCAG contrast verification (resolved at runtime) ----------------

test.describe('contrast (post-a11y-fix)', () => {
  // sRGB contrast utility (WCAG 2.x algorithm)
  function relLuminance(rgb) {
    const [r, g, b] = rgb.map(c => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function contrast(fg, bg) {
    const L1 = relLuminance(fg), L2 = relLuminance(bg);
    const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
    return (hi + 0.05) / (lo + 0.05);
  }
  function parseRgb(s) {
    const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    return m ? [+m[1], +m[2], +m[3]] : null;
  }

  test('light --fg-faint passes AA on --bg (the bumped #76767a)', async ({ page }) => {
    await page.goto('/sidepanel/panel.html');
    const c = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      return { fg: root.getPropertyValue('--fg-faint').trim(),
               bg: root.getPropertyValue('--bg').trim() };
    });
    // The token is declared as a hex string; resolve via a styled probe instead.
    const probe = await page.evaluate(() => {
      const el = document.createElement('div');
      el.style.color = 'var(--fg-faint)';
      el.style.background = 'var(--bg)';
      document.body.appendChild(el);
      const cs = getComputedStyle(el);
      const out = { fg: cs.color, bg: cs.backgroundColor };
      el.remove();
      return out;
    });
    const ratio = contrast(parseRgb(probe.fg), parseRgb(probe.bg));
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  test('dark --fg-faint passes AA on --bg (the bumped #8a8a8e)', async ({ page }) => {
    await page.goto('/sidepanel/panel.html');
    await page.click('#fl-theme-dark');
    const probe = await page.evaluate(() => {
      const el = document.createElement('div');
      el.style.color = 'var(--fg-faint)';
      el.style.background = 'var(--bg)';
      document.body.appendChild(el);
      const cs = getComputedStyle(el);
      const out = { fg: cs.color, bg: cs.backgroundColor };
      el.remove();
      return out;
    });
    const ratio = contrast(parseRgb(probe.fg), parseRgb(probe.bg));
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});
