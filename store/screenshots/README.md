# Screenshots — how to render

Five 1280×800 PNG screenshots are required by the Chrome Web Store. They are
generated from the fixture HTML pages in `fixtures/` rather than from the
loaded extension because the store needs deterministic captures.

## Quick path (manual — no extra deps)

1. Open Chrome at 1280×800 (DevTools → Toggle Device Toolbar → enter 1280×800).
2. Open each fixture URL (use `npm run harness` from repo root, then visit
   `http://localhost:5173/../../store/screenshots/fixtures/1-hero-fallback.html`)
   or open the file:// URL directly.
3. Take a full-viewport screenshot (DevTools → ⋮ → "Capture screenshot" or
   Cmd+Shift+P → "Capture full size screenshot").
4. Save into `store/screenshots/` with the matching name.

Required output files:

- `1-hero-fallback.png`
- `2-side-panel.png`
- `3-tailwind-toast.png`
- `4-variable-axis.png`
- `5-fallback-banner.png`

## Automated path (optional)

If you want headless rendering, install puppeteer locally:

```bash
npm install --save-dev puppeteer
```

Then run a small renderer (template at `docs/plans/2026-05-31-phase6-store-launch.md`
§5 — `build/render-screenshots.js`). Skipped from the default toolchain
because the puppeteer binary is ~170MB and platform-specific.

## What each fixture shows

| Fixture | What it captures |
|---------|------------------|
| `1-hero-fallback.html` | Hover chip with amber fallback dot floating over an article. Marketing asset. |
| `2-side-panel.html` | Hybrid layout: 2-3 family cards, one with the fallback border. |
| `3-tailwind-toast.html` | Toast "Copied as Tailwind" visible bottom-right. |
| `4-variable-axis.html` | Variable-font slider mid-drag, specimen reflowing. |
| `5-fallback-banner.html` | Page-level amber banner at top of side panel. |

Fixtures 2-5 currently use the same minimal frame stub. For Launch 1 the
hero (1) is the only one that absolutely must be perfect; the others can be
captured live from the loaded extension on a real demo page if needed.
