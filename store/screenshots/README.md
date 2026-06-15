# Screenshots

The four 1280×800 store screenshots here are **generated from the real
extension UI** (the actual `render.js` panel + `overlay.js` cards), not from
mockups. They regenerate deterministically:

```bash
npm run build:store
```

That command (`build/render-store-assets.js`) spins up a local static server,
renders each scene at 2× device-scale through headless Chromium, and writes:

| File | 1280×800 scene |
|------|----------------|
| `1-pin-multiple.png` | Multi-card pinning cascading over an article — the headline interaction |
| `2-type-system.png` | Side panel, full page type system, fallback-first (light) |
| `3-fallback-signal.png` | The wedge: amber fallback signal + page banner (dark) |
| `4-hover-detail.png` | Hover chip + expanded detail card with live specimen |

Promo tiles are written by the same command to `store/promo/`:
`small-tile-440x280.png`, `marquee-1400x560.png`.

Upload screenshots in order 1→4. See [`../PUBLISH.md`](../PUBLISH.md) for the
full submission flow.

## Editing a scene

Scene markup + captions live in `build/render-store-assets.js`
(`panelScene`, `articleScene`, `promoSVG`). Edit there and re-run
`npm run build:store`. No manual capture, no extra dependencies beyond the
`@playwright/test` Chromium the repo already uses for e2e.
