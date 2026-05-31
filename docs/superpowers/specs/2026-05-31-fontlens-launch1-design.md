# FontLens — Launch 1 Design Spec

**Date:** 2026-05-31
**Status:** Approved for implementation planning
**Audience:** designers and frontend developers, equally

---

## 1. Product

A Chrome (Manifest V3) extension that inspects fonts on any web page and surfaces three things no incumbent tool gets right:

1. **Requested vs actually-rendered font** — when the page asks for "Söhne" but the browser fell back to Arial, FontLens shows both and flags the gap.
2. **Full type system of a selection** — one click yields every distinct type style on the element (or whole page) grouped by family.
3. **Copy as CSS / Tailwind / Design Token** — one click to the format the user actually needs.

The wedge — visible on the hover chip via an amber "fallback" dot — is that no other extension reliably detects when a requested font isn't loading and visitors are seeing a substitute. That single visual is the marketing asset.

Operates fully local. Zero network, zero data exfiltration, zero operating cost. This is also a trust signal that goes in the store listing.

## 2. Audience

Designers (Figma users, visual polish, copy-as-tokens) and frontend devs (CSS/Tailwind output, fallback debugging) — both first-class. Design must satisfy both without splitting the surface.

## 3. Name and Branding

**FontLens.** Visual personality: **Minimal Mono** — mostly grayscale, generous whitespace, one amber accent reserved exclusively for the fallback signal so it always means one thing. Both light and dark themes ship at launch, auto via `prefers-color-scheme` with a manual override toggle in the side panel header.

---

## 4. Architecture (MV3, 2026)

Four surfaces, each with one job. Every assumption respects 2026 MV3 constraints: service workers sleep after ~30s of inactivity, no remotely-hosted code allowed, all dependencies bundled.

### 4.1 Content script (`content/`)

The only surface with DOM access. Does all reading and all in-page UI. Injected via `chrome.scripting` on user action, never auto.

Components:

- `content.js` — entry. Receives messages from service worker, switches between Hover and Inspect modes, owns the overlay lifecycle.
- `detector.js` — the detection engine (see §5). Pure functions, no DOM mutation.
- `extractor.js` — full-system walk of a selection or `<body>` (see §6).
- `overlay.js` — Shadow-DOM hover chip and inspect highlight. **Shadow DOM is non-negotiable** — host site CSS must not deform FontLens UI.
- `overlay.css` — injected into the shadow root only.

### 4.2 Side panel (`sidepanel/`)

Uses Chrome's Side Panel API (not a popup). Popups die on the next page click — fatal for an inspect tool. Persistent across navigations.

- `panel.html` — root document.
- `panel.js` — renders family-grouped style cards, handles copy buttons, theme toggle, mode toggle.
- `panel.css` — Minimal Mono theme, light + dark.

### 4.3 Service worker (`service-worker.js`)

Thin router. Handles toolbar click, the keyboard command, opens the side panel, relays messages between content and panel. **Holds zero important state in memory** — anything that needs to survive a 30-second nap goes in `chrome.storage.session` or `chrome.storage.local`.

### 4.4 Options page (`options/`)

User preferences: default copy format (CSS / Tailwind / Token), keyboard shortcut binding, theme preference (auto / light / dark), the "notify me" email capture for Launch 2 features.

### 4.5 Directory layout

```
fontlens/
├── manifest.json
├── service-worker.js
├── content/
│   ├── content.js
│   ├── detector.js
│   ├── extractor.js
│   ├── overlay.js
│   └── overlay.css
├── sidepanel/
│   ├── panel.html
│   ├── panel.js
│   └── panel.css
├── options/
│   ├── options.html
│   └── options.js
├── lib/
│   ├── export.js          # CSS / Tailwind / token serializers
│   └── roles.js           # R4 role inference (see §6.2)
├── onboarding/
│   └── demo.html          # first-run page (see §9)
└── icons/                 # 16, 32, 48, 128
```

### 4.6 manifest.json

```json
{
  "manifest_version": 3,
  "name": "FontLens — Font Inspector & Fallback Detector",
  "version": "1.0.0",
  "permissions": ["activeTab", "scripting", "sidePanel", "storage"],
  "background": { "service_worker": "service-worker.js" },
  "side_panel": { "default_path": "sidepanel/panel.html" },
  "action": { "default_title": "Inspect fonts" },
  "commands": {
    "toggle-inspect": {
      "suggested_key": { "default": "Alt+Shift+F" },
      "description": "Toggle font inspector"
    }
  },
  "options_page": "options/options.html",
  "icons": { "16":"icons/16.png","48":"icons/48.png","128":"icons/128.png" }
}
```

No `host_permissions`. `activeTab` + `scripting` lets FontLens inject into the current tab on user action and is the smallest permission footprint that works. Smaller footprint = faster store review, more trust.

---

## 5. Detection Engine

This is where the product wins or loses. Three layers, fastest-to-slowest.

### 5.1 Layer 1 — Requested stack

```js
const cs = getComputedStyle(el);
const requestedStack = cs.fontFamily;
const families = parseStack(requestedStack); // ['Söhne','Arial','sans-serif']
```

### 5.2 Layer 2 — Is the first-choice face loaded?

```js
const wanted = `${cs.fontWeight} ${cs.fontStyle} 16px "${families[0]}"`;
const isLoaded = document.fonts.check(wanted);
```

Fast but not sufficient — `document.fonts.check()` can return true for a name that resolves to a system fallback. Confirm with Layer 3.

### 5.3 Layer 3 — Canvas width-fingerprinting

```js
function rendersDistinctly(family, weight, style) {
  const probe = "mmmiiiwwWQ@gjpy 0123";
  const size = "72px";
  const baselines = ["monospace", "serif", "sans-serif"];
  const ctx = document.createElement("canvas").getContext("2d");

  for (const base of baselines) {
    ctx.font = `${style} ${weight} ${size} "${family}", ${base}`;
    const wWith = ctx.measureText(probe).width;
    ctx.font = `${style} ${weight} ${size} ${base}`;
    const wBase = ctx.measureText(probe).width;
    if (Math.abs(wWith - wBase) > 0.5) return true;
  }
  return false;
}
```

Walk the requested stack. The first family that renders distinctly (or that `document.fonts.check` confirms) is the actually-rendered font. If it isn't `families[0]`, that's a fallback — and that's the headline output.

### 5.4 Layer 4 — Name the true source

Scan `document.styleSheets` for `@font-face` rules matching the rendered family. Parse `src` URLs to label origin: Google Fonts / Adobe Fonts / self-hosted / system. Report format (woff2 / woff / ttf). Read `font-variation-settings` and expose axes when the face is a variable font.

### 5.5 System-stack edge case

When the stack is `-apple-system, system-ui, BlinkMacSystemFont, ...`, do **not** show a wrong specific name. Detect OS via `navigator.userAgentData?.platform` and label honestly: "System UI (San Francisco on macOS)" or "System UI (Segoe UI on Windows)." This is exactly the case WhatFont gets wrong; getting it right is part of the wedge.

### 5.6 Output shape

```js
{
  requested: ['Söhne','Arial','sans-serif'],
  rendered: 'Arial',
  isFallback: true,
  source: { type: 'system', detail: 'Arial fallback' },
  isVariable: false,
  axes: null,           // or { wght:[100,900], wdth:[75,125], opsz:[6,144] }
  metrics: {
    size: '16px', weight: 400, lineHeight: '24px',
    letterSpacing: 'normal', transform: 'none',
    color: { rgb: 'rgb(34,34,34)', hex: '#222222' }
  }
}
```

Color is captured in both `rgb()` (raw `getComputedStyle` output) and `hex` (normalized for CSS / token export). Exporters in `lib/export.js` pick the form appropriate to the target format.

### 5.7 Honest failure modes

Two technical risks are named in the spec and need explicit graceful behavior:

- **Canvas read blocked by CSP** on some sites. Degrade to `document.fonts.check`-only result with a quiet "couldn't confirm rendering" tag rather than asserting something wrong.
- **Width collisions** — two fonts can occasionally produce near-identical widths. Multi-baseline measurement (mono + serif + sans) is the mitigation; if all three collide we report low confidence.

---

## 6. Full-System Extraction

### 6.1 Walk

```js
function extract(root) {
  const seen = new Map();
  const MAX_NODES = 5000;
  let count = 0;
  for (const node of root.querySelectorAll("*")) {
    if (++count > MAX_NODES) break;
    if (!hasVisibleText(node)) continue;
    const d = detect(node);
    const key = styleKey(d.metrics, d.rendered);
    if (!seen.has(key)) seen.set(key, { detail: d, count: 0, nodes: [], role: inferRole(node, d.metrics) });
    const entry = seen.get(key);
    entry.count++;
    entry.nodes.push(node);
  }
  return [...seen.values()].sort((a, b) => b.count - a.count);
}
```

Cap at 5,000 nodes for performance. Debounce. Run extraction off the hover path so the page never janks.

### 6.2 R4 role inference (`lib/roles.js`)

The role label (Headline / Body / Caption / Label / Code) is a hint that appears only in side-panel cards, never on the hover chip. Rules in order:

1. **Semantic tag wins**
   - `h1`–`h6` → **Headline**
   - `p` → **Body**
   - `small`, `figcaption`, `caption` → **Caption**
   - `button`, `label`, `[role="button"]` → **Label**
   - `code`, `pre`, `kbd`, `samp` → **Code**
2. **ARIA fallback** — `role="heading"` → **Headline**
3. **Size-bucket fallback** — only when the tag is non-semantic (`div`, `span`, `a`):
   - `≥24px` → Headline
   - `14–22px` → Body
   - `≤13px` → Caption
4. Metrics remain the source of truth. The role is descriptive, not prescriptive.

### 6.3 Hybrid panel grouping

Top level: **family group** (one card per detected family, with badge: Self-hosted / Google / Adobe / System / Fallback). Inside: rows sorted by **usage count descending**. Each row shows role, specimen line, metrics, and (on hover) copy buttons.

Hovering a row highlights every matching node on the page via a temporary outline class injected by the content script. Leaving the row removes the highlight.

---

## 7. Export (`lib/export.js`)

Three serializers per style row. Copy via `navigator.clipboard.writeText`, confirm with a small toast in the side panel.

**CSS** (default; user-configurable):

```css
font-family: "Söhne", Arial, sans-serif;
font-weight: 400; font-size: 16px; line-height: 24px;
letter-spacing: normal; color: #222;
```

**Tailwind** (nearest-mapping; arbitrary-value form when no exact map exists, flagged):

```
font-normal text-base leading-6 tracking-normal text-[#222222]
```

Where Tailwind can't map exactly, emit the arbitrary form (`text-[17px]`) rather than rounding silently. A small "≈" tag appears on the button when any value is approximate.

**Design Token (JSON)**:

```json
{
  "fontFamily": "Söhne",
  "fontWeight": 400,
  "fontSize": "16px",
  "lineHeight": "24px",
  "letterSpacing": "0",
  "color": "#222222"
}
```

---

## 8. UI / UX

### 8.1 Interaction model

**Two modes, one toggle** in the side panel header, toggleable via keyboard too:

- **Hover** — cursor moves, a small floating chip follows showing the rendered font, fallback dot, and metrics. **Click chip** to pin it at the last-hover position; Esc unpins. **Click element** fills the side panel with that element's row, scrolling it into view.
- **Inspect** — click an element → full `extract()` walk of that element → side panel renders the complete family-grouped tree.

Toolbar-click behavior:

- Opens the side panel **and** enables Hover mode in one action. Single-action onboarding, zero friction.

Keyboard:

- `Alt+Shift+F` toggles Hover/Inspect mode globally. User can rebind in Options.
- `Esc` exits inspect mode and unpins any chip.
- Arrow keys move focus between rows in the side panel.

### 8.2 Hover chip — the signature interaction

Shadow-DOM root, fixed positioning, follows cursor with ~80ms ease so it feels alive (not jittery).

Content:
- Line 1: **rendered font name**, bold.
- Line 2: `size · weight · lineHeight/size` in muted mono.

The fallback tell: when `rendered ≠ requested`, the chip shows an **amber dot + "fallback" tag** and a second muted line "requested: Söhne". One glance communicates the differentiating fact. This is the screenshot you put in the store listing.

Role label is **not** on the chip — it would crowd the glance and inference is fragile on tagless sites (e.g., Stripe's `<div>`-as-headline pattern). Role lives in the side panel.

### 8.3 Side panel — the workhorse

**Header**
- FontLens wordmark left
- Mode toggle (Hover / Inspect) center
- Theme toggle (Auto / Light / Dark icon) right

**Page-level fallback banner** (conditional)
- Appears at top of body when any fallback is detected anywhere on the page
- Amber background, single line: "⚠ 2 of this page's fonts aren't loading — visitors see fallbacks."
- This reframes the product from "what font is this" to "is this site's typography even working" — a sharper, more valuable promise.

**Summary line** — "3 fonts · 7 type styles · stripe.com"

**Family cards (hybrid layout)**
- One card per detected family
- Card header: family name, source badge, format and usage count
- Rows inside: role label (uppercase mini-label) · specimen ("Almost before we knew it" rendered in the actual face) · metrics line in mono · usage count chip
- Hover row → reveals three copy buttons (CSS / Tailwind / Token) + highlights matching nodes on the page

**Fallback cards** get a special treatment: amber-tinted border, amber dot prefix, badge reads "Fallback", header reads "Söhne → Arial".

**Variable-font axis display** — when a face is variable, the card shows axis tags (`wght 100→900`, `wdth 75→125`, `opsz 6→144`) and the currently-applied values. Interactive sliders are included in Launch 1 (per scope lock). Slider mutates `font-variation-settings` on selected nodes live so the user can audition values.

**Footer** — single muted line:

> Coming soon: free-font alternatives · Figma export — [notify me]

The "notify me" opens a tiny email-capture sheet. Email is stored in `chrome.storage.local` and, only if the user clicks the explicit "Send to developer" button on the same sheet, POSTed once to FontLens's signup endpoint. Default-off: no network call happens unless the user takes that second action. Demand signal for Launch 2, with consent.

### 8.4 Visual system

- Background: pure white in light, near-black in dark. One restrained blue accent.
- Amber `#f59e0b` reserved exclusively for the fallback signal.
- System-font UI so it feels native and loads instantly.
- Micro-interactions: copy → checkmark + "Copied!" toast; row hover → gentle background fill; card hover → subtle border. Small, fast, satisfying.
- Auto theme via `prefers-color-scheme`, manual override saved to `chrome.storage.local`.

### 8.5 Accessibility of FontLens itself

We are a typography tool — sloppy a11y in our own UI is an own goal. Keyboard-operable end-to-end (Esc exits, arrows move row focus, Enter copies the default format). ARIA labels on every interactive element. Visible focus rings.

---

## 9. Onboarding

On first install:

1. Service worker opens **`onboarding/demo.html` in a new tab**. The page intentionally requests a font that won't load (e.g., `font-family: "FakeFontThatDoesntExist", Arial`) alongside one self-hosted face that does load.
2. The side panel auto-opens in Hover mode.
3. The page contains a single short instruction: "Hover the headline below."
4. As the user hovers, the chip lights up the amber fallback dot for the first paragraph (fake font → Arial) and shows the real face on the second paragraph (working font).
5. A small "✓ You've seen the fallback signal — that's the part nobody else shows you" line confirms the moment.
6. Bottom of demo page: a "Try it on your favorite site" button that closes the demo tab.

Goal: the killer feature is visible in the first 10 seconds without the user hunting for it.

---

## 10. Edge Cases

- **Same-origin iframes** — content script descends into accessible iframes and labels rows with their `[src]` host. Cross-origin iframes get a single placeholder card: "1 frame couldn't be inspected (cross-origin)."
- **Open Shadow DOM** on the page — content script descends. Closed shadow roots are untouchable; report a quiet "N nodes in closed shadow trees were skipped" footnote.
- **Very large pages** (>5000 visible text nodes) — extraction caps at 5000 with a footnote: "Showing styles from the first 5000 text nodes." Counts in cards remain accurate to the sampled population.
- **No fonts detected** (rare: empty page, blank tabs) — side panel shows a friendly empty state "Navigate to a page with text and try again."
- **Service worker cold-wake** — content script holds session UI state, panel re-requests page summary via message on focus. SW is treated as ephemeral.
- **CSP blocking canvas read** — degrade to `document.fonts.check`-only with a low-confidence tag (see §5.7).

---

## 11. Performance Guards

- Hover detection runs on `mousemove` with 60Hz `requestAnimationFrame` throttle.
- Extraction is async, debounced 150ms after the inspect-click.
- The 5000-node cap is non-negotiable for Launch 1.
- Shadow root attaches once per content-script lifetime; chip recycles a single root element.

---

## 12. Build Sequence

Realistic solo timing, roughly 5–6 weeks.

1. **Week 1 — Engine, headless.** `detector.js` in isolation with a small test harness page. Validate on real font-stack-heavy sites where WhatFont shows the wrong name. If this week fails, nothing else matters.
2. **Week 2 — Overlay + hover chip.** Shadow DOM, cursor tracking, the fallback dot. Pin behavior. Get the signature interaction feeling good.
3. **Week 3 — Side panel + extraction.** Hybrid family-grouped layout, R4 role labels, click-to-highlight matching nodes.
4. **Week 4 — Export + variable-font sliders + polish.** Three serializers, copy/toast, dark mode, the page-level fallback banner, axis sliders.
5. **Week 5 — Edge cases + onboarding.** System stacks, variable fonts, same-origin iframes, shadow-DOM-heavy sites, the demo-page first-run, performance caps.
6. **Week 6 — Store prep.** Screenshots (lead with the fallback chip), listing copy, privacy disclosure ("all processing local, no data leaves your browser"), then submit.

---

## 13. Launch 1 Feature Lock

All eight items ship in Launch 1:

- A — Hover chip + side panel + 3 export formats
- B — Full-page extraction grouped by style, sorted by usage
- C — Click row → highlight matching nodes
- D — Variable font axis display
- E — Variable font axis sliders (interactive, mutates page live)
- F — Same-origin iframe support
- G — Onboarding demo page on first install
- H — Page-level fallback banner

---

## 14. Open Questions for Implementation Plan

These are not blocking the design but will be resolved during the implementation plan:

- Exact width-difference threshold for Layer 3 (currently 0.5px) — needs empirical tuning across real pages.
- Whether to debounce the variable-font slider value to avoid layout thrash, and at what cadence.
- The exact endpoint and consent UX for the "notify me" capture (Launch 2 demand signal). Default-off pending user opt-in.
- Screenshot set and copy for the Chrome Web Store listing.

End of design spec.
