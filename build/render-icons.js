#!/usr/bin/env node
// Rasterize assets/icons/source.svg → 16/32/48/128 PNG (transparent bg).
// Uses the already-installed Playwright Chromium — no sharp/native dep.
// Re-run: `node build/render-icons.js`.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'assets/icons/source.svg');
const SIZES = [16, 32, 48, 128];

const svg = readFileSync(SRC, 'utf8');
const browser = await chromium.launch();

for (const size of SIZES) {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });
  // Render the SVG filling the viewport, no margins, transparent page.
  await page.setContent(
    `<!doctype html><meta charset="utf-8">
     <style>html,body{margin:0;padding:0;background:transparent}
       svg{display:block;width:${size}px;height:${size}px}</style>
     ${svg}`,
    { waitUntil: 'networkidle' },
  );
  const buf = await page.screenshot({ omitBackground: true, type: 'png' });
  const out = join(ROOT, `assets/icons/${size}.png`);
  writeFileSync(out, buf);
  console.log(`OK  ${out}  (${buf.length} bytes)`);
  await page.close();
}

await browser.close();
