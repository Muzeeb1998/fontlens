# FontLens — Test Case Suite

**Generated:** 2026-06-15 · via /qa (functional) + /design-review (visual)
**Surfaces:** content overlay (compact chip + expanded card), side panel (hover/inspect), onboarding, options.
**Legend:** P0 = blocks ship · P1 = major · P2 = polish. Each case: Pre → Steps → Expected.

How to run manually: `chrome://extensions` → Load unpacked (repo root) → exercise on a font-heavy site (stripe.com), a Google-Fonts site, a CSP-strict site (github.com), and `onboarding/demo.html`.

---

## PART A — FUNCTIONAL (/qa)

### A1. Activation & injection

| ID | P | Pre | Steps | Expected |
|----|---|-----|-------|----------|
| TC-A1.1 | P0 | Fresh install | Install unpacked | Demo tab opens once + side panel opens in Hover mode |
| TC-A1.2 | P0 | Installed | Reload extension | Demo tab does NOT reopen (one-shot `fontlens.installed`) |
| TC-A1.3 | P0 | Any http(s) page | Click toolbar icon | Side panel opens + content script injects, no console errors |
| TC-A1.4 | P1 | Any page | Press `Alt+Shift+F` | Injects + side panel opens in Inspect mode |
| TC-A1.5 | P1 | `chrome://extensions` or Web Store page | Click icon | No crash; panel opens, stays empty (injection silently skipped) |
| TC-A1.6 | P1 | Panel opened via Chrome side-panel selector (no toolbar click) | — | `ensure-content` path injects loader; extract still fires |

### A2. Hover detection

| ID | P | Pre | Steps | Expected |
|----|---|-----|-------|----------|
| TC-A2.1 | P0 | Hover mode on stripe.com | Move cursor over a heading | Compact chip: rendered family + `size · weight · style` |
| TC-A2.2 | P0 | Page with a font that fails to load | Hover the affected text | Amber dot + "fallback" + "requested: X" on chip |
| TC-A2.3 | P0 | System-stack text (`-apple-system`) | Hover | Names OS font ("San Francisco on macOS"), no wrong specific name |
| TC-A2.4 | P1 | CSP-strict site (github.com) blocks canvas | Hover | Chip shows "couldn't confirm rendering"; no console error |
| TC-A2.5 | P0 | Chip visible over element X | Move cursor toward chip | Chip follows cursor smoothly (no lag/trail); reachable — content script stops re-detecting once pointer is over our own UI |
| TC-A2.6 | P1 | Chip visible | Move cursor to different element | Chip repositions + re-detects |
| TC-A2.7 | P1 | Hover near right/bottom viewport edge | — | Chip flips to stay on-screen |
| TC-A2.8 | P0 | Font-heavy page | Sweep cursor fast across many elements | No jank/hang (memoized detection); ~60fps |

### A3. Pinned cards (WhatFont-style multi-card)

| ID | P | Pre | Steps | Expected |
|----|---|-----|-------|----------|
| TC-A3.1 | P0 | Hovering text | Click the text | A persistent card STAMPS at the click point, auto-expanded: Family/Style/Weight/Color+swatch/Size/Line-height + specimen (no second click) |
| TC-A3.2 | P0 | Pinned card | Read text | Text is crisp, NOT blurry (no will-change on pinned cards) |
| TC-A3.3 | P0 | Several pinned cards | Click 10 different texts | 10 cards coexist on screen |
| TC-A3.4 | P1 | Pinned card | Click its × | ONLY that card closes; others remain |
| TC-A3.5 | P1 | ≥1 pinned card | Press Esc | ALL pinned cards clear |
| TC-A3.6 | P1 | Compact chip showing | Click "View more →" | Stamps a pinned card (same as clicking text) |
| TC-A3.7 | P2 | Pinned card, dark mode | — | Swatch + values contrast cleanly |

### A4. Side panel — Hover mode

| ID | P | Pre | Steps | Expected |
|----|---|-----|-------|----------|
| TC-A4.1 | P0 | Hover mode, nothing clicked | — | Illustrated empty state "Pin a font to start" (floats) |
| TC-A4.2 | P0 | Hover mode | Click one text element | One card appears in panel |
| TC-A4.3 | P0 | Hover mode | Click several different texts | Cards stack (deduped by family+style) |
| TC-A4.4 | P1 | Multiple pinned | Click "Clear" in hint | Stack empties → back to empty state |
| TC-A4.5 | P1 | Pinned cards | Switch to Inspect then back to Hover | Hover stack preserved or reset per spec (resets) |

### A5. Side panel — Inspect mode

| ID | P | Pre | Steps | Expected |
|----|---|-----|-------|----------|
| TC-A5.1 | P0 | Click Inspect | — | Hint "every type style used on this page" + scanning skeleton (animated) |
| TC-A5.2 | P0 | Inspect on real page | Wait for extract | Full-page family cards, rows sorted by usage, fallback-first |
| TC-A5.3 | P0 | Page with ≥1 fallback | Inspect | Amber banner "N of this page's font(s) … loading" |
| TC-A5.4 | P1 | Page with cross-origin iframe | Inspect | Placeholder card "N frames couldn't be inspected (cross-origin)" |
| TC-A5.5 | P1 | Page >5000 text nodes | Inspect | Footnote "Showing styles from the first 5000 text nodes." |
| TC-A5.6 | P1 | Page with open shadow DOM (notion.so) | Inspect | Rows from shadow trees included |

### A6. Copy / export

| ID | P | Pre | Steps | Expected |
|----|---|-----|-------|----------|
| TC-A6.1 | P0 | Row hover | Click CSS | Clipboard = clean CSS block; toast "Copied as CSS" |
| TC-A6.2 | P0 | Row hover | Click Tailwind | Clipboard = class string; `≈` flag when a value is approximate |
| TC-A6.3 | P0 | Row hover | Click Token | Clipboard = JSON token object |
| TC-A6.4 | P1 | Focused row | Press Enter | Copies in default format (Options) + toast |
| TC-A6.5 | P0 | Inspect with results | Click Download icon | Downloads `fontlens-<host>-tokens.json`; toast "Downloaded N type styles" |
| TC-A6.6 | P1 | No results | — | Download icon disabled |
| TC-A6.7 | P1 | Google-font row | Click Embed | Drawer with `<link>`/`@import` + per-snippet Copy |
| TC-A6.8 | P1 | Self-hosted row | Click Embed | Drawer with `@font-face` snippet |

### A7. Source links (badge)

| ID | P | Pre | Steps | Expected |
|----|---|-----|-------|----------|
| TC-A7.1 | P0 | Google-font card | Click badge | New tab → fonts.google.com/specimen/<Name> |
| TC-A7.2 | P0 | Paid font (Söhne) card | Click badge | New tab → official foundry page; NEVER a download |
| TC-A7.3 | P0 | Self-hosted card | Click badge | New tab → site **origin** (not the raw .woff2) |
| TC-A7.4 | P1 | System card | — | Badge not a link (no spurious URL) |

### A8. Variable fonts

| ID | P | Pre | Steps | Expected |
|----|---|-----|-------|----------|
| TC-A8.1 | P1 | Variable-font family (Inter var) | Inspect | Card shows Variable badge + axis sliders w/ min→max |
| TC-A8.2 | P1 | Axis slider | Drag wght | Page text reflows live (30ms throttle) |
| TC-A8.3 | P1 | After dragging | Click Reset | Original axis value restored on page |

### A9. Theme & lifecycle

| ID | P | Pre | Steps | Expected |
|----|---|-----|-------|----------|
| TC-A9.1 | P0 | Light mode | Click sun/moon icon | Flips to dark; icon swaps moon↔sun |
| TC-A9.2 | P1 | After flip | Close + reopen panel | Theme persisted |
| TC-A9.3 | P0 | Panel open, hovering works | **Close the side panel** | Overlay torn down — chip STOPS firing on the page |
| TC-A9.4 | P0 | Inspect mode, SW idle >30s | Refocus panel | Re-extracts (focus rehydrate); no "receiving end" error |

### A10. Privacy / robustness

| ID | P | Pre | Steps | Expected |
|----|---|-----|-------|----------|
| TC-A10.1 | P0 | DevTools Network open | Use on any page | Zero network requests from extension |
| TC-A10.2 | P0 | — | Inspect manifest | Only activeTab/scripting/sidePanel/storage; no host_permissions |
| TC-A10.3 | P1 | Inspect-mode click on `<a>` | Click a link | Host page does NOT navigate |
| TC-A10.4 | P1 | Console on every surface | Walk all flows | No uncaught errors / promise rejections |

---

## PART B — DESIGN / VISUAL (/design-review)

### B1. Visual hierarchy & consistency

| ID | P | Check | Expected |
|----|---|-------|----------|
| TC-B1.1 | P1 | Card head | Family name dominant, badge secondary, meta tertiary — clear 3-level hierarchy |
| TC-B1.2 | P1 | Row | Role label / specimen / metrics / count visually ranked, not competing |
| TC-B1.3 | P2 | Spacing | All gaps on the 4pt grid (`--s-*`); no one-off margins |
| TC-B1.4 | P1 | Amber usage | Amber ONLY on fallback signal — nowhere else |
| TC-B1.5 | P2 | Tabular nums | Metrics/counts align across rows (no jitter) |

### B2. Color & contrast (WCAG AA)

| ID | P | Pair | Expected |
|----|---|------|----------|
| TC-B2.1 | P0 | `--fg-muted` on `--bg` (light + dark) | ≥4.5:1 |
| TC-B2.2 | P0 | `--fg-faint` on `--bg` (light + dark) | ≥4.5:1 (post-fix 4.6 / 5.6) |
| TC-B2.3 | P0 | Fallback badge text on amber-500 | ≥4.5:1 |
| TC-B2.4 | P1 | Dark mode active toggle vs track | Visually distinct (not receding) |
| TC-B2.5 | P1 | Link blue on bg (light + dark) | ≥4.5:1 |

### B3. Typography

| ID | P | Check | Expected |
|----|---|-------|----------|
| TC-B3.1 | P1 | Specimen rows | Render in the actually-detected face |
| TC-B3.2 | P2 | UI text | System-UI stack, sizes from `--t-*` scale only |
| TC-B3.3 | P1 | Expanded card specimen | Crisp at HiDPI (no compositor blur) |

### B4. Motion (smooth + reduced-motion)

| ID | P | Check | Expected |
|----|---|-------|----------|
| TC-B4.1 | P1 | Chip cursor-follow | Snaps to cursor every frame (no transition) — WhatFont-style, zero trail/lag |
| TC-B4.2 | P1 | Empty illustration | Gentle float; magnifier scan in inspect |
| TC-B4.3 | P1 | Scanning skeleton | Shimmer sweep, replaced by cards on result |
| TC-B4.4 | P0 | OS "Reduce Motion" on | ALL animations disabled (chip, illo, skeleton, toast, row) |
| TC-B4.5 | P2 | Toast | Fade in 120ms / out 200ms, dwell ~1.8s |

### B5. States & emptiness

| ID | P | Check | Expected |
|----|---|-------|----------|
| TC-B5.1 | P1 | Hover empty | Illustration + "Pin a font to start" + helpful sub |
| TC-B5.2 | P1 | Inspect empty | Magnifier illo + "Scanning this page" + skeleton |
| TC-B5.3 | P2 | Low-confidence row | Subtle "?" badge w/ CSP tooltip |
| TC-B5.4 | P1 | Fallback family card | Amber-tinted border + "Söhne → Arial" header |

### B6. Accessibility (a11y)

| ID | P | Check | Expected |
|----|---|-------|----------|
| TC-B6.1 | P0 | Keyboard | Tab reaches every control; visible focus ring |
| TC-B6.2 | P0 | Rows | Arrow up/down move focus, Enter copies, Esc exits |
| TC-B6.3 | P1 | Landmarks | `<main role=region aria-label="Detected fonts">`, header banner |
| TC-B6.4 | P1 | Buttons | All interactive els have aria-label / aria-pressed |
| TC-B6.5 | P1 | Headings | Demo page: one h1, sane heading order |
| TC-B6.6 | P2 | Screen reader | Rows announce "family role, N px, weight" |

### B7. Responsive / panel width

| ID | P | Check | Expected |
|----|---|-------|----------|
| TC-B7.1 | P1 | Panel at ~380px | No horizontal scroll; header grid holds |
| TC-B7.2 | P2 | Long family names | Truncate with ellipsis, no overflow |
| TC-B7.3 | P2 | Long @font-face URL in drawer | Wraps/scrolls, doesn't blow layout |

---

## Coverage map → automated tests

Most P0/P1 logic already has automated coverage:

- Detection, fallback, system-stack, confidence → `lib/detector.test.js`, `lib/*.test.js` (vitest)
- Extraction, iframes, shadow, footnotes → `lib/extractor*.test.js`
- Resolver/source links → `lib/resolver.test.js`, `lib/source-classify.test.js`
- Export / tokens → `lib/export.test.js`, `lib/tokens-export.test.js`
- Overlay states (compact/expanded/pin/anti-chase) → `content/overlay.test.js`
- Panel render, theme flip, download-disabled, hint → `sidepanel/render.test.js`, `test/e2e/static-pages.spec.js`
- Panel-close teardown, chip-on-demo → `test/e2e/hover-chip.spec.js`

Total automated: **230 vitest + 19 Playwright** green.

## Manual-only cases (no automated coverage — run before each release)

TC-A2.8 (real-site jank feel), TC-A3.2 / TC-B3.3 (HiDPI crispness — visual),
TC-A6.5 (actual file download), TC-A8.2 (live page reflow), TC-A9.3 on a real
panel close, TC-B4.4 (OS reduce-motion), TC-B2.* (contrast eyeball on real
pages), all of B1/B5/B7 (visual judgment).
