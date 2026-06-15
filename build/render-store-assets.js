// build/render-store-assets.js
// Renders Chrome Web Store assets from the REAL extension components:
//   • 4 screenshots  @ 1280×800  → store/screenshots/
//   • small promo    @  440×280  → store/promo/
//   • marquee promo  @ 1400×560  → store/promo/
//
// A tiny static server roots at the repo so scene HTML can load the actual
// panel.css / tokens.css and dynamic-import the actual render.js / overlay.js
// over http (file:// blocks ES-module imports). Deterministic, no extension
// load required.
//
// Run: node build/render-store-assets.js   (or: npm run build:store)

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(ROOT, 'store', 'screenshots');
const PROMO = path.join(ROOT, 'store', 'promo');
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(PROMO, { recursive: true });

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json',
};

// ---- static server ---------------------------------------------------------
const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const filePath = path.join(ROOT, urlPath);
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(filePath, (err, buf) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, {
      'content-type': MIME[path.extname(filePath)] || 'application/octet-stream',
      'access-control-allow-origin': '*',
    });
    res.end(buf);
  });
});

// ---- realistic payload (mirrors test/fixtures/extract-payload.js) ----------
const inspectPayload = {
  hostname: 'stripe.com', totalNodes: 184, truncated: false,
  groups: [
    {
      family: 'Arial', source: { type: 'system', format: null },
      isFallback: true, requestedFamily: 'Söhne', isVariable: false, axes: null,
      rows: [{
        key: 'k1', role: 'Headline', count: 9, nodeIds: [1],
        detail: { requested: ['Söhne', 'Arial', 'sans-serif'], rendered: 'Arial', isFallback: true,
          source: { type: 'system', format: null, url: null, os: 'macos' }, isVariable: false, axes: null,
          metrics: { size: '32px', weight: 600, lineHeight: '40px', letterSpacing: 'normal', transform: 'none', color: { rgb: 'rgb(15,15,16)', hex: '#0f0f10' } }, confidence: 'high' } }],
    },
    {
      family: 'Inter', source: { type: 'google', format: 'woff2' },
      isFallback: false, isVariable: false, axes: null,
      rows: [
        { key: 'k2', role: 'Body', count: 142, nodeIds: [2],
          detail: { requested: ['Inter', 'sans-serif'], rendered: 'Inter', isFallback: false,
            source: { type: 'google', format: 'woff2', url: 'https://fonts.gstatic.com/x.woff2', os: null }, isVariable: false, axes: null,
            metrics: { size: '16px', weight: 400, lineHeight: '24px', letterSpacing: 'normal', transform: 'none', color: { rgb: 'rgb(15,15,16)', hex: '#0f0f10' } }, confidence: 'high' } },
        { key: 'k3', role: 'Caption', count: 33, nodeIds: [3],
          detail: { requested: ['Inter', 'sans-serif'], rendered: 'Inter', isFallback: false,
            source: { type: 'google', format: 'woff2', url: 'https://fonts.gstatic.com/x.woff2', os: null }, isVariable: false, axes: null,
            metrics: { size: '13px', weight: 500, lineHeight: '18px', letterSpacing: 'normal', transform: 'none', color: { rgb: 'rgb(107,107,110)', hex: '#6b6b6e' } }, confidence: 'high' } },
      ],
    },
  ],
};

// ---- scene builders --------------------------------------------------------
const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;

// A framed side-panel scene: caption on the left, the real panel on the right.
function panelScene({ theme, caption, sub }) {
  const dark = theme === 'dark';
  const bg = dark ? '#0a0a0c' : '#f1f1f3';
  const fg = dark ? '#f5f5f7' : '#0f0f10';
  const muted = dark ? '#a1a1a6' : '#6b6b6e';
  const frame = dark ? '#0e0e10' : '#ffffff';
  return `<!doctype html><meta charset=utf8>
  <body style="margin:0;width:1280px;height:800px;background:${bg};font-family:${FONT};display:flex;align-items:center;gap:64px;padding:0 80px;box-sizing:border-box;overflow:hidden">
    <div style="flex:1;max-width:560px">
      <div style="display:inline-flex;align-items:center;gap:9px;margin-bottom:28px">
        <span style="width:30px;height:30px;border-radius:8px;overflow:hidden;display:inline-flex;box-shadow:0 1px 3px rgba(0,0,0,.18)">
          <svg viewBox="0 0 128 128" width="30" height="30"><rect x="6" y="6" width="116" height="116" rx="30" fill="#F59E0B"/><path d="M 84 30 Q 58 30 58 56 L 58 60 L 42 60 L 42 76 L 58 76 L 58 104 L 74 104 L 74 76 L 92 76 L 92 60 L 74 60 L 74 56 Q 74 46 84 46 L 94 46 L 94 30 Z" fill="#0F0F10"/></svg>
        </span>
        <span style="font-size:22px;font-weight:700;letter-spacing:-0.02em;color:${fg}">FontLens</span>
      </div>
      <h1 style="margin:0 0 18px;font-size:44px;line-height:1.1;letter-spacing:-0.03em;font-weight:700;color:${fg}">${caption}</h1>
      <p style="margin:0;font-size:19px;line-height:1.5;color:${muted};max-width:460px">${sub}</p>
    </div>
    <div style="width:430px;height:680px;border-radius:20px;background:${frame};box-shadow:0 30px 80px rgba(0,0,0,${dark ? '0.6' : '0.18'});overflow:hidden;flex:0 0 auto">
      <iframe id="panel" src="/sidepanel/panel.html" style="width:430px;height:680px;border:0;display:block"></iframe>
    </div>
  </body>`;
}

// A faux article scene with the real overlay chip + pinned cards composited on top.
function articleScene({ caption, sub }) {
  return `<!doctype html><meta charset=utf8>
  <body style="margin:0;width:1280px;height:800px;background:#ffffff;font-family:${FONT};overflow:hidden;position:relative">
    <div style="padding:90px 120px;max-width:760px">
      <p style="font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#9c9ca0;font-weight:600;margin:0 0 18px">Engineering · Typography</p>
      <h1 style="font-size:52px;line-height:1.08;letter-spacing:-0.03em;margin:0 0 24px;color:#0f0f10">Almost before we knew it, we had left the ground</h1>
      <p style="font-size:20px;line-height:1.7;color:#3a3a3f;margin:0 0 18px">The rendered face is not always the requested one. A stylesheet asks for one font; the browser, on a slow network or a blocked CDN, quietly serves another. Readers never know. Neither do most tools.</p>
      <p style="font-size:20px;line-height:1.7;color:#3a3a3f;margin:0">FontLens reads the CSS and checks what actually painted — then flags the gap.</p>
    </div>
    <div style="position:absolute;left:50px;bottom:48px;max-width:520px">
      <div style="display:inline-flex;align-items:center;gap:8px;margin-bottom:12px">
        <span style="width:26px;height:26px;border-radius:7px;overflow:hidden;display:inline-flex"><svg viewBox="0 0 128 128" width="26" height="26"><rect x="6" y="6" width="116" height="116" rx="30" fill="#F59E0B"/><path d="M 84 30 Q 58 30 58 56 L 58 60 L 42 60 L 42 76 L 58 76 L 58 104 L 74 104 L 74 76 L 92 76 L 92 60 L 74 60 L 74 56 Q 74 46 84 46 L 94 46 L 94 30 Z" fill="#0F0F10"/></svg></span>
        <span style="font-size:17px;font-weight:700;letter-spacing:-0.02em;color:#0f0f10">FontLens</span>
      </div>
      <h2 style="margin:0;font-size:30px;line-height:1.15;letter-spacing:-0.02em;color:#0f0f10">${caption}</h2>
      <p style="margin:8px 0 0;font-size:17px;color:#6b6b6e">${sub}</p>
    </div>
    <fontlens-mount></fontlens-mount>
  </body>`;
}

async function injectPanel(page, { theme, mode }) {
  const handle = await page.waitForSelector('#panel');
  const frame = await handle.contentFrame();
  await frame.waitForSelector('.fl-header');
  await frame.evaluate(async ({ payload, mode, theme }) => {
    document.documentElement.setAttribute('data-theme', theme);
    const r = await import('/sidepanel/render.js');
    const header = document.querySelector('.fl-header');
    r.renderHeader(header, { mode });
    const region = document.getElementById('fl-region');
    const banner = document.getElementById('fl-banner');
    const bt = document.getElementById('fl-banner-text');
    const summary = document.getElementById('fl-summary');
    const fb = payload.groups.filter(g => g.isFallback).length;
    r.renderBanner(banner, bt, { fallbackCount: fb });
    if (mode === 'inspect') r.renderSummary(summary, payload);
    region.innerHTML = '';
    r.renderGroups(region, payload, {});
  }, { payload: inspectPayload, mode, theme });
}

async function injectCards(page, cards) {
  await page.evaluate(async (cards) => {
    const { Overlay } = await import('/content/overlay.js');
    const mk = (d) => () => d;
    const o = new Overlay({ detect: () => cards[0], onEmit() {} });
    o.mount();
    for (const c of cards) o.pinCard(c, c._pos);
    // floating preview chip too (first card, compact)
    o.show(document.querySelector('h1'), cards[0]._chip || { x: 760, y: 250 });
    o._renderChip(cards[0]);
    o._positionEl(o._chip, cards[0]._chip || { x: 760, y: 250 });
  }, cards);
}

const D = (over = {}) => ({
  requested: ['Inter', 'sans-serif'], rendered: 'Inter', isFallback: false,
  source: { type: 'self-hosted', format: 'woff2' }, isVariable: false, axes: null,
  metrics: { size: '20px', weight: 400, lineHeight: '34px', letterSpacing: 'normal', transform: 'none', color: { rgb: 'rgb(58,58,63)', hex: '#3a3a3f' } },
  confidence: 'high', ...over,
});

// ---- promo SVG scenes ------------------------------------------------------
function promoSVG(w, h, big) {
  const titleSize = big ? 76 : 40;
  const tagSize = big ? 30 : 18;
  const markSize = big ? 96 : 64;
  return `<!doctype html><meta charset=utf8><body style="margin:0;width:${w}px;height:${h}px;background:#0e0e10;font-family:${FONT};display:flex;align-items:center;justify-content:center;gap:${big ? 56 : 28}px;padding:0 ${big ? 90 : 40}px;box-sizing:border-box">
    <span style="width:${markSize}px;height:${markSize}px;border-radius:${markSize * 0.27}px;overflow:hidden;display:inline-flex;flex:0 0 auto;box-shadow:0 8px 30px rgba(245,158,11,.35)">
      <svg viewBox="0 0 128 128" width="${markSize}" height="${markSize}"><rect x="6" y="6" width="116" height="116" rx="30" fill="#F59E0B"/><path d="M 84 30 Q 58 30 58 56 L 58 60 L 42 60 L 42 76 L 58 76 L 58 104 L 74 104 L 74 76 L 92 76 L 92 60 L 74 60 L 74 56 Q 74 46 84 46 L 94 46 L 94 30 Z" fill="#0F0F10"/></svg>
    </span>
    <div>
      <div style="font-size:${titleSize}px;font-weight:700;letter-spacing:-0.03em;color:#f5f5f7;line-height:1">FontLens</div>
      <div style="font-size:${tagSize}px;color:#a1a1a6;margin-top:${big ? 16 : 8}px;line-height:1.3;max-width:${big ? 820 : 300}px">See the font a page asked for — and the one visitors actually get.</div>
    </div>
  </body>`;
}

// ---- run -------------------------------------------------------------------
const PORT = 8821;
await new Promise(r => server.listen(PORT, r));
const base = `http://localhost:${PORT}`;
const browser = await chromium.launch();

async function shot(file, w, h, html, after) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  // <base> so absolute module specifiers (/content/overlay.js) and the panel
  // iframe src resolve against the static server instead of about:blank.
  html = html.replace('<meta charset=utf8>', `<meta charset=utf8><base href="${base}/">`);
  await page.setContent(html, { waitUntil: 'networkidle' });
  if (after) await after(page);
  await page.waitForTimeout(400);
  await page.screenshot({ path: file });
  await page.close();
  console.log('✓', path.relative(ROOT, file));
}

// Screenshot 1 — multi-card hero (headline feature)
await shot(path.join(SHOTS, '1-pin-multiple.png'), 1280, 800,
  articleScene({ caption: 'Click any text. Pin as many cards as you like.', sub: 'Each click stamps a card — inspect a whole page side by side.' }),
  (page) => injectCards(page, [
    { ...D({ rendered: 'Inter', metrics: { ...D().metrics, size: '52px', weight: 700, lineHeight: '56px', color: { rgb: 'rgb(15,15,16)', hex: '#0f0f10' } } }), _pos: { x: 470, y: 220 } },
    { ...D({ rendered: 'Inter', metrics: { ...D().metrics, size: '20px', weight: 400, lineHeight: '34px' } }), _pos: { x: 620, y: 320 } },
    { ...D({ rendered: 'Arial', isFallback: true, requested: ['Söhne', 'Arial'], source: { type: 'system', format: null }, metrics: { ...D().metrics, size: '13px', weight: 600 } }), _pos: { x: 770, y: 420 } },
  ]));

// Screenshot 2 — side panel, full type system (inspect)
await shot(path.join(SHOTS, '2-type-system.png'), 1280, 800,
  panelScene({ theme: 'light', caption: 'Every type style on the page.', sub: 'Grouped by family, sorted by usage, fallbacks first. Copy any style as CSS, Tailwind, or a design token.' }),
  (page) => injectPanel(page, { theme: 'light', mode: 'inspect' }));

// Screenshot 3 — fallback detection (the wedge), dark
await shot(path.join(SHOTS, '3-fallback-signal.png'), 1280, 800,
  panelScene({ theme: 'dark', caption: 'Catch silent font fallbacks.', sub: 'When a requested font fails to load and visitors see a substitute, FontLens flags it with an amber signal. No other inspector does.' }),
  (page) => injectPanel(page, { theme: 'dark', mode: 'inspect' }));

// Screenshot 4 — hover chip + expanded card closeup on an article
await shot(path.join(SHOTS, '4-hover-detail.png'), 1280, 800,
  articleScene({ caption: 'Rendered font, weight, size, color.', sub: 'Hover for a quick read; click for the full breakdown and a live specimen.' }),
  (page) => injectCards(page, [
    { ...D({ rendered: 'Inter', metrics: { size: '52px', weight: 700, lineHeight: '56px', letterSpacing: 'normal', transform: 'none', color: { rgb: 'rgb(15,15,16)', hex: '#0f0f10' } } }), _pos: { x: 720, y: 230 }, _chip: { x: 300, y: 470 } },
  ]));

// Promo tiles
await shot(path.join(PROMO, 'small-tile-440x280.png'), 440, 280, promoSVG(440, 280, false));
await shot(path.join(PROMO, 'marquee-1400x560.png'), 1400, 560, promoSVG(1400, 560, true));

await browser.close();
await new Promise(r => server.close(r));
console.log('\nStore assets written to store/screenshots/ and store/promo/');
