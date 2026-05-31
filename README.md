# FontLens

A Chrome (Manifest V3) extension that inspects fonts on any web page and
shows the three things existing tools get wrong:

1. **Requested vs actually-rendered font** — when the page asks for "Söhne"
   but the browser fell back to Arial, FontLens flags it with an amber dot.
2. **Full type system of a selection** — every distinct style on an
   element (or whole page), grouped by family, sorted by usage.
3. **Copy as CSS / Tailwind / Design Token** — one click.

All processing local. Zero network. Zero data exfiltration.

## Status

**Launch 1 complete — Web Store ready.**

| Phase | Tag | Tests | Status |
|------:|-----|------:|--------|
| 1 — Detection Engine | [`phase1-engine`](https://github.com/Muzeeb1998/fontlens/releases/tag/phase1-engine) | 58 | ✓ |
| 2 — Overlay + Hover Chip | [`phase2-overlay`](https://github.com/Muzeeb1998/fontlens/releases/tag/phase2-overlay) | 90 | ✓ |
| 3 — Side Panel + Extraction | [`phase3-panel`](https://github.com/Muzeeb1998/fontlens/releases/tag/phase3-panel) | 134 | ✓ |
| 4 — Export + Variable Fonts + Polish | [`phase4-export-variable-polish`](https://github.com/Muzeeb1998/fontlens/releases/tag/phase4-export-variable-polish) | 156 | ✓ |
| 5 — Edge Cases + Onboarding | [`phase5-edges`](https://github.com/Muzeeb1998/fontlens/releases/tag/phase5-edges) | 174 | ✓ |
| 6 — Web Store Prep | [`phase6-store-ready`](https://github.com/Muzeeb1998/fontlens/releases/tag/phase6-store-ready) | 174 | ✓ |

- Design system: [`DESIGN.md`](DESIGN.md)
- Launch 1 product spec: [`docs/specs/launch1-design.md`](docs/specs/launch1-design.md)
- Phase plans: [`docs/plans/`](docs/plans/)
- Store artifacts: [`store/`](store/)

## Repository layout

```
fontlens/
├── manifest.json
├── service-worker.js
├── content/          MV3 content script + Shadow DOM overlay
├── sidepanel/        Side Panel API root (panel.html, render, messaging)
├── options/          Default copy-format picker
├── lib/              Pure modules: detector, extractor, export, axes, …
├── onboarding/       First-install demo page
├── assets/icons/     16/32/48/128 PNG + source SVG
├── build/            Zip packager + bundle audit
├── store/            Web Store listing, privacy answers, QA checklist
├── test/             Vitest suites + browser harness
└── docs/             Spec, design system, phase plans, mockups
```

## Build

```bash
npm install
npm test            # run unit suite (174 tests)
npm run build:zip   # produce dist/fontlens-1.0.0.zip
npm run audit:bundle # verify the zip is Web Store ready
```

## Manual install (for testing)

1. `chrome://extensions` → enable Developer Mode → "Load unpacked" → repo root.
2. Click the FontLens toolbar icon on any page. Side panel opens.
3. Hover any element to inspect. Click to extract every type style on the
   page.

## Submission

See [`store/submission-walkthrough.md`](store/submission-walkthrough.md) for
the Chrome Web Store dashboard flow. Pre-submit QA checklist at
[`store/pre-submit-qa.md`](store/pre-submit-qa.md).

## License

See [`LICENSE`](LICENSE).
