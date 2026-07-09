# FontLens — Session Resume / Handoff

> Read this first when resuming. Portable state so any new session can pick up
> where the last one left off. Last updated: 2026-06-15.

## What this is

**FontLens** — a Chrome Manifest V3 extension that inspects the fonts on any
web page and detects when a requested font has silently fallen back to a
substitute (the "wedge" feature vs WhatFont). Fully local, zero network,
minimal permissions. Repo: `git@github.com:Muzeeb1998/fontlens.git`.

## Current status (2026-06-15)

- **Branch `main`, clean tree, synced with `origin/main`.** Everything below is
  committed + pushed.
- **Tests green:** 230 vitest + 19 Playwright. Bundle audit clean. Zip ~70 KB.
- **Feature-complete for Launch 1.** Recent work this session:
  1. Premium UI redesign of the side panel (glass header, segmented toggle,
     layered cards, design tokens).
  2. Removed duplicate in-panel logo → clean Claude-style header (toggle left,
     icons right); browser title bar shows the favicon + name.
  3. **WhatFont-style multi-card overlay:** clicking text stamps a persistent,
     auto-expanded card at the click point; many clicks → many cards; each has
     its own × close; Esc clears all. Floating chip is the hover preview.
  4. Font-themed empty state ("Aa" tile + cursor) + tighter spacing.
  5. Full `/qa` (score 97/100, 0 failures) + `/security-review` (no findings).
  6. **Complete Chrome Web Store publish kit** (see `store/`).

## How to resume

```bash
npm install            # if fresh clone
npm test               # 230 vitest — expect green
npm run test:e2e       # 19 Playwright — expect green
npm run build          # icons + dist/fontlens-1.0.0.zip
npm run audit:bundle   # must say "zero issues"
npm run build:store    # regenerate store screenshots + promo tiles
```

Load unpacked to see it: `chrome://extensions` → Developer mode → Load unpacked
→ select this repo root. Hit ↻ after code changes.

## Working conventions (follow these)

- **TDD.** Write/adjust the test, then implement. Test files live next to source
  (`*.test.js`) + `test/e2e/*.spec.js`.
- **Commit + push each verified change** with a descriptive message, ending:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Branch off `main`
  only if asked; this session committed straight to `main` per the user.
- **Amber (`#f59e0b`) is reserved EXCLUSIVELY for the fallback signal** — never
  decorative.
- **Design tokens** in `lib/tokens.css`; no raw colors elsewhere. `--fg-faint`
  must stay AA-safe (an e2e contrast test asserts ≥4.5:1).
- **Zero network / no remote code / minimal permissions** — enforced by
  `npm run audit:bundle` on every build. Do not add `host_permissions`.
- CAVEMAN MODE was active for prose (terse); code/commits written normally.

## Architecture map

| Area | Files |
|------|-------|
| Manifest / SW | `manifest.json`, `service-worker.js` |
| Content overlay (chip + multi-card) | `content/overlay.js`, `content/content.js` |
| Side panel | `sidepanel/panel.html`, `panel.css`, `panel.js`, `render.js` |
| Detection / extraction | `lib/detector.js`, `lib/extractor*.js`, `lib/render-detect.js`, `lib/variable-axes.js` |
| Source links / export | `lib/resolver.js`, `lib/source-classify.js`, `lib/snippets.js`, `lib/tokens-export.js` |
| Icons | `assets/icons/` (`source.svg` → PNGs via `build/render-icons.js`) |
| Build | `build/package.js` (zip), `build/audit-bundle.js`, `build/render-store-assets.js` |
| QA suite | `docs/qa/test-cases.md` (A1–A10 functional, B1–B7 design) |
| Store kit | `store/` (see below) |

## Overlay interaction model (current, WhatFont parity)

- Hover → one floating compact chip follows the cursor (snaps, no transition).
- Click text (hover mode) → `pinCard()` stamps a persistent expanded card;
  multiple coexist; `removePin()` on ×; `clearPins()` on Esc. Also emits
  `hover-pick` so the side panel accumulates too.
- Inspect mode → outline + full-page extract to the panel.

## Store publish kit — status

Everything in `store/`, driven by `store/PUBLISH.md` (master guide).

- `store/listing.md` — all listing copy (name, summary, description, permission
  justifications).
- `store/privacy-answers.yaml` — privacy-practices questionnaire answers.
- `store/privacy-policy.md` — hostable policy.
- `store/screenshots/*.png` — 4 @1280×800, generated (`npm run build:store`):
  `1-pin-multiple`, `2-type-system`, `3-one-click-install` (white), `4-hover-detail`.
- `store/promo/*.png` — `small-tile-440x280`, `marquee-1400x560`.
- Manifest has the required top-level `description` (126 chars).

### Pending manual steps before Web Store submit (only these remain)

1. **Host the privacy policy** at a public URL (GitHub Pages / Gist), paste into
   the listing's Privacy policy field. See `store/PUBLISH.md` §5.
2. **Run the real-Chrome manual QA** — the "Manual-only cases" list in
   `docs/qa/test-cases.md` (install flow, real-site hover feel, actual file
   download, OS reduce-motion, screen reader).
3. Register CWS developer account ($5), upload `dist/fontlens-1.0.0.zip`, fill
   listing + privacy tabs, upload assets, submit.

## Ideas / roadmap (not started)

- Free font alternatives suggestions.
- Figma export.
- (Both mentioned in the listing's "What's next"; there's a notify-me stub.)
