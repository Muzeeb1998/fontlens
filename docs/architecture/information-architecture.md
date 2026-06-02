# FontLens — Information Architecture

**Version:** 1.1 (post-Mix-X redesign, post-overlay-anti-chase)
**Last updated:** 2026-06-02
**Audience:** designers and frontend developers, equally.

This document maps every surface FontLens exposes, the content that lives on
each, and how a user moves between them. It is the source of truth for what
goes where — pair with `DESIGN.md` (visual tokens / components) and the
per-launch specs in `docs/specs/`.

---

## 1. Top-level surfaces

FontLens has five user-visible surfaces and three supporting ones.

```
USER-VISIBLE
├── 1. Toolbar action button         (Chrome chrome — entry point)
├── 2. Hover overlay                 (in-page, Shadow DOM)
│   ├── 2a. Compact chip             (default state)
│   └── 2b. Expanded detail card     (View more state)
├── 3. Side panel                    (Chrome Side Panel API)
├── 4. Onboarding demo page          (chrome-extension://.../onboarding/demo.html)
└── 5. Options page                  (chrome-extension://.../options/options.html)

SUPPORTING (not directly invoked by the user)
├── 6. Service worker                 (background router)
├── 7. Content script + loader        (host-page injection)
└── 8. Chrome Web Store listing       (acquisition)
```

---

## 2. Surface content & hierarchy

### 2a. Compact hover chip

The smallest user-visible artifact. Lives in a Shadow DOM rooted on the host
page, follows the cursor with 80 ms ease, freezes position while cursor stays
on the same text element (anti-chase).

```
┌───────────────────────────┐
│ Inter                     │  ← line1   (rendered family, bold)
│ 16px · 400 · normal       │  ← line2   (mono, tabular-nums)
│ ⬤ fallback                │  ← only when isFallback
│ requested: Söhne          │  ← only when isFallback
│ couldn't confirm rendering│  ← only when confidence: low
│ View more →               │  ← CTA into expanded card
└───────────────────────────┘
```

Information shown:
- Rendered family name (Layer-3 canvas fingerprint result, or system OS name)
- Size · Weight · Style
- Amber-dot fallback signal when `isFallback === true` — the wedge
- Low-confidence note when canvas was CSP-blocked
- "View more →" action

Information hidden by default (in expanded card only):
- Color (rgb + swatch)
- Line height
- Full requested stack
- Source classification kind (google/paid/system/selfhosted)

### 2b. Expanded detail card

Triggered by "View more →" on the compact chip. Pins chip in place, fills
in the full attribute grid + specimen line. Dismisses on `×`, Esc, or
click-outside.

```
┌──────────────────────────────────────────────┐
│ Inter — 400                            ×     │  ← header (title + close)
│ 16px · 400 · normal                          │
│ ──────────────────────────────────────────── │
│ FAMILY        Inter                          │
│ STYLE         normal                         │
│ WEIGHT        400                            │
│ COLOR     ▪   rgb(34, 34, 34)               │
│ SIZE          16px                           │
│ LINE HEIGHT   24px                           │
│ ──────────────────────────────────────────── │
│ AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQq           │  ← specimen in detected font
│ ⬤ fallback — requested: Söhne                │  ← only when isFallback
└──────────────────────────────────────────────┘
```

### 3. Side panel

Chrome Side Panel API. Persistent across page clicks. The workhorse surface.

```
┌──────────────────────────────────────────────┐
│ FontLens     [Hover|Inspect]  [Auto|Light|Dark] │ ← header
├──────────────────────────────────────────────┤
│ ⚠ 1 of this page's font isn't loading…       │ ← fallback banner (conditional)
├──────────────────────────────────────────────┤
│ 3 fonts · 7 type styles · stripe.com         │ ← summary
├──────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────┐ │
│ │ Söhne   [SELF-HOSTED ↗]  woff2 · 192 nodes│ │ ← family-card head (badge = link)
│ │ ──────────────────────────────────────── │ │
│ │ BODY      Almost before…    16/400/24 142×│ │ ← style row
│ │ HEADLINE  Almost before…    28/600/32  12×│ │
│ │ CAPTION   Almost before…    12/500/16   8×│ │
│ │ ┌──────────────────────────────────────┐ │ │
│ │ │ <link>     [Copy]                    │ │ │ ← Embed drawer (on row-hover toggle)
│ │ │ @import    [Copy]                    │ │ │
│ │ └──────────────────────────────────────┘ │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ ┌──────────────────────────────────────────┐ │
│ │ ⬤ Söhne → Arial  [FALLBACK]  ...         │ │ ← fallback family card
│ └──────────────────────────────────────────┘ │
│                                              │
│ ┌──────────────────────────────────────────┐ │
│ │ N frames couldn't be inspected (cross-origin) │ ← placeholder card
│ └──────────────────────────────────────────┘ │
├──────────────────────────────────────────────┤
│ Showing styles from the first 5000 text nodes│ ← footnote
└──────────────────────────────────────────────┘
        Toast appears bottom-right on copy
```

Content by zone:
- **Header**: brand wordmark · mode toggle (Hover/Inspect) · theme toggle (Auto/Light/Dark)
- **Banner** (conditional): amber strip, only when any family has a fallback
- **Summary**: aggregate counts + hostname
- **Region** (`role="region"`): family cards, ordered fallback-first then by usage
- **Footnotes** (conditional): truncation note, closed-shadow note
- **Cross-origin placeholder card** (conditional)
- **Toast**: copy confirmations, fades 1800 ms

Per family card:
- Card head: family name · linkable badge (kind) · optional Variable badge · `N uses · format`
- Style rows: role label · specimen · metrics · count chip · hover-revealed copy buttons (CSS / Tailwind / Token / Embed)
- Inline Embed drawer per row (hidden until toggle): snippet rows with per-snippet copy + hint line
- Variable-axes block (conditional): per-axis slider with min/max/current + Reset

### 4. Onboarding demo page

Static page bundled at `onboarding/demo.html`. Opens on first install via
service-worker `onInstalled` flow. Boots the content script inline so the
hover chip works without the user clicking the toolbar.

```
FontLens                                          (h1, brand)

Hover the headlines below.                        (instruction)

┌──────────────────────────────────────────────┐
│ This headline asks for a font that isn't     │ ← demo h2 (intentional fallback)
│ loaded.                                      │
│ It falls back to your system serif.          │
│                                              │
│ This one renders the font the designer chose.│ ← demo h2 (working)
│ Same hover, no fallback dot.                 │
└──────────────────────────────────────────────┘

✓ You've seen the fallback signal — that's      ← appears on first amber-dot
  the part nobody else shows you.                hover (via postMessage)

[ Try it on your favorite site ]                ← exit CTA
```

### 5. Options page

Reachable via `chrome://extensions` → FontLens → Details → Extension options.

```
FontLens — Options

Default copy format
  ( ) CSS
  ( ) Tailwind
  ( ) Design Token (JSON)
```

One field today. Plumbed via `chrome.storage.local.defaultFormat`.
Side-panel keyboard `Enter` on a focused row copies in this format.

---

## 3. Data model — what info lives where

| Datum | Source | Surface(s) |
|-------|--------|------------|
| Detect result (`requested`, `rendered`, `isFallback`, `source`, `metrics`, `confidence`, `isVariable`, `axes`) | `lib/detector.js` (canvas + `document.fonts.check` + system-OS map) | chip · expanded card · side panel rows · Embed drawer |
| Extracted payload (`groups`, `rows`, `footnotes`) | `lib/extractor.js` (walks root + iframes + open shadow) | side panel only |
| Resolver verdict (`kind`, `name`, `specimenUrl`/`url`/`foundry`/`os`) | `lib/resolver.js` over bundled `data/google-fonts.json` + `data/paid-fonts.json` | clickable badge · Embed drawer kind |
| Snippets (`<link>`, `@import`, `@font-face`, CSS) | `lib/snippets.js` | Embed drawer per row |
| Theme + default format | `chrome.storage.local` | side panel header · options page |
| Installed flag | `chrome.storage.local.fontlens.installed` | service worker only (onboarding gate) |
| Node map (`Map<id, Element>`) | content script in-memory | hover highlight via `fontlens:highlight` |
| Variable axis defaults / current | content script `_originalAxes` WeakMap | axis slider Reset |

Nothing leaves the device. No analytics, no remote API.

---

## 4. State machines

### 4.1 Overlay (content script)

```
                  toolbar click / Alt+Shift+F
                            │
                            ▼
                ┌─────────────────────┐
                │      DISABLED       │
                └─────────┬───────────┘
                          │ enable()
                          ▼
        ┌──────────────────────────────────┐
        │           HOVER mode              │◄──── default
        │  ┌──────────────────────────────┐ │
        │  │  Compact chip following      │ │
        │  │  (freezes on same element)   │ │
        │  └─────┬─────────────┬──────────┘ │
        │        │             │            │
        │  View more       Shift+click      │
        │        │             │            │
        │  ┌─────▼─────┐  ┌────▼─────────┐  │
        │  │ EXPANDED  │  │ PINNED       │  │
        │  │ (card)    │  │ (chip stays) │  │
        │  └─────┬─────┘  └────┬─────────┘  │
        │   ×/Esc/outside     Esc           │
        │        │             │            │
        │  ┌─────▼─────────────▼─────────┐  │
        │  │  back to floating compact   │  │
        │  └──────────────────────────────┘  │
        └────────────────┬─────────────────┘
                         │ setMode('inspect')
                         ▼
                ┌─────────────────────┐
                │     INSPECT mode    │
                │  Outline tracks el  │
                │  Click → extract +  │
                │     emit to panel   │
                └─────────────────────┘
```

### 4.2 Side panel

```
                init()
                  │
                  ▼
       ┌──────────────────────┐
       │ loadTheme + paint    │
       │ ensureContent → SW   │
       └──────┬───────────────┘
              │ first extract-result
              ▼
       ┌──────────────────────┐
       │ Render summary +     │◄───────── focus → request-extract
       │ banner + family cards │
       └─────┬─────────────┬──┘
             │             │
        row hover    Embed click
             │             │
             ▼             ▼
        fontlens:        toggle drawer
        highlight        in place
        (page outline)
```

### 4.3 Service worker

```
onInstalled
   │
   ├─ setPanelBehavior(openPanelOnActionClick: false)
   ├─ verdict({reason}, storageGet, demoUrl)
   │     └─ install → open demo tab + sidePanel.open()
   │
action.onClicked(tab)
   │
   └─ injectAndKick(tabId, 'hover')
         ├─ sidePanel.open
         ├─ scripting.executeScript(['content/loader.js'])
         └─ tryKick → sendMessage 'set-mode' + 'request-extract' (5×, 200ms)

commands.onCommand 'toggle-inspect'
   └─ injectAndKick(activeTab, 'inspect')

runtime.onMessage 'fontlens:ensure-content'
   └─ inject loader + delayed request-extract
```

---

## 5. Navigation map (cross-surface routing)

```
                ┌──────────────────────────────┐
                │ Chrome Web Store listing     │
                └──────────────┬───────────────┘
                               │ install
                               ▼
                ┌──────────────────────────────┐
                │ Onboarding demo + side panel │
                │       (first install)         │
                └──────┬───────────────────┬───┘
                       │ exit              │ hover anywhere
                       ▼                   ▼
              ┌─────────────┐    ┌───────────────────┐
              │  Real page  │◄───┤  Hover chip       │
              └─────┬───────┘    └─────┬─────────────┘
       toolbar      │                  │ View more
        click       │                  ▼
                    │            ┌─────────────────────┐
                    │            │ Expanded detail card │
                    │            └─────────┬───────────┘
                    │                      │ × / Esc / outside
                    ▼                      ▼
              ┌─────────────────────────────────┐
              │           Side panel             │
              │  ┌───────────────────────────┐   │
              │  │ Family cards / rows       │   │
              │  └──┬────────────────────┬───┘   │
              │     │ row hover         │ click
              │     ▼                    ▼
              │ Page outline    Copy default format
              │  highlight      (Enter)  + toast
              │     │
              │ Embed click
              │     │
              │     ▼
              │ Embed drawer
              │     │ per-snippet Copy
              │     ▼
              │   Toast
              └─────────────────────────────────┘

  Independent: chrome://extensions → Options page (defaultFormat)
```

---

## 6. User flows

### 6.1 First install (onboarding)

```
1. User installs from Chrome Web Store.
2. service-worker.js onInstalled fires.
3. install.verdict() returns { action: 'open-demo', url: chrome-extension://.../onboarding/demo.html }.
4. SW: chrome.tabs.create(url) + chrome.sidePanel.open(tabId).
5. Demo page boots content.js inline (no chrome.scripting needed).
6. Overlay mounts in Shadow DOM. Side panel renders empty state until first extract.
7. User hovers fallback-headline → compact chip appears: "Georgia" + amber dot.
8. window.postMessage({type:'fontlens:fallback-seen'}) → demo.js reveals confirmation.
9. User clicks "Try it on your favorite site" → tab.remove().
10. Reload extension never re-opens demo (fontlens.installed flag).
```

### 6.2 Toolbar click on a real site

```
1. User on stripe.com.
2. Clicks FontLens toolbar icon.
3. chrome.action.onClicked(tab) fires (because setPanelBehavior false).
4. injectAndKick(tabId, 'hover'):
   a. sidePanel.open({tabId}) — panel opens.
   b. scripting.executeScript({files:['content/loader.js']}) — activeTab grants permission.
   c. loader.js dynamic-imports content/content.js.
   d. content.js auto-boots: Overlay.mount, mousemove + click listeners.
   e. setTimeout(150ms) → SW sends 'fontlens:set-mode' + 'fontlens:request-extract'.
      Retries 5× at 200ms if content.js hasn't subscribed yet.
5. content.js receives request-extract → runs lib/extractor.js → sends fontlens:extract-result.
6. Panel onContentMessage receives → state.payload = … → paint() → family cards render.
7. User hovers any text → cursor-follow chip appears with detected font.
```

### 6.3 Hover detection (per element)

```
mousemove → content.js _onMouseMove → throttle via raf
  → elementFromPoint(x,y)
  → if our own UI (host) → bail
  → findTextElement(hit) → walk up to nearest with direct text node
  → overlay.show(el, cursor)
       → if pinned: bail
       → if el === lastEl: cache cursor only, no reposition
       → else: detect(el) → _renderChip(detail) → _position(cursor)
```

### 6.4 View-more expand

```
User clicks "View more →" on compact chip.
  → _setExpanded(true)
      → _expanded = true, _pinned = true
      → host[data-pinned]=true (chip becomes pointer-events:auto)
      → installs document mousedown listener (outside-click dismiss)
      → re-renders chip in expanded layout
User clicks ×  /  presses Esc  /  clicks outside chip
  → _setExpanded(false) + hide()
      → drops pinned + expanded, removes outside listener, hides chip
```

### 6.5 Copy as CSS / Tailwind / Token

```
User hovers a row in the side panel → copy buttons reveal.
Click [CSS]:
  → panel.js delegated click handler reads dataset.copy + parses dataset.detail JSON
  → serialize(detail, 'css') → toCSS(detail) → string
  → navigator.clipboard.writeText(text)
  → showToast('Copied as CSS')  ← 1800ms then fade

Keyboard equivalent:
  Tab into region → ArrowDown / ArrowUp to focused row → Enter
  → panel.js bindKeyboard Enter handler → focused.click() → onActivate(row)
  → copyDetail(row.detail, state.defaultFormat) → same path
```

### 6.6 Embed snippet drawer

```
Row hover → [Embed] button visible (only if resolved.kind in {google, selfhosted, system}).
Click [Embed]:
  → panel.js regionEl click handler reads data-embed-toggle
  → finds .fl-embed-drawer[data-embed-key="<key>"]
  → toggles [hidden], updates aria-expanded
User clicks [Copy] on a snippet row:
  → same data-copy="snippet" path as Phase 4
  → navigator.clipboard.writeText(dataset.snippet)
  → showToast('Copied as snippet')   ← refined in subsequent passes
Esc inside drawer:
  → regionEl keydown handler closes drawer + focuses toggle button
```

### 6.7 Variable-font axis slider

```
Family card with isVariable === true → axes block renders.
User drags slider (input event):
  → panel.js regionEl input handler reads block.dataset.styleKey + per-axis values
  → throttle 30ms → sendToContent({type:'fontlens:apply-axes', styleKey, values})
  → content.js _applyAxes:
      list = nodesByStyle.get(styleKey)
      for each el: originalAxes.set(el, el.style.fontVariationSettings || '')
                   el.style.fontVariationSettings = '"wght" N, "wdth" M'
Reset link:
  → input.value = input.dataset.default + sendToContent('fontlens:reset-axes')
  → content.js restores original or removes inline style
```

### 6.8 Side-panel row highlights matching nodes

```
Mouseenter / focus on a row:
  → onHighlight(row) callback
  → sendToContent({type:'fontlens:highlight', key, nodeIds})
  → content.js _applyHighlight: adds .fontlens-highlight class
     (style block injected at content script boot — amber outline)
Mouseleave / blur:
  → onUnhighlight(row)
  → sendToContent({type:'fontlens:unhighlight', key})
  → content.js _clearHighlight: removes class from all marked nodes
```

### 6.9 Theme + mode toggles

```
Theme:
  Click Auto / Light / Dark → applyTheme(t) → document[data-theme]=t
  → saveTheme(t) → chrome.storage.local.set({theme:t})
  → paint() (renderHeader updates aria-pressed)

Mode:
  Click Hover / Inspect → state.mode = mode
  → sendToContent({type:'fontlens:set-mode', mode})
  → overlay.setMode(mode) on page side
  → paint() (header aria-pressed flips)
```

### 6.10 Edge cases

```
Cross-origin iframe present on page:
  → extractor-iframes.js: frame.contentDocument throws SecurityError → blockedCount++
  → footnotes.blockedFrames > 0 → panel renders placeholder card.

>5000 visible text nodes on page:
  → extractor caps at 5000 → footnotes.truncated = true
  → panel renders "Showing styles from the first 5000 text nodes."

CSP blocks canvas read:
  → render-detect findRenderedFamily returns null
  → detector.confidence = 'low'
  → row badge: small "?" with tooltip "Detection couldn't be confirmed (CSP)"
  → compact chip: italic "couldn't confirm rendering" row

Service worker nap (after 30s idle):
  → panel.js bindFocusRehydrate: window 'focus' → sendToContent('request-extract')
  → re-extracts from active tab
```

---

## 7. Surface ownership

| Surface | Owner | Files |
|---------|-------|-------|
| Compact chip + expanded card | `content/overlay.js` (Shadow DOM) | content/overlay.js, .test.js |
| Content boot + messaging | `content/content.js` | content/content.js, .test.js, content/loader.js |
| Hover detection engine | `lib/detector.js` + helpers | lib/parse-stack, source-classify, render-detect, variable-axes, roles, style-key, detector |
| Page walk + grouping | `lib/extractor.js` + iframe/shadow helpers | lib/extractor*.js |
| Side panel UI | `sidepanel/` | sidepanel/panel.html, panel.css, panel.js, render.js, messaging.js |
| Get-this-font resolution + snippets | `lib/resolver.js`, `lib/snippets.js` | data/google-fonts.json, data/paid-fonts.json |
| Background routing + onboarding | `service-worker.js` + `lib/install.js` | service-worker.js, lib/install.js, .test.js |
| Onboarding | `onboarding/` | onboarding/demo.html, demo.css, demo.js |
| Options | `options/` | options/options.html, options.js |
| Store artifacts | `store/` | store/listing.md, privacy-answers.yaml, pre-submit-qa.md, submission-walkthrough.md |

---

## 8. Open questions / future surfaces (Launch 2+)

- **Free-font alternatives matcher**: new collapsible block inside the
  expanded detail card listing 3 visually-similar Google Fonts with
  side-by-side specimens. Requires `data/similarity-index.json` built
  offline from font metrics.
- **Figma export**: per family group, "Export to Figma" action that pushes
  a Text Style via the Figma REST API (requires user-supplied PAT).
- **Notify-me** footer in side panel: optional email capture to ping the
  user when matcher / Figma export ship.
- **Per-axis presets**: named instances ("Regular", "Display", etc.) listed
  alongside the slider for one-click application.
- **Iframe row labels**: rows from iframes get a quiet "in iframe.host"
  tag (data already captured in `row.frame`).
