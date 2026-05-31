# Phase 2 — Overlay + Hover Chip

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the in-page Shadow-DOM overlay and the signature hover chip. Cursor follows with an 80ms ease, the chip shows the rendered font name + metrics, and the amber fallback signal lights up when the requested face isn't actually rendering. Click chip → pin; Esc → unpin. Click element in Hover mode emits the detected row to (eventually) the side panel. Inspect mode emits the click target for Phase 3's walker. Host-page navigation must never fire during inspect.

**Architecture:** Three new modules under `content/`. `overlay.js` owns the Shadow DOM root, the chip DOM, render+position math, and pin/unpin state — exported as a small testable class. `overlay.css` is text loaded into the shadow root via a `<style>` element (no external `<link>` — keeps the surface self-contained). `content.js` is the entry point: it wires `mousemove` (rAF-throttled) and `click` to the overlay, manages mode (`hover` vs `inspect`), listens for messages from the service worker, and emits the detected row via `chrome.runtime.sendMessage` (stubbed during tests). The detector from Phase 1 is a black-box dependency injected into the overlay so tests can mock it.

**Tech Stack:** Vanilla ES modules. Vitest + happy-dom for DOM-side tests (Shadow DOM attach, message wiring, pin state, reduced-motion). Real Chrome for the manual cursor-follow harness page. No `chrome.*` APIs imported in modules — they're called through a thin adapter that tests override.

**Spec sections this implements:** `docs/specs/launch1-design.md` §4.1 (content script overlay), §8.2 (hover chip — the signature interaction), §9 interaction-principle 4 (clicking host elements never navigates), §11 perf guards on the overlay. Visual tokens, motion timing, and reduced-motion behavior follow `DESIGN.md` §3, §5, §6.1, §8.

**Depends on:** Phase 1's `lib/detector.js` exporting `detect(el)` with the shape `{requested, rendered, isFallback, source:{type,format,url,os}, isVariable, axes, metrics:{size,weight,lineHeight,letterSpacing,transform,color:{rgb,hex}}, confidence}`. We do not modify Phase 1 code.

---

## File Structure

```
fontlens/
├── content/
│   ├── content.js                 [Task 7]
│   ├── content.test.js            [Task 7]
│   ├── overlay.js                 [Task 3, 4, 5, 6]
│   ├── overlay.css                [Task 2]
│   └── overlay.test.js            [Tasks 3, 4, 5, 6]
├── lib/
│   └── tokens.css                 [Task 1]   (new — referenced by DESIGN.md §11)
├── test/
│   └── harness/
│       ├── overlay-harness.html   [Task 8]
│       └── overlay-harness.js     [Task 8]
└── vitest.config.js               [Task 1]   (modify to include content/)
```

Boundaries:
- `overlay.js` knows nothing about `chrome.*`. It takes a `detect` function and an `onEmit` callback in its constructor. That makes it Vitest-testable.
- `content.js` is the only file that touches `chrome.runtime.sendMessage` / `chrome.runtime.onMessage`. It glues the overlay to the extension's messaging surface.
- `overlay.css` is a static string imported by `overlay.js` and inserted into the shadow root. Host CSS cannot pierce it.
- `lib/tokens.css` is the canonical token sheet referenced by both `overlay.css` (inlined into shadow) and `sidepanel/panel.css` (Phase 3). We create it here because the overlay needs the tokens first.

---

## Task 1: Token sheet + Vitest config extension

Phase 1 set up Vitest to scan `lib/**/*.test.js`. We need to also scan `content/**/*.test.js`. And per DESIGN.md §11 we need `lib/tokens.css` as the single source of truth for color tokens — the overlay will inline a subset of it into the shadow root.

**Files:**
- Create: `lib/tokens.css`
- Modify: `vitest.config.js`

- [ ] **Step 1: Create `lib/tokens.css`**

This is the canonical token declaration referenced by DESIGN.md §3 and §11. Light + dark via `prefers-color-scheme`. Phase 3 will import this into `sidepanel/panel.css`; Phase 2 only uses the tokens it needs for the chip (the rest land harmlessly for later use).

```css
/* lib/tokens.css — FontLens design tokens, single source of truth.
   Referenced by DESIGN.md §3, §11. */

:root {
  /* Light — DESIGN.md §3.1 */
  --bg:            #ffffff;
  --bg-muted:      #fafafa;
  --bg-subtle:     #f4f4f5;
  --border:        #ececec;
  --border-strong: #d4d4d8;
  --fg:            #0f0f10;
  --fg-muted:      #6b6b6e;
  --fg-faint:      #9c9ca0;
  --accent:        #0f0f10;
  --link:          #1e6fd8;
  --amber-500:     #f59e0b;
  --amber-bg:      #fff8eb;
  --amber-border:  #f7e3b9;
  --amber-fg:      #7a4a1d;

  /* Spacing — DESIGN.md §5 */
  --s-1: 4px;  --s-2: 6px;  --s-3: 8px;  --s-4: 10px;
  --s-5: 12px; --s-6: 14px; --s-7: 18px; --s-8: 24px;

  /* Type — DESIGN.md §4.4 */
  --t-xs:   10px;
  --t-sm:   11px;
  --t-base: 12px;
  --t-md:   13px;
  --t-lg:   14px;
  --t-xl:   16px;

  --font-ui:   -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-mono: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;

  /* Chip — DESIGN.md §6.1 */
  --chip-radius: 10px;
  --chip-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg:            #0e0e10;
    --bg-muted:      #161618;
    --bg-subtle:     #1f1f22;
    --border:        #26262a;
    --border-strong: #3a3a3f;
    --fg:            #f5f5f7;
    --fg-muted:      #a1a1a6;
    --fg-faint:      #6b6b6e;
    --accent:        #f5f5f7;
    --link:          #5fa8ff;
    --amber-500:     #f5b840;
    --amber-bg:      #2a1e08;
    --amber-border:  #574014;
    --amber-fg:      #f5d089;
    --chip-shadow:   0 8px 24px rgba(0, 0, 0, 0.6);
  }
}
```

- [ ] **Step 2: Extend `vitest.config.js` to include `content/`**

Open `vitest.config.js` and change the `include` line:

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['lib/**/*.test.js', 'content/**/*.test.js'],
    globals: false,
  },
});
```

- [ ] **Step 3: Verify Vitest still passes**

Run: `npm test`
Expected: all Phase 1 tests still pass; no content tests yet so no new tests run.

- [ ] **Step 4: Commit**

```bash
git add lib/tokens.css vitest.config.js
git commit -m "chore(tokens): introduce lib/tokens.css; widen vitest to content/"
```

---

## Task 2: overlay.css — the chip stylesheet (text only, no UI yet)

The chip needs styles before the overlay code that mounts them. We write the CSS first as a static file. `overlay.js` will read this file's text at build time (or via a small inline duplicate — see implementation note below) and inject it into the shadow root.

> **MV3 + static-import note:** A content script can't `fetch()` arbitrary files without `web_accessible_resources`. The simplest robust pattern is: keep the CSS string inside `overlay.js` as a tagged template literal so the source-of-truth lives in one file. We still keep `content/overlay.css` on disk for IDE syntax highlighting and for the manual harness's `<link>` reference. The two are kept in sync by being literally the same characters.

**Files:**
- Create: `content/overlay.css`

- [ ] **Step 1: Create `content/overlay.css`**

```css
/* content/overlay.css — chip styles injected into the shadow root.
   Tokens come from lib/tokens.css; we re-declare the subset we need here
   because shadow roots don't inherit :root CSS custom properties through
   ::part — only via the host's cascade. We mirror the light/dark token set
   inline so the chip is fully self-contained. */

:host {
  all: initial;
  position: fixed;
  top: 0;
  left: 0;
  z-index: 2147483647;          /* highest sane z-index — sit above host overlays */
  pointer-events: none;          /* let mousemove keep reaching the page */
  contain: layout style;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

:host([data-pinned="true"]) {
  pointer-events: auto;          /* pinned chip is clickable (for unpin etc) */
}

.chip {
  position: absolute;
  top: 0;
  left: 0;
  min-width: 140px;
  max-width: 280px;
  padding: 10px 12px;             /* DESIGN.md §6.1 — var(--s-4) var(--s-5) */
  background: #ffffff;
  color: #0f0f10;
  border: 1px solid #ececec;
  border-radius: 10px;            /* DESIGN.md §5 — chip radius */
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  pointer-events: auto;
  user-select: none;
  transform: translate3d(0, 0, 0);
  transition: transform 80ms cubic-bezier(0.2, 0, 0, 1);  /* DESIGN.md §8 */
  will-change: transform;
}

.chip[data-pinned="true"] {
  outline: 2px solid #d4d4d8;
  outline-offset: 2px;
}

@media (prefers-color-scheme: dark) {
  .chip {
    background: #0e0e10;
    color: #f5f5f7;
    border-color: #26262a;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
  }
  .chip[data-pinned="true"] { outline-color: #3a3a3f; }
}

@media (prefers-reduced-motion: reduce) {
  .chip { transition: none; }
}

.line1 {
  font-weight: 600;
  font-size: 13px;
  line-height: 18px;
  letter-spacing: -0.005em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.line2 {
  margin-top: 4px;
  font-family: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  line-height: 16px;
  color: #6b6b6e;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
@media (prefers-color-scheme: dark) {
  .line2 { color: #a1a1a6; }
}

.fallback {
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  line-height: 16px;
  font-weight: 600;
  color: #7a4a1d;
}
@media (prefers-color-scheme: dark) {
  .fallback { color: #f5d089; }
}

.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f59e0b;
  flex: 0 0 8px;
}
@media (prefers-color-scheme: dark) {
  .dot { background: #f5b840; }
}

.requested {
  margin-top: 2px;
  font-family: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  line-height: 16px;
  color: #6b6b6e;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
@media (prefers-color-scheme: dark) {
  .requested { color: #a1a1a6; }
}

.lowconf {
  margin-top: 2px;
  font-size: 10px;
  line-height: 14px;
  color: #9c9ca0;
  font-style: italic;
}
@media (prefers-color-scheme: dark) {
  .lowconf { color: #6b6b6e; }
}

/* Inspect-mode element outline. Drawn as a fixed-position div the overlay
   moves around the page — never injected into host markup so host CSS
   can't deform it. */
.outline {
  position: absolute;
  top: 0;
  left: 0;
  border: 2px solid #0f0f10;
  border-radius: 4px;
  pointer-events: none;
  transition: transform 60ms cubic-bezier(0.2, 0, 0, 1),
              width 60ms cubic-bezier(0.2, 0, 0, 1),
              height 60ms cubic-bezier(0.2, 0, 0, 1);
}
@media (prefers-color-scheme: dark) {
  .outline { border-color: #f5f5f7; }
}
@media (prefers-reduced-motion: reduce) {
  .outline { transition: none; }
}
```

- [ ] **Step 2: Commit**

```bash
git add content/overlay.css
git commit -m "feat(overlay): chip stylesheet — light/dark, reduced-motion, fallback dot"
```

(No tests in this task — CSS is exercised through the overlay tests starting Task 3.)

---

## Task 3: overlay.js — Shadow DOM mount + teardown

Smallest possible shell: a class that attaches a closed-mode-equivalent (mode: 'open' is fine; nothing piercing it matters because we use `:host` and a unique tag) shadow root to `document.body` (or `documentElement` if body missing), injects the stylesheet, and tears down on demand. We TDD this first because mount/unmount is the riskiest correctness concern and is fully testable in happy-dom.

**Files:**
- Create: `content/overlay.js`
- Test: `content/overlay.test.js`

### Behavior (this task only)

- `new Overlay({ detect, onEmit }).mount()` attaches a shadow host element to `document.body`, or `document.documentElement` if `body` is null.
- The shadow host is a `<fontlens-overlay>` custom element name (no registration needed — just an unknown HTML element, which is legal).
- The shadow root has the CSS string injected via a `<style>` child element.
- `overlay.unmount()` removes the host element. Calling it twice is safe (idempotent).
- `overlay.mount()` is idempotent — calling twice does not stack roots.
- The chip element exists inside the shadow root but is hidden (`display: none`) until the first `show()` call (Task 4).

- [ ] **Step 1: Write the failing tests**

`content/overlay.test.js`:

```js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Overlay } from './overlay.js';

const fakeDetect = vi.fn(() => ({
  requested: ['Inter', 'sans-serif'],
  rendered: 'Inter',
  isFallback: false,
  source: { type: 'self-hosted', format: 'woff2', url: '/x.woff2', os: null },
  isVariable: false,
  axes: null,
  metrics: {
    size: '16px', weight: 400, lineHeight: '24px',
    letterSpacing: 'normal', transform: 'none',
    color: { rgb: 'rgb(34,34,34)', hex: '#222222' },
  },
  confidence: 'high',
}));

let overlay;

beforeEach(() => {
  document.body.innerHTML = '';
  fakeDetect.mockClear();
});

afterEach(() => {
  if (overlay) { overlay.unmount(); overlay = null; }
});

describe('Overlay — mount/unmount', () => {
  it('attaches a single shadow host to document.body', () => {
    overlay = new Overlay({ detect: fakeDetect, onEmit: () => {} });
    overlay.mount();
    const hosts = document.body.querySelectorAll('fontlens-overlay');
    expect(hosts.length).toBe(1);
    expect(hosts[0].shadowRoot).toBeTruthy();
  });

  it('attaches to documentElement when body is missing', () => {
    const body = document.body;
    body.remove();
    overlay = new Overlay({ detect: fakeDetect, onEmit: () => {} });
    overlay.mount();
    const hosts = document.documentElement.querySelectorAll('fontlens-overlay');
    expect(hosts.length).toBe(1);
    document.documentElement.appendChild(body); // restore for next test
  });

  it('mount() is idempotent — calling twice keeps one host', () => {
    overlay = new Overlay({ detect: fakeDetect, onEmit: () => {} });
    overlay.mount();
    overlay.mount();
    expect(document.body.querySelectorAll('fontlens-overlay').length).toBe(1);
  });

  it('unmount() removes the host', () => {
    overlay = new Overlay({ detect: fakeDetect, onEmit: () => {} });
    overlay.mount();
    overlay.unmount();
    expect(document.body.querySelectorAll('fontlens-overlay').length).toBe(0);
  });

  it('unmount() is safe to call twice', () => {
    overlay = new Overlay({ detect: fakeDetect, onEmit: () => {} });
    overlay.mount();
    overlay.unmount();
    expect(() => overlay.unmount()).not.toThrow();
  });

  it('injects a <style> child into the shadow root', () => {
    overlay = new Overlay({ detect: fakeDetect, onEmit: () => {} });
    overlay.mount();
    const host = document.body.querySelector('fontlens-overlay');
    const styles = host.shadowRoot.querySelectorAll('style');
    expect(styles.length).toBeGreaterThanOrEqual(1);
    expect(styles[0].textContent).toContain('.chip');
  });

  it('renders the chip element hidden by default', () => {
    overlay = new Overlay({ detect: fakeDetect, onEmit: () => {} });
    overlay.mount();
    const host = document.body.querySelector('fontlens-overlay');
    const chip = host.shadowRoot.querySelector('.chip');
    expect(chip).toBeTruthy();
    expect(chip.style.display).toBe('none');
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run content/overlay.test.js`
Expected: every test fails — `Overlay is not defined`.

- [ ] **Step 3: Implement `content/overlay.js`**

```js
// content/overlay.js — Shadow-DOM hover chip + inspect outline.
// No chrome.* references — consumers wire messaging.

const STYLE_CSS = `
:host { all: initial; position: fixed; top: 0; left: 0; z-index: 2147483647; pointer-events: none; contain: layout style; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
:host([data-pinned="true"]) { pointer-events: auto; }
.chip { position: absolute; top: 0; left: 0; min-width: 140px; max-width: 280px; padding: 10px 12px; background: #ffffff; color: #0f0f10; border: 1px solid #ececec; border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.18); pointer-events: auto; user-select: none; transform: translate3d(0,0,0); transition: transform 80ms cubic-bezier(0.2, 0, 0, 1); will-change: transform; }
.chip[data-pinned="true"] { outline: 2px solid #d4d4d8; outline-offset: 2px; }
@media (prefers-color-scheme: dark) {
  .chip { background:#0e0e10; color:#f5f5f7; border-color:#26262a; box-shadow:0 8px 24px rgba(0,0,0,0.6); }
  .chip[data-pinned="true"] { outline-color:#3a3a3f; }
}
@media (prefers-reduced-motion: reduce) { .chip, .outline { transition: none; } }
.line1 { font-weight: 600; font-size: 13px; line-height: 18px; letter-spacing: -0.005em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.line2 { margin-top: 4px; font-family: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; line-height: 16px; color: #6b6b6e; font-variant-numeric: tabular-nums; white-space: nowrap; }
@media (prefers-color-scheme: dark) { .line2 { color:#a1a1a6; } }
.fallback { margin-top: 6px; display: flex; align-items: center; gap: 6px; font-size: 11px; line-height: 16px; font-weight: 600; color: #7a4a1d; }
@media (prefers-color-scheme: dark) { .fallback { color:#f5d089; } }
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #f59e0b; flex: 0 0 8px; }
@media (prefers-color-scheme: dark) { .dot { background:#f5b840; } }
.requested { margin-top: 2px; font-family: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; line-height: 16px; color: #6b6b6e; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
@media (prefers-color-scheme: dark) { .requested { color:#a1a1a6; } }
.lowconf { margin-top: 2px; font-size: 10px; line-height: 14px; color: #9c9ca0; font-style: italic; }
@media (prefers-color-scheme: dark) { .lowconf { color:#6b6b6e; } }
.outline { position: absolute; top: 0; left: 0; border: 2px solid #0f0f10; border-radius: 4px; pointer-events: none; transition: transform 60ms cubic-bezier(0.2, 0, 0, 1), width 60ms cubic-bezier(0.2, 0, 0, 1), height 60ms cubic-bezier(0.2, 0, 0, 1); }
@media (prefers-color-scheme: dark) { .outline { border-color:#f5f5f7; } }
`;

export class Overlay {
  constructor({ detect, onEmit } = {}) {
    if (typeof detect !== 'function') throw new Error('Overlay: detect fn required');
    this._detect = detect;
    this._onEmit = typeof onEmit === 'function' ? onEmit : () => {};
    this._host = null;
    this._root = null;
    this._chip = null;
    this._outline = null;
    this._pinned = false;
    this._mode = 'hover';   // 'hover' | 'inspect'
    this._lastDetail = null;
  }

  mount() {
    if (this._host) return; // idempotent

    const parent = document.body || document.documentElement;
    const host = document.createElement('fontlens-overlay');
    const root = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = STYLE_CSS;
    root.appendChild(style);

    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.style.display = 'none';
    root.appendChild(chip);

    const outline = document.createElement('div');
    outline.className = 'outline';
    outline.style.display = 'none';
    root.appendChild(outline);

    parent.appendChild(host);

    this._host = host;
    this._root = root;
    this._chip = chip;
    this._outline = outline;
  }

  unmount() {
    if (!this._host) return;
    this._host.remove();
    this._host = null;
    this._root = null;
    this._chip = null;
    this._outline = null;
    this._pinned = false;
    this._lastDetail = null;
  }
}
```

- [ ] **Step 4: Run to verify the tests pass**

Run: `npx vitest run content/overlay.test.js`
Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add content/overlay.js content/overlay.test.js
git commit -m "feat(overlay): Shadow DOM mount/unmount with isolated stylesheet"
```

---

## Task 4: Chip render — content from a detect() result

The chip renders three regions per spec §8.2 + DESIGN.md §6.1:
- Line 1: `rendered` bold (or `"—"` if rendered is `null`).
- Line 2: `size · weight · lineHeight/size` in mono.
- When `isFallback`: amber dot + "fallback" row, plus `requested: <first family>` row.
- When `confidence === 'low'`: an italic muted "couldn't confirm rendering" row (spec §5.7).

**Files:**
- Modify: `content/overlay.js`
- Modify: `content/overlay.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `content/overlay.test.js`:

```js
describe('Overlay — chip render', () => {
  function mountWith(detectResult) {
    const det = vi.fn(() => detectResult);
    overlay = new Overlay({ detect: det, onEmit: () => {} });
    overlay.mount();
    overlay.show(document.createElement('p'), { x: 100, y: 100 });
    return overlay._chip;
  }

  it('renders rendered face on line 1 (bold)', () => {
    const chip = mountWith({
      requested: ['Inter', 'sans-serif'],
      rendered: 'Inter',
      isFallback: false,
      source: { type: 'self-hosted', format: 'woff2', url: null, os: null },
      isVariable: false, axes: null,
      metrics: { size: '16px', weight: 400, lineHeight: '24px', letterSpacing: 'normal', transform: 'none', color: { rgb: 'rgb(0,0,0)', hex: '#000000' } },
      confidence: 'high',
    });
    expect(chip.style.display).not.toBe('none');
    expect(chip.querySelector('.line1').textContent).toBe('Inter');
  });

  it('renders metrics line 2 as size · weight · lh/size', () => {
    const chip = mountWith({
      requested: ['Inter'], rendered: 'Inter', isFallback: false,
      source: { type: 'self-hosted', format: 'woff2', url: null, os: null },
      isVariable: false, axes: null,
      metrics: { size: '16px', weight: 400, lineHeight: '24px', letterSpacing: 'normal', transform: 'none', color: { rgb: 'rgb(0,0,0)', hex: '#000' } },
      confidence: 'high',
    });
    expect(chip.querySelector('.line2').textContent).toBe('16px · 400 · 24/16');
  });

  it('shows amber dot + fallback + requested rows when isFallback', () => {
    const chip = mountWith({
      requested: ['Söhne', 'Arial', 'sans-serif'],
      rendered: 'Arial', isFallback: true,
      source: { type: 'system', format: null, url: null, os: null },
      isVariable: false, axes: null,
      metrics: { size: '16px', weight: 400, lineHeight: '24px', letterSpacing: 'normal', transform: 'none', color: { rgb: 'rgb(0,0,0)', hex: '#000' } },
      confidence: 'high',
    });
    expect(chip.querySelector('.dot')).toBeTruthy();
    expect(chip.querySelector('.fallback').textContent).toContain('fallback');
    expect(chip.querySelector('.requested').textContent).toBe('requested: Söhne');
  });

  it('hides fallback rows when isFallback is false', () => {
    const chip = mountWith({
      requested: ['Inter'], rendered: 'Inter', isFallback: false,
      source: { type: 'self-hosted', format: 'woff2', url: null, os: null },
      isVariable: false, axes: null,
      metrics: { size: '16px', weight: 400, lineHeight: '24px', letterSpacing: 'normal', transform: 'none', color: { rgb: 'rgb(0,0,0)', hex: '#000' } },
      confidence: 'high',
    });
    expect(chip.querySelector('.fallback')).toBeNull();
    expect(chip.querySelector('.requested')).toBeNull();
  });

  it('shows low-confidence row when confidence === "low"', () => {
    const chip = mountWith({
      requested: ['Inter'], rendered: 'Inter', isFallback: false,
      source: { type: 'self-hosted', format: 'woff2', url: null, os: null },
      isVariable: false, axes: null,
      metrics: { size: '16px', weight: 400, lineHeight: '24px', letterSpacing: 'normal', transform: 'none', color: { rgb: 'rgb(0,0,0)', hex: '#000' } },
      confidence: 'low',
    });
    expect(chip.querySelector('.lowconf').textContent).toContain("couldn't confirm");
  });

  it('renders an em dash when rendered is null', () => {
    const chip = mountWith({
      requested: ['Mystery'], rendered: null, isFallback: false,
      source: { type: 'system', format: null, url: null, os: 'unknown' },
      isVariable: false, axes: null,
      metrics: { size: '16px', weight: 400, lineHeight: '24px', letterSpacing: 'normal', transform: 'none', color: { rgb: 'rgb(0,0,0)', hex: '#000' } },
      confidence: 'low',
    });
    expect(chip.querySelector('.line1').textContent).toBe('—');
  });

  it('hide() hides the chip and clears state', () => {
    const chip = mountWith({
      requested: ['Inter'], rendered: 'Inter', isFallback: false,
      source: { type: 'self-hosted', format: 'woff2', url: null, os: null },
      isVariable: false, axes: null,
      metrics: { size: '16px', weight: 400, lineHeight: '24px', letterSpacing: 'normal', transform: 'none', color: { rgb: 'rgb(0,0,0)', hex: '#000' } },
      confidence: 'high',
    });
    overlay.hide();
    expect(chip.style.display).toBe('none');
  });

  it('does not hide the chip when pinned', () => {
    const chip = mountWith({
      requested: ['Inter'], rendered: 'Inter', isFallback: false,
      source: { type: 'self-hosted', format: 'woff2', url: null, os: null },
      isVariable: false, axes: null,
      metrics: { size: '16px', weight: 400, lineHeight: '24px', letterSpacing: 'normal', transform: 'none', color: { rgb: 'rgb(0,0,0)', hex: '#000' } },
      confidence: 'high',
    });
    overlay.pin();
    overlay.hide();
    expect(chip.style.display).not.toBe('none');
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run content/overlay.test.js`
Expected: new tests fail (`show is not a function`).

- [ ] **Step 3: Extend `content/overlay.js`**

Add these methods to the `Overlay` class (above the closing `}`):

```js
  // ---------- render helpers ----------

  _stripPx(v) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }

  _formatMetrics(m) {
    const size = m.size;                              // "16px"
    const weight = String(m.weight);                  // "400"
    const sizePx = this._stripPx(m.size);
    const lhPx   = this._stripPx(m.lineHeight);
    const lhPart = (sizePx != null && lhPx != null)
      ? `${Math.round(lhPx)}/${Math.round(sizePx)}`
      : (m.lineHeight === 'normal' ? 'normal' : m.lineHeight);
    return `${size} · ${weight} · ${lhPart}`;
  }

  _renderChip(detail) {
    if (!this._chip) return;
    const chip = this._chip;
    chip.replaceChildren();
    chip.style.display = 'block';

    const line1 = document.createElement('div');
    line1.className = 'line1';
    line1.textContent = detail.rendered || '—';
    chip.appendChild(line1);

    const line2 = document.createElement('div');
    line2.className = 'line2';
    line2.textContent = this._formatMetrics(detail.metrics);
    chip.appendChild(line2);

    if (detail.isFallback) {
      const fb = document.createElement('div');
      fb.className = 'fallback';
      const dot = document.createElement('span');
      dot.className = 'dot';
      fb.appendChild(dot);
      const txt = document.createElement('span');
      txt.textContent = 'fallback';
      fb.appendChild(txt);
      chip.appendChild(fb);

      const requested = detail.requested[0] || '';
      if (requested) {
        const r = document.createElement('div');
        r.className = 'requested';
        r.textContent = `requested: ${requested}`;
        chip.appendChild(r);
      }
    }

    if (detail.confidence === 'low') {
      const lc = document.createElement('div');
      lc.className = 'lowconf';
      lc.textContent = "couldn't confirm rendering";
      chip.appendChild(lc);
    }
  }

  // ---------- show / hide / pin ----------

  show(el, cursor) {
    if (!this._host) this.mount();
    if (this._pinned) return;
    const detail = this._detect(el);
    this._lastDetail = { detail, el, cursor };
    this._renderChip(detail);
    this._position(cursor);
  }

  hide() {
    if (this._pinned) return;
    if (!this._chip) return;
    this._chip.style.display = 'none';
  }

  pin() {
    if (!this._lastDetail) return;
    this._pinned = true;
    if (this._host)  this._host.setAttribute('data-pinned', 'true');
    if (this._chip)  this._chip.setAttribute('data-pinned', 'true');
  }

  unpin() {
    this._pinned = false;
    if (this._host)  this._host.removeAttribute('data-pinned');
    if (this._chip)  this._chip.removeAttribute('data-pinned');
  }

  isPinned() { return this._pinned; }

  // ---------- positioning (replaced/expanded in Task 5) ----------

  _position(cursor) {
    if (!this._chip || !cursor) return;
    const offsetX = 14;
    const offsetY = 18;
    const x = Math.round(cursor.x + offsetX);
    const y = Math.round(cursor.y + offsetY);
    this._chip.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }
```

- [ ] **Step 4: Run to verify tests pass**

Run: `npx vitest run content/overlay.test.js`
Expected: original 7 + new 8 = 15 tests pass.

- [ ] **Step 5: Commit**

```bash
git add content/overlay.js content/overlay.test.js
git commit -m "feat(overlay): render chip content (rendered, metrics, fallback, low conf)"
```

---

## Task 5: Cursor follow — viewport-aware positioning + 60Hz rAF throttle

Position math:
- Chip offset from cursor: `+14px x, +18px y` so the cursor never sits on top of it.
- If the chip would clip the right viewport edge, flip horizontally (`cursor.x - chipWidth - 14`).
- If the chip would clip the bottom edge, flip vertically.
- Throttle: at most one render per animation frame on `mousemove`.

We test the math (flip behavior) in happy-dom by setting `getBoundingClientRect` on the chip via spy, since happy-dom doesn't compute real layout. The 60Hz rAF throttle is wired in `content.js` (Task 7) — testable separately there.

**Files:**
- Modify: `content/overlay.js`
- Modify: `content/overlay.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `content/overlay.test.js`:

```js
describe('Overlay — positioning', () => {
  function makeReady(rect) {
    overlay = new Overlay({ detect: fakeDetect, onEmit: () => {} });
    overlay.mount();
    overlay.show(document.createElement('p'), { x: 0, y: 0 });
    // Stub chip layout
    overlay._chip.getBoundingClientRect = () => ({ width: rect.w, height: rect.h, top: 0, left: 0, right: rect.w, bottom: rect.h });
    return overlay._chip;
  }

  it('places chip below-right of cursor by default', () => {
    const chip = makeReady({ w: 180, h: 60 });
    // simulate viewport big enough
    Object.defineProperty(window, 'innerWidth',  { value: 1200, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value:  800, configurable: true });

    overlay.move({ x: 100, y: 100 });
    expect(chip.style.transform).toBe('translate3d(114px, 118px, 0)');
  });

  it('flips left when cursor is near the right edge', () => {
    const chip = makeReady({ w: 200, h: 60 });
    Object.defineProperty(window, 'innerWidth',  { value: 1200, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value:  800, configurable: true });

    overlay.move({ x: 1190, y: 100 });
    // expected x = 1190 - 200 - 14 = 976
    expect(chip.style.transform).toBe('translate3d(976px, 118px, 0)');
  });

  it('flips up when cursor is near the bottom edge', () => {
    const chip = makeReady({ w: 180, h: 80 });
    Object.defineProperty(window, 'innerWidth',  { value: 1200, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value:  800, configurable: true });

    overlay.move({ x: 100, y: 790 });
    // expected y = 790 - 80 - 14 = 696
    expect(chip.style.transform).toBe('translate3d(114px, 696px, 0)');
  });

  it('move() is a no-op when pinned', () => {
    const chip = makeReady({ w: 180, h: 60 });
    overlay.move({ x: 100, y: 100 });
    const before = chip.style.transform;
    overlay.pin();
    overlay.move({ x: 500, y: 500 });
    expect(chip.style.transform).toBe(before);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run content/overlay.test.js`
Expected: new tests fail (`move is not a function`).

- [ ] **Step 3: Replace `_position` and add `move()`**

In `content/overlay.js`, replace the `_position` method from Task 4 with this and add a public `move()`:

```js
  _position(cursor) {
    if (!this._chip || !cursor) return;
    const offsetX = 14;
    const offsetY = 18;
    const rect = this._chip.getBoundingClientRect();
    const vw = (typeof window !== 'undefined' && window.innerWidth)  || 1024;
    const vh = (typeof window !== 'undefined' && window.innerHeight) || 768;

    let x = cursor.x + offsetX;
    let y = cursor.y + offsetY;

    if (x + rect.width > vw) {
      x = cursor.x - rect.width - offsetX;
    }
    if (y + rect.height > vh) {
      y = cursor.y - rect.height - offsetY;
    }
    if (x < 0) x = 0;
    if (y < 0) y = 0;

    this._chip.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
  }

  // Public: update cursor position without re-running detect().
  // content.js calls this on every rAF tick from mousemove.
  move(cursor) {
    if (this._pinned) return;
    if (!this._chip || this._chip.style.display === 'none') return;
    this._position(cursor);
  }
```

- [ ] **Step 4: Run to verify tests pass**

Run: `npx vitest run content/overlay.test.js`
Expected: all 19 tests pass.

- [ ] **Step 5: Commit**

```bash
git add content/overlay.js content/overlay.test.js
git commit -m "feat(overlay): viewport-aware chip position with edge flip"
```

---

## Task 6: Inspect-mode outline + click emission

Inspect mode needs a visible outline on the hovered element so the user knows what they're about to click. We draw it as an absolutely-positioned div inside the shadow root and sync it to the element's bounding box on `move()`. Click in inspect mode emits the element via `onEmit`, **prevents default and stops propagation** (spec §9.4: clicking host elements never triggers host navigation).

Click in hover mode does two things at once: it pins the chip *and* emits the detected row. The chip's pinned state is what the test asserts; the emit shows up via the `onEmit` spy.

**Files:**
- Modify: `content/overlay.js`
- Modify: `content/overlay.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `content/overlay.test.js`:

```js
describe('Overlay — modes + emission', () => {
  it('setMode("inspect") shows the outline and tracks element bounds', () => {
    overlay = new Overlay({ detect: fakeDetect, onEmit: () => {} });
    overlay.mount();
    overlay.setMode('inspect');

    const target = document.createElement('p');
    target.getBoundingClientRect = () => ({ x: 50, y: 60, width: 200, height: 40, top: 60, left: 50, right: 250, bottom: 100 });
    document.body.appendChild(target);

    overlay.highlight(target);

    const outline = overlay._outline;
    expect(outline.style.display).not.toBe('none');
    expect(outline.style.transform).toBe('translate3d(50px, 60px, 0)');
    expect(outline.style.width).toBe('200px');
    expect(outline.style.height).toBe('40px');
  });

  it('setMode("hover") hides the outline', () => {
    overlay = new Overlay({ detect: fakeDetect, onEmit: () => {} });
    overlay.mount();
    overlay.setMode('inspect');
    overlay.highlight(document.createElement('p'));
    overlay.setMode('hover');
    expect(overlay._outline.style.display).toBe('none');
  });

  it('handleClick in hover mode pins chip + emits hover-click event', () => {
    const onEmit = vi.fn();
    overlay = new Overlay({ detect: fakeDetect, onEmit });
    overlay.mount();
    overlay.setMode('hover');
    const el = document.createElement('p');
    overlay.show(el, { x: 100, y: 100 });

    const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
    let prevented = false;
    ev.preventDefault = () => { prevented = true; };
    ev.stopPropagation = () => {};

    overlay.handleClick(el, ev);

    expect(overlay.isPinned()).toBe(true);
    expect(onEmit).toHaveBeenCalledTimes(1);
    expect(onEmit.mock.calls[0][0]).toMatchObject({ kind: 'hover-click' });
    expect(onEmit.mock.calls[0][0].detail.rendered).toBe('Inter');
    expect(prevented).toBe(true);
  });

  it('handleClick in inspect mode emits inspect-click and prevents host navigation', () => {
    const onEmit = vi.fn();
    overlay = new Overlay({ detect: fakeDetect, onEmit });
    overlay.mount();
    overlay.setMode('inspect');
    const el = document.createElement('a');

    let prevented = false, stopped = false;
    const ev = { preventDefault: () => { prevented = true; }, stopPropagation: () => { stopped = true; } };

    overlay.handleClick(el, ev);

    expect(onEmit).toHaveBeenCalledTimes(1);
    expect(onEmit.mock.calls[0][0]).toMatchObject({ kind: 'inspect-click' });
    expect(prevented).toBe(true);
    expect(stopped).toBe(true);
  });

  it('Esc unpins the chip via handleKey', () => {
    overlay = new Overlay({ detect: fakeDetect, onEmit: () => {} });
    overlay.mount();
    overlay.setMode('hover');
    overlay.show(document.createElement('p'), { x: 100, y: 100 });
    overlay.pin();
    expect(overlay.isPinned()).toBe(true);

    overlay.handleKey({ key: 'Escape' });
    expect(overlay.isPinned()).toBe(false);
  });

  it('Esc also exits inspect mode back to hover', () => {
    overlay = new Overlay({ detect: fakeDetect, onEmit: () => {} });
    overlay.mount();
    overlay.setMode('inspect');
    overlay.handleKey({ key: 'Escape' });
    expect(overlay.getMode()).toBe('hover');
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run content/overlay.test.js`
Expected: new tests fail.

- [ ] **Step 3: Extend `content/overlay.js`**

Add these methods to the `Overlay` class:

```js
  // ---------- mode ----------

  setMode(mode) {
    if (mode !== 'hover' && mode !== 'inspect') return;
    this._mode = mode;
    if (mode === 'hover' && this._outline) {
      this._outline.style.display = 'none';
    }
  }

  getMode() { return this._mode; }

  // ---------- outline ----------

  highlight(el) {
    if (!this._outline || !el) return;
    const r = el.getBoundingClientRect();
    this._outline.style.display = 'block';
    this._outline.style.width  = `${Math.round(r.width)}px`;
    this._outline.style.height = `${Math.round(r.height)}px`;
    this._outline.style.transform = `translate3d(${Math.round(r.left)}px, ${Math.round(r.top)}px, 0)`;
  }

  // ---------- input ----------

  handleClick(el, ev) {
    // Stop the host page from navigating in either mode.
    if (ev && typeof ev.preventDefault === 'function')  ev.preventDefault();
    if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();

    if (this._mode === 'inspect') {
      this._onEmit({ kind: 'inspect-click', target: el });
      return;
    }

    // Hover mode: pin + emit the detected row.
    const detail = this._lastDetail?.detail || this._detect(el);
    this.pin();
    this._onEmit({ kind: 'hover-click', target: el, detail });
  }

  handleKey(ev) {
    if (!ev) return;
    if (ev.key === 'Escape') {
      if (this._pinned) { this.unpin(); return; }
      if (this._mode === 'inspect') { this.setMode('hover'); return; }
    }
  }
```

- [ ] **Step 4: Run to verify tests pass**

Run: `npx vitest run content/overlay.test.js`
Expected: 25 tests pass.

- [ ] **Step 5: Commit**

```bash
git add content/overlay.js content/overlay.test.js
git commit -m "feat(overlay): inspect outline, click emission, Esc handling"
```

---

## Task 7: content.js — entry point + 60Hz rAF throttle + message bridge

The content-script entry. Responsibilities:
- Import `detect` from `lib/detector.js` and instantiate `Overlay`.
- Listen for `mousemove` on `window`, throttle to one tick per `requestAnimationFrame`, drive `overlay.show()` / `overlay.move()`.
- Listen for `click` on `window` (capture phase!) and route to `overlay.handleClick()` — capture phase is necessary so we beat host-page handlers and can `preventDefault` on `<a>` clicks etc.
- Listen for `keydown` on `window` and route Esc to `overlay.handleKey()`.
- Listen for `chrome.runtime.onMessage` for `{type: 'fontlens.mode', mode: 'hover'|'inspect'}` and call `overlay.setMode()`. Also `{type: 'fontlens.disable'}` calls `overlay.unmount()` and removes listeners.
- Wrap `chrome.*` calls behind a small adapter (`messaging`) injected at construction so tests can substitute it.

The element under the cursor is found with `document.elementFromPoint(x, y)` — and we must walk up to the closest element that has visible text (text nodes), otherwise the chip shows metrics for a wrapper div the user wasn't looking at.

**Files:**
- Create: `content/content.js`
- Create: `content/content.test.js`

- [ ] **Step 1: Write the failing tests**

`content/content.test.js`:

```js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ContentScript } from './content.js';

const fakeDetect = vi.fn((el) => ({
  requested: ['Inter', 'sans-serif'],
  rendered: 'Inter',
  isFallback: false,
  source: { type: 'self-hosted', format: 'woff2', url: null, os: null },
  isVariable: false, axes: null,
  metrics: { size: '16px', weight: 400, lineHeight: '24px', letterSpacing: 'normal', transform: 'none', color: { rgb: 'rgb(0,0,0)', hex: '#000' } },
  confidence: 'high',
}));

function fakeMessaging() {
  const handlers = [];
  return {
    onMessage(fn) { handlers.push(fn); },
    sendMessage: vi.fn(),
    _emit(msg) { handlers.forEach(h => h(msg)); },
  };
}

let cs;

beforeEach(() => {
  document.body.innerHTML = '';
  fakeDetect.mockClear();
});

afterEach(() => {
  if (cs) { cs.disable(); cs = null; }
});

describe('ContentScript — wiring', () => {
  it('enables hover mode by default and mounts the overlay', () => {
    const msg = fakeMessaging();
    cs = new ContentScript({ detect: fakeDetect, messaging: msg, raf: (fn) => fn(0) });
    cs.enable();
    expect(document.body.querySelector('fontlens-overlay')).toBeTruthy();
    expect(cs.overlay.getMode()).toBe('hover');
  });

  it('disable() unmounts the overlay and removes listeners', () => {
    const msg = fakeMessaging();
    cs = new ContentScript({ detect: fakeDetect, messaging: msg, raf: (fn) => fn(0) });
    cs.enable();
    cs.disable();
    expect(document.body.querySelector('fontlens-overlay')).toBeNull();
  });

  it('switches mode in response to runtime messages', () => {
    const msg = fakeMessaging();
    cs = new ContentScript({ detect: fakeDetect, messaging: msg, raf: (fn) => fn(0) });
    cs.enable();
    msg._emit({ type: 'fontlens.mode', mode: 'inspect' });
    expect(cs.overlay.getMode()).toBe('inspect');
  });

  it('throttles mousemove to one render per animation frame', () => {
    const msg = fakeMessaging();
    const rafCalls = [];
    const raf = (fn) => { rafCalls.push(fn); return rafCalls.length; };
    cs = new ContentScript({ detect: fakeDetect, messaging: msg, raf });
    cs.enable();

    // Make the page have a real text element so elementFromPoint returns it.
    const p = document.createElement('p');
    p.textContent = 'hello';
    document.body.appendChild(p);
    document.elementFromPoint = () => p;

    // Fire 5 mousemoves back-to-back. Only one rAF should be scheduled.
    for (let i = 0; i < 5; i++) {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 10 + i, clientY: 20 }));
    }
    expect(rafCalls.length).toBe(1);

    // Flush the rAF — detect should fire once.
    rafCalls[0](0);
    expect(fakeDetect).toHaveBeenCalledTimes(1);
  });

  it('click on a text element in hover mode emits via messaging', () => {
    const msg = fakeMessaging();
    cs = new ContentScript({ detect: fakeDetect, messaging: msg, raf: (fn) => fn(0) });
    cs.enable();

    const p = document.createElement('p');
    p.textContent = 'hello';
    document.body.appendChild(p);
    document.elementFromPoint = () => p;

    // First show the chip so handleClick has lastDetail.
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 10, clientY: 20 }));
    // The raf in this test runs synchronously (raf: fn => fn(0)).

    const click = new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 10, clientY: 20 });
    window.dispatchEvent(click);

    expect(msg.sendMessage).toHaveBeenCalled();
    const [arg] = msg.sendMessage.mock.calls[0];
    expect(arg.type).toBe('fontlens.row');
    expect(arg.kind).toBe('hover-click');
    expect(arg.detail.rendered).toBe('Inter');
  });

  it('click in inspect mode does not navigate the page (preventDefault)', () => {
    const msg = fakeMessaging();
    cs = new ContentScript({ detect: fakeDetect, messaging: msg, raf: (fn) => fn(0) });
    cs.enable();
    msg._emit({ type: 'fontlens.mode', mode: 'inspect' });

    const a = document.createElement('a');
    a.href = 'https://example.com/';
    a.textContent = 'link';
    document.body.appendChild(a);
    document.elementFromPoint = () => a;

    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    window.dispatchEvent(click);

    expect(click.defaultPrevented).toBe(true);
  });

  it('Esc keydown unpins the chip', () => {
    const msg = fakeMessaging();
    cs = new ContentScript({ detect: fakeDetect, messaging: msg, raf: (fn) => fn(0) });
    cs.enable();
    cs.overlay.pin = vi.fn(cs.overlay.pin.bind(cs.overlay));
    cs.overlay.unpin = vi.fn(cs.overlay.unpin.bind(cs.overlay));

    // Force a pinned state through the public API.
    const p = document.createElement('p');
    p.textContent = 'hi';
    document.body.appendChild(p);
    cs.overlay.show(p, { x: 0, y: 0 });
    cs.overlay.pin();
    expect(cs.overlay.isPinned()).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(cs.overlay.isPinned()).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run content/content.test.js`
Expected: every test fails — `ContentScript` not exported yet.

- [ ] **Step 3: Implement `content/content.js`**

```js
// content/content.js — entry point. Wires Overlay to DOM events + messaging.

import { Overlay } from './overlay.js';

// Walk up until we find an element with at least one visible text node.
// Falls back to the start element to avoid returning null.
function findTextElement(start) {
  let el = start;
  while (el && el.nodeType === 1) {
    for (const child of el.childNodes) {
      if (child.nodeType === 3 && child.nodeValue && child.nodeValue.trim()) {
        return el;
      }
    }
    el = el.parentElement;
  }
  return start;
}

// Default messaging adapter — uses chrome.runtime if available; otherwise no-op.
// Tests pass a fake to bypass chrome.* entirely.
function defaultMessaging() {
  const hasChrome = typeof chrome !== 'undefined' && chrome?.runtime;
  return {
    onMessage(fn) {
      if (!hasChrome) return;
      chrome.runtime.onMessage.addListener(fn);
    },
    sendMessage(msg) {
      if (!hasChrome) return;
      try { chrome.runtime.sendMessage(msg); } catch { /* ignore — SW asleep */ }
    },
  };
}

export class ContentScript {
  constructor({ detect, messaging, raf } = {}) {
    if (typeof detect !== 'function') throw new Error('ContentScript: detect required');
    this._detect = detect;
    this._messaging = messaging || defaultMessaging();
    this._raf = raf || ((fn) => requestAnimationFrame(fn));

    this.overlay = new Overlay({
      detect: this._detect,
      onEmit: (evt) => this._onOverlayEmit(evt),
    });

    this._rafPending = false;
    this._lastCursor = null;
    this._enabled = false;

    // Pre-bind handlers so add/remove pair correctly.
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onClick     = this._onClick.bind(this);
    this._onKeyDown   = this._onKeyDown.bind(this);
    this._onMessage   = this._onMessage.bind(this);
  }

  enable() {
    if (this._enabled) return;
    this.overlay.mount();
    window.addEventListener('mousemove', this._onMouseMove, true);
    window.addEventListener('click',     this._onClick,     true);  // capture
    window.addEventListener('keydown',   this._onKeyDown,   true);
    this._messaging.onMessage(this._onMessage);
    this._enabled = true;
  }

  disable() {
    if (!this._enabled) return;
    window.removeEventListener('mousemove', this._onMouseMove, true);
    window.removeEventListener('click',     this._onClick,     true);
    window.removeEventListener('keydown',   this._onKeyDown,   true);
    this.overlay.unmount();
    this._enabled = false;
  }

  // ---------- input ----------

  _onMouseMove(ev) {
    this._lastCursor = { x: ev.clientX, y: ev.clientY };
    if (this._rafPending) return;
    this._rafPending = true;
    this._raf(() => {
      this._rafPending = false;
      const cursor = this._lastCursor;
      if (!cursor) return;
      const hit = document.elementFromPoint(cursor.x, cursor.y);
      if (!hit) return;
      if (this._isOurOwnUI(hit)) return;
      const el = findTextElement(hit);
      if (this.overlay.getMode() === 'inspect') {
        this.overlay.highlight(el);
      } else {
        this.overlay.show(el, cursor);
      }
    });
  }

  _onClick(ev) {
    if (!this._enabled) return;
    const cursor = { x: ev.clientX, y: ev.clientY };
    const hit = document.elementFromPoint(cursor.x, cursor.y) || ev.target;
    if (this._isOurOwnUI(hit)) return; // don't intercept clicks on our own chip
    const el = findTextElement(hit);
    this.overlay.handleClick(el, ev);
  }

  _onKeyDown(ev) {
    this.overlay.handleKey(ev);
  }

  _onMessage(msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'fontlens.mode' && (msg.mode === 'hover' || msg.mode === 'inspect')) {
      this.overlay.setMode(msg.mode);
    } else if (msg.type === 'fontlens.disable') {
      this.disable();
    }
  }

  _isOurOwnUI(el) {
    if (!el) return false;
    // Anything inside our shadow host should be ignored.
    let node = el;
    while (node) {
      if (node.tagName && node.tagName.toLowerCase() === 'fontlens-overlay') return true;
      node = node.parentNode || node.host || null;
    }
    return false;
  }

  // ---------- emission ----------

  _onOverlayEmit(evt) {
    // evt: { kind: 'hover-click' | 'inspect-click', target, detail? }
    const payload = {
      type: 'fontlens.row',
      kind: evt.kind,
      detail: evt.detail || null,
      // We do NOT serialize the DOM element — Phase 3's walker
      // re-resolves the row from the detail and a stable selector if needed.
    };
    this._messaging.sendMessage(payload);
  }
}

// Auto-boot when loaded as a content script (chrome.scripting.executeScript).
// Suppressed when imported in tests because tests instantiate manually.
if (typeof window !== 'undefined' && typeof globalThis.__FONTLENS_TEST__ === 'undefined') {
  // Lazy-import detect so test files can instantiate ContentScript without
  // loading lib/detector.js (which pulls canvas APIs not in happy-dom).
  import('../lib/detector.js').then(({ detect }) => {
    const cs = new ContentScript({ detect });
    cs.enable();
    // Expose for the service worker to disable on toggle.
    globalThis.__fontlens = cs;
  }).catch((err) => {
    console.error('[FontLens] failed to boot:', err);
  });
}
```

- [ ] **Step 4: Mark test files so auto-boot is suppressed**

Open `content/content.test.js` and at the very top (before imports) add:

```js
globalThis.__FONTLENS_TEST__ = true;
```

And `content/overlay.test.js` at the very top likewise:

```js
globalThis.__FONTLENS_TEST__ = true;
```

This prevents `content.js`'s auto-boot from running during Vitest, since `content.test.js` imports `ContentScript` which loads `content.js`.

- [ ] **Step 5: Run to verify tests pass**

Run: `npx vitest run content/`
Expected: overlay's 25 + content's 7 = 32 content tests pass; Phase 1's tests untouched.

- [ ] **Step 6: Commit**

```bash
git add content/content.js content/content.test.js content/overlay.test.js
git commit -m "feat(content): rAF-throttled mousemove, capture-phase click, message bridge"
```

---

## Task 8: Manual harness page

Vitest tests cover the wiring; the 80ms ease, the actual cursor follow, viewport-edge flipping, reduced-motion behavior, and the visual fidelity of the amber dot can only be honestly checked in a real browser. We build a single harness page that exercises every visual scenario.

The harness reuses the Phase 1 `npm run harness` server (port 5173) — it serves files from `test/harness/`.

**Files:**
- Create: `test/harness/overlay-harness.html`
- Create: `test/harness/overlay-harness.js`

- [ ] **Step 1: Create `test/harness/overlay-harness.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>FontLens — Overlay Harness</title>
  <link rel="stylesheet" href="./fixtures.css">
  <style>
    section.fixture { margin: 24px 0; }
    .demo {
      padding: 24px;
      border: 1px dashed #d4d4d8;
      border-radius: 8px;
      min-height: 80px;
    }
    .controls {
      position: fixed; bottom: 16px; left: 16px;
      background: #fff; border: 1px solid #ececec; border-radius: 8px;
      padding: 8px 12px; font: 12px ui-monospace, Menlo, monospace;
      box-shadow: 0 4px 14px rgba(0,0,0,0.08);
    }
    .controls button { font: inherit; margin-right: 6px; }
    a.live-link { color: #1e6fd8; }
  </style>
</head>
<body>
  <h1>FontLens — Overlay Harness</h1>
  <p>Move your cursor over the text below. The chip should follow with an 80ms ease.
  Click the chip (or any text) to pin. Press Esc to unpin. Use the buttons bottom-left
  to switch between Hover and Inspect modes.</p>

  <section class="fixture">
    <h2>1. Present face — no fallback expected</h2>
    <div class="demo" style="font-family: 'HarnessReal', sans-serif; font-size: 22px;">
      The quick brown fox jumps over the lazy dog.
    </div>
  </section>

  <section class="fixture">
    <h2>2. Missing face — amber dot + "requested: HarnessMissing"</h2>
    <div class="demo" style="font-family: 'HarnessMissing', Arial, sans-serif; font-size: 22px;">
      The quick brown fox jumps over the lazy dog.
    </div>
  </section>

  <section class="fixture">
    <h2>3. System stack — chip names the OS font</h2>
    <div class="demo" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 22px;">
      The quick brown fox jumps over the lazy dog.
    </div>
  </section>

  <section class="fixture">
    <h2>4. Inspect mode + link — click MUST NOT navigate</h2>
    <p>
      Switch to Inspect mode, then click this link:
      <a class="live-link" href="https://example.com/this-should-not-load">don't follow me</a>.
      The URL bar should not change.
    </p>
  </section>

  <section class="fixture">
    <h2>5. Right-edge flip — hover near the right viewport edge</h2>
    <div class="demo" style="text-align: right; font-size: 22px;">
      <span style="font-family: Georgia, serif;">Near the edge — chip should flip left.</span>
    </div>
  </section>

  <section class="fixture">
    <h2>6. Reduced motion — chip should snap, not ease (toggle via OS)</h2>
    <div class="demo" style="font-family: 'HarnessReal', sans-serif; font-size: 22px;">
      Enable "Reduce Motion" in your OS, reload, and verify no transition.
    </div>
  </section>

  <div class="controls">
    Mode: <span id="mode">hover</span>
    &nbsp;
    <button id="m-hover">Hover</button>
    <button id="m-inspect">Inspect</button>
    <button id="disable">Disable overlay</button>
    &nbsp;|&nbsp;
    Last emit: <span id="emit">—</span>
  </div>

  <script type="module" src="./overlay-harness.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `test/harness/overlay-harness.js`**

```js
// Manual overlay harness — boots ContentScript with the real detector but a
// no-op messaging adapter that prints to the on-page status line instead of
// firing chrome.runtime.sendMessage.

globalThis.__FONTLENS_TEST__ = true;  // suppress auto-boot inside content.js

import { detect } from '../../lib/detector.js';
import { ContentScript } from '../../content/content.js';

await document.fonts.ready;

const emitEl = document.getElementById('emit');
const modeEl = document.getElementById('mode');

const messaging = {
  onMessage() { /* nothing to receive in the harness */ },
  sendMessage(msg) {
    emitEl.textContent = `${msg.kind} → ${msg.detail?.rendered ?? '—'}`;
  },
};

const cs = new ContentScript({ detect, messaging });
cs.enable();

document.getElementById('m-hover').addEventListener('click', () => {
  cs.overlay.setMode('hover');
  modeEl.textContent = 'hover';
});
document.getElementById('m-inspect').addEventListener('click', () => {
  cs.overlay.setMode('inspect');
  modeEl.textContent = 'inspect';
});
document.getElementById('disable').addEventListener('click', () => {
  cs.disable();
  modeEl.textContent = 'disabled';
});
```

- [ ] **Step 3: Manual check**

Run `npm run harness` (from Phase 1 — serves `test/harness/` on port 5173) then open `http://localhost:5173/overlay-harness.html`.

Verify each fixture visually:

1. **Present face:** chip shows "HarnessReal" (or Inter, whichever the test fixture font registers as), no amber dot.
2. **Missing face:** amber dot, "fallback" text, "requested: HarnessMissing" row visible.
3. **System stack:** line 1 shows "San Francisco" on macOS, "Segoe UI" on Windows, etc.
4. **Inspect + link:** switch to Inspect mode using the bottom-left button. Click the link. The URL bar **does not change**. The status line shows `inspect-click → null`.
5. **Right-edge flip:** hover near the right edge of the viewport. The chip flips to the left of the cursor instead of clipping.
6. **Reduced motion:** enable system Reduce Motion preference, reload — chip transform should jump, not ease.

Also do a quick cursor-follow feel test: move the mouse smoothly across body text. The chip should feel attached but not jittery — that's the 80ms ease working.

If any check fails, do not commit. Investigate the relevant module.

- [ ] **Step 4: Commit**

```bash
git add test/harness/overlay-harness.html test/harness/overlay-harness.js
git commit -m "test(overlay): manual cursor-follow harness with 6 visual scenarios"
```

---

## Task 9: Sanity check against a real-world site

The harness is controlled; real sites are not. We re-verify the overlay survives Stripe-grade complex pages.

- [ ] **Step 1: Build a minimal "load this on any page" snippet**

Create a Chrome DevTools snippet (Sources → Snippets → New) and paste:

```js
(async () => {
  // Use a same-origin importable URL by stitching the modules — or, in the
  // simpler harness path, just paste the *contents* of:
  //   lib/parse-stack.js
  //   lib/source-classify.js
  //   lib/render-detect.js
  //   lib/detector.js
  //   content/overlay.js
  //   content/content.js
  // into one IIFE that ends with:
  globalThis.__FONTLENS_TEST__ = true;
  const cs = new ContentScript({ detect });
  cs.enable();
  console.log('[FontLens] overlay live on', location.host);
})();
```

(This is identical pattern to Phase 1 Task 8's sanity-check approach — paste the engine into a snippet because cross-origin module imports are blocked.)

- [ ] **Step 2: Run on three real sites**

For each site, move the cursor over body text and a headline, then click an `<a>` in inspect mode:

| Site | Expected |
|------|----------|
| `https://stripe.com` | Sohne family (self-hosted), no fallback on most text |
| `https://en.wikipedia.org/wiki/Typography` | mixed system stack — chip shows OS-friendly name |
| `https://www.nytimes.com` | serif self-hosted face; clicking a story link in inspect mode does not navigate |

- [ ] **Step 3: No commit needed for the sanity check** — it's a manual verification.

If something looks wrong on a real site, file a note in `docs/notes/phase2-real-world.md` and fix before closing Phase 2.

---

## Task 10: Phase 2 closeout

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```

Expected: Phase 1's tests (≥47) plus Phase 2's content tests (32) all pass. Total ≥79.

- [ ] **Step 2: Push to GitHub**

```bash
git push origin main
```

- [ ] **Step 3: Tag the milestone**

```bash
git tag -a phase2-overlay -m "Phase 2: Shadow DOM overlay + hover chip"
git push origin phase2-overlay
```

- [ ] **Step 4: Move to Phase 3**

When ready, request the Phase 3 plan ("Side panel + extraction"). It picks up `content/content.js`'s `fontlens.row` message as the input event and renders family-grouped style cards.

---

## Acceptance criteria (gate for Phase 3)

Phase 2 is done when ALL of these are true:

- [ ] `npm test` passes with zero failures (≥79 tests).
- [ ] `test/harness/overlay-harness.html` shows all 6 visual scenarios behaving correctly in a real Chrome.
- [ ] On stripe.com, wikipedia.org, and nytimes.com, the overlay loads and the chip follows the cursor without console errors.
- [ ] In inspect mode, clicking an `<a>` does not navigate the host page (verified on at least one real site).
- [ ] The chip is rendered inside a Shadow DOM — `document.body.querySelector('fontlens-overlay').shadowRoot` is non-null.
- [ ] The chip transitions are disabled when `prefers-reduced-motion: reduce` is set (verified by toggling the OS pref).
- [ ] `content/overlay.js` and `content/content.js` contain zero `chrome.*` references outside the `defaultMessaging` adapter.
- [ ] `git tag phase2-overlay` is pushed.

---

## Notes for the implementer

- **Shadow DOM is non-negotiable.** Host-page CSS using `*` selectors or `!important` will deform any unprotected UI. Even our `z-index: 2147483647` is meaningless without the shadow boundary. Do not switch to a plain `<div>` "to debug".
- **Capture-phase click is non-negotiable.** Bubble-phase listeners run after the host's, which means `preventDefault` arrives too late on `<a>` navigation. The test `click on link does not navigate` exists to catch any regression here.
- **rAF throttle is not a `setTimeout`.** Using `requestAnimationFrame` synchronizes with the browser's repaint and is what the spec §11 calls for. The injected `raf` parameter in `ContentScript` lets tests run the callback synchronously without a real frame.
- **`document.elementFromPoint` returns the *topmost* element.** When the user moves over text inside a `<span>` inside a `<p>`, you'll get the `<span>` — that's fine, `findTextElement` walks up until it finds one with text nodes. Don't change that without a test.
- **Two state machines exist.** `overlay._mode` (hover|inspect) and `overlay._pinned` (true|false). Pinning only applies in hover mode. Switching to inspect does not unpin — pinned hover state is preserved so the user can switch modes and come back. Esc handles whichever is active.
- **The `onEmit` payload deliberately includes the live DOM `target`.** That element is *not* serialized over `chrome.runtime.sendMessage` (you can't post DOM nodes through `postMessage`-style channels). Phase 3 will receive the `detail` (already a plain object) and reconstruct everything it needs from there.
- **Don't add features.** Iframe walking is Phase 5. Live extraction is Phase 3. Variable-font axis chips on the hover chip itself? No — DESIGN.md §8.2 explicitly keeps the chip lean. Resist.
- **Auto-boot via `__FONTLENS_TEST__`.** The flag is a deliberately ugly name so nobody mistakes it for a real public API. It exists solely so Vitest can import `content.js` without booting the overlay against happy-dom's incomplete environment.
