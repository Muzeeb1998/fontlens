# Phase 5 — Edge Cases + Onboarding

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make FontLens behave honestly on the messy real web — same-origin iframes, open Shadow DOM, oversized pages, blank tabs, service-worker cold-wake, CSP-blocked canvas — and ship the first-install onboarding that puts the wedge (the fallback signal) in the user's eyes inside ten seconds.

**Architecture:** This phase touches three surfaces. The `content/extractor.js` walker (built in Phase 3) is extended to descend into accessible iframes and open shadow roots, with footnote-emitting counters for the inaccessible cases. The `sidepanel/panel.js` (Phase 3/4) gains an empty-state renderer, a footnote strip, and a focus-driven re-request loop that survives service-worker naps. The `service-worker.js` (Phase 2) grows a `chrome.runtime.onInstalled` listener for the `install`-only branch. A brand-new `onboarding/demo.html` page intentionally requests one missing and one loading face, hosts the confirmation copy, and wires the "Try it on your favorite site" exit.

**Tech Stack:** Same as prior phases — vanilla JS ES modules, Vitest with happy-dom for unit tests, no build step. Chrome ≥ 116 (Side Panel API) for manual testing. No new runtime dependencies.

**Spec sections this implements:**
- `docs/specs/launch1-design.md` §9 (Onboarding)
- `docs/specs/launch1-design.md` §10 (Edge Cases)
- `docs/specs/launch1-design.md` §11 (Performance Guards)

**Depends on:**
- Phase 1 — `lib/detector.js`, `lib/roles.js` (must exist, must pass tests).
- Phase 2 — `service-worker.js`, `content/content.js`, `content/overlay.js`. Phase 5 assumes the toolbar-click path that opens the side panel + enables Hover already works.
- Phase 3 — `content/extractor.js` with the base `extract(root)` walk and 5000-node cap; `sidepanel/panel.js` with family-card rendering and a footnote/`<aside>` slot.
- Phase 4 — Confidence-tag badge styling in `sidepanel/panel.css`. Phase 5 confirms it works against real CSP-strict sites but does not introduce new visual tokens.

---

## File Structure

```
fontlens/
├── service-worker.js                  [Task 6 — modify]
├── content/
│   ├── content.js                     [Task 4 — modify]
│   └── extractor.js                   [Task 2, 3 — modify]
├── sidepanel/
│   ├── panel.html                     [Task 5 — modify]
│   ├── panel.js                       [Task 4, 5 — modify]
│   └── panel.css                      [Task 5 — modify]
├── onboarding/
│   ├── demo.html                      [Task 7 — create]
│   ├── demo.css                       [Task 7 — create]
│   └── demo.js                        [Task 7 — create]
├── lib/
│   ├── extractor-iframes.js           [Task 2 — create]
│   ├── extractor-iframes.test.js      [Task 2 — create]
│   ├── extractor-shadow.js            [Task 3 — create]
│   ├── extractor-shadow.test.js       [Task 3 — create]
│   ├── install.js                     [Task 6 — create]
│   └── install.test.js                [Task 6 — create]
└── test/
    └── harness/
        ├── iframes.html               [Task 8 — create]
        ├── shadow.html                [Task 8 — create]
        └── csp-strict.md              [Task 8 — create — manual checklist]
```

Boundaries:
- `lib/extractor-iframes.js` and `lib/extractor-shadow.js` are pure helper modules: given a `Document` or element, they return arrays of additional roots to walk plus counters for what was skipped. They never touch panel state, never message the service worker, and never read `chrome.*` APIs.
- `content/extractor.js` *composes* those helpers into the existing `extract()` orchestrator built in Phase 3.
- `lib/install.js` is pure logic that returns the side effects to perform on install (open tab URL, open side panel); the actual `chrome.tabs.create` / `chrome.sidePanel.open` calls live in `service-worker.js` and read this module's verdict. This lets us unit-test the install branching without stubbing the full `chrome` namespace.
- `onboarding/` is shipped as static assets — no module imports from the rest of the extension. The demo page is intentionally self-contained so deleting it can never break the extension.

---

## Task 1: Phase 5 scaffold

**Goal:** Create empty module files and verify the existing test suite still runs green before any logic lands.

**Files:**
- Create: `lib/extractor-iframes.js` (empty export)
- Create: `lib/extractor-shadow.js` (empty export)
- Create: `lib/install.js` (empty export)
- Modify: nothing else

- [ ] **Step 1: Create placeholder modules**

`lib/extractor-iframes.js`:

```js
// Phase 5, Task 2 — same-origin iframe traversal helpers.
// Empty stub. Real exports land in Task 2.
export {};
```

`lib/extractor-shadow.js`:

```js
// Phase 5, Task 3 — open shadow-root traversal helpers.
// Empty stub. Real exports land in Task 3.
export {};
```

`lib/install.js`:

```js
// Phase 5, Task 6 — first-install verdict (open demo tab + side panel).
// Empty stub. Real exports land in Task 6.
export {};
```

- [ ] **Step 2: Verify the prior suite still passes**

```bash
npm test
```

Expected: every existing test (Phase 1 + Phase 3 + Phase 4) passes. No new tests added yet — this confirms the stubs don't accidentally break something via a side effect.

- [ ] **Step 3: Commit**

```bash
git add lib/extractor-iframes.js lib/extractor-shadow.js lib/install.js
git commit -m "chore(phase5): scaffold edge-case + onboarding modules"
```

---

## Task 2: Same-origin iframe traversal

**Goal:** Given a root `Document`, return every accessible iframe sub-document for the extractor to walk, plus a count of cross-origin frames that must be surfaced as a placeholder card.

**Why a separate module:** isolating same-origin policy logic in one file makes the failure mode obvious — a cross-origin throw is caught in exactly one place and converted to a counter increment. No silent swallows scattered through the walker.

**Files:**
- Create: `lib/extractor-iframes.js`
- Create: `lib/extractor-iframes.test.js`

### Behavior

```js
collectFrames(rootDoc): {
  accessible: Array<{ doc: Document, host: string }>,
  blockedCount: number,
}
```

- Iterate `rootDoc.querySelectorAll('iframe, frame')`.
- For each frame, try to read `frame.contentDocument`. If it throws (SecurityError), or if `contentDocument` is `null`, increment `blockedCount`.
- If accessible, push `{ doc: contentDocument, host: hostFromFrame(frame) }`. The host is taken from the iframe's `src` attribute when present (so the panel can label "rows from stripe.com inside notion.so"), otherwise from `contentDocument.location.host`, otherwise the literal string `'(same-origin)'`.
- Recurse: an accessible frame may itself contain frames. Cap recursion depth at 4 to defend against frame-bombs.
- Return one flat list (with depth applied transparently) so the caller doesn't need to know the tree shape.

### Tests to write first

- [ ] **Step 1: Write the failing tests**

`lib/extractor-iframes.test.js`:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { collectFrames } from './extractor-iframes.js';

function makeIframe({ src, contentHtml = '<p>hi</p>', blocked = false } = {}) {
  const f = document.createElement('iframe');
  if (src) f.setAttribute('src', src);
  document.body.appendChild(f);
  // happy-dom gives us a contentDocument we can populate.
  if (blocked) {
    Object.defineProperty(f, 'contentDocument', {
      get() { throw new Error('SecurityError: cross-origin'); },
      configurable: true,
    });
  } else {
    f.contentDocument.body.innerHTML = contentHtml;
  }
  return f;
}

beforeEach(() => { document.body.innerHTML = ''; });

describe('collectFrames', () => {
  it('returns empty arrays when there are no frames', () => {
    const r = collectFrames(document);
    expect(r.accessible).toEqual([]);
    expect(r.blockedCount).toBe(0);
  });

  it('collects one same-origin iframe', () => {
    makeIframe({ src: 'https://example.com/about', contentHtml: '<p>x</p>' });
    const r = collectFrames(document);
    expect(r.accessible).toHaveLength(1);
    expect(r.accessible[0].host).toBe('example.com');
    expect(r.blockedCount).toBe(0);
  });

  it('counts a cross-origin iframe as blocked', () => {
    makeIframe({ src: 'https://evil.example.com', blocked: true });
    const r = collectFrames(document);
    expect(r.accessible).toEqual([]);
    expect(r.blockedCount).toBe(1);
  });

  it('mixes accessible and blocked', () => {
    makeIframe({ src: 'https://example.com/a' });
    makeIframe({ src: 'https://other.example.com', blocked: true });
    makeIframe({ src: 'https://example.com/b' });
    const r = collectFrames(document);
    expect(r.accessible).toHaveLength(2);
    expect(r.blockedCount).toBe(1);
  });

  it('falls back to (same-origin) when src is missing', () => {
    makeIframe({ src: null });
    const r = collectFrames(document);
    expect(r.accessible[0].host).toMatch(/same-origin|localhost|^$/);
  });

  it('recurses into nested same-origin iframes', () => {
    const outer = makeIframe({ src: 'https://example.com/outer' });
    const inner = outer.contentDocument.createElement('iframe');
    inner.setAttribute('src', 'https://example.com/inner');
    outer.contentDocument.body.appendChild(inner);
    inner.contentDocument.body.innerHTML = '<p>nested</p>';
    const r = collectFrames(document);
    expect(r.accessible.map(a => a.host)).toContain('example.com');
    expect(r.accessible.length).toBe(2);
  });

  it('caps recursion depth at 4', () => {
    // Build a 6-deep chain; only 4 should be reported.
    let cur = document;
    for (let i = 0; i < 6; i++) {
      const f = cur.createElement('iframe');
      f.setAttribute('src', `https://example.com/${i}`);
      cur.body.appendChild(f);
      f.contentDocument.body.innerHTML = '<p>depth ' + i + '</p>';
      cur = f.contentDocument;
    }
    const r = collectFrames(document);
    expect(r.accessible.length).toBeLessThanOrEqual(4);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run lib/extractor-iframes.test.js
```

Expected: every assertion fails (`collectFrames is not a function`).

- [ ] **Step 3: Write the implementation**

`lib/extractor-iframes.js`:

```js
const MAX_DEPTH = 4;

function hostFromFrame(frame, doc) {
  const src = frame.getAttribute && frame.getAttribute('src');
  if (src) {
    try { return new URL(src, doc.location?.href || 'https://example.com/').host; }
    catch { /* fall through */ }
  }
  try {
    const h = doc.location?.host;
    if (h) return h;
  } catch { /* fall through */ }
  return '(same-origin)';
}

function safeContentDocument(frame) {
  try { return frame.contentDocument; }
  catch { return null; }
}

function walk(rootDoc, depth, out) {
  if (depth > MAX_DEPTH) return;
  const frames = rootDoc.querySelectorAll('iframe, frame');
  for (const frame of frames) {
    const cd = safeContentDocument(frame);
    if (!cd) {
      out.blockedCount++;
      continue;
    }
    const host = hostFromFrame(frame, cd);
    out.accessible.push({ doc: cd, host });
    walk(cd, depth + 1, out);
  }
}

export function collectFrames(rootDoc) {
  const out = { accessible: [], blockedCount: 0 };
  walk(rootDoc, 1, out);
  return out;
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npx vitest run lib/extractor-iframes.test.js
```

Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/extractor-iframes.js lib/extractor-iframes.test.js
git commit -m "feat(extractor): walk same-origin iframes, count cross-origin blocks"
```

---

## Task 3: Open shadow-root traversal

**Goal:** Given an element, return its open `shadowRoot` (and recursively descend into its descendant elements' open shadow roots), plus a count of any closed shadow trees we couldn't enter.

**Why a separate module:** closed-shadow detection is invisibly hard — `el.shadowRoot` returns `null` for both "no shadow root" and "shadow root exists but is closed." The only reliable signal is component metadata or `Element.attachShadow` patches. We do not attempt cleverness — we count nothing in unit-test reality and rely on the optional `__closedShadowCount` heuristic surfaced in Task 4.

**Files:**
- Create: `lib/extractor-shadow.js`
- Create: `lib/extractor-shadow.test.js`

### Behavior

```js
collectShadowRoots(rootEl): {
  roots: ShadowRoot[],
  closedCount: number,    // best-effort, see Task 4 note
}
```

- Walk `rootEl.querySelectorAll('*')` and check `el.shadowRoot`.
- When `el.shadowRoot` is truthy AND `el.shadowRoot.mode === 'open'`, push it into `roots`. Then recurse into that root.
- When `el.shadowRoot` is `null` but the element is a known custom element (tag contains `-`) AND a Phase-4-installed marker `el.__fontlensClosedShadow === true` is set, increment `closedCount`. The marker is set by an optional `Element.prototype.attachShadow` patch documented in Task 4 — without the patch the count stays at 0, which is honest.
- Recursion is depth-first, cap at 32 levels.

### Tests to write first

- [ ] **Step 1: Write the failing tests**

`lib/extractor-shadow.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { collectShadowRoots } from './extractor-shadow.js';

beforeEach(() => { document.body.innerHTML = ''; });

describe('collectShadowRoots', () => {
  it('returns no roots for a plain DOM tree', () => {
    document.body.innerHTML = '<div><p>x</p></div>';
    const r = collectShadowRoots(document.body);
    expect(r.roots).toEqual([]);
    expect(r.closedCount).toBe(0);
  });

  it('collects one open shadow root', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const sh = host.attachShadow({ mode: 'open' });
    sh.innerHTML = '<span>shadowed</span>';
    const r = collectShadowRoots(document.body);
    expect(r.roots).toHaveLength(1);
    expect(r.roots[0]).toBe(sh);
  });

  it('descends into nested open shadow roots', () => {
    const outer = document.createElement('div');
    document.body.appendChild(outer);
    const outerSh = outer.attachShadow({ mode: 'open' });
    const inner = outerSh.ownerDocument.createElement('div');
    outerSh.appendChild(inner);
    const innerSh = inner.attachShadow({ mode: 'open' });
    innerSh.innerHTML = '<p>deep</p>';
    const r = collectShadowRoots(document.body);
    expect(r.roots).toHaveLength(2);
  });

  it('counts the closed-shadow marker when present', () => {
    const host = document.createElement('my-widget');
    host.__fontlensClosedShadow = true;
    document.body.appendChild(host);
    const r = collectShadowRoots(document.body);
    expect(r.closedCount).toBe(1);
  });

  it('does not count a plain custom element with no shadow as closed', () => {
    const host = document.createElement('my-widget');
    document.body.appendChild(host);
    const r = collectShadowRoots(document.body);
    expect(r.closedCount).toBe(0);
  });

  it('honors depth cap', () => {
    // Build a 40-deep chain of shadow hosts.
    let cur = document.body;
    for (let i = 0; i < 40; i++) {
      const host = cur.ownerDocument.createElement('div');
      cur.appendChild(host);
      const sh = host.attachShadow({ mode: 'open' });
      cur = sh;
    }
    const r = collectShadowRoots(document.body);
    expect(r.roots.length).toBeLessThanOrEqual(32);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run lib/extractor-shadow.test.js
```

Expected: failures.

- [ ] **Step 3: Write the implementation**

`lib/extractor-shadow.js`:

```js
const MAX_DEPTH = 32;

function isCustomElement(el) {
  const tag = el.tagName;
  return typeof tag === 'string' && tag.includes('-');
}

function walk(root, depth, out) {
  if (depth > MAX_DEPTH) return;
  // querySelectorAll on a ShadowRoot walks its own subtree, not the host doc.
  const els = root.querySelectorAll('*');
  for (const el of els) {
    if (el.shadowRoot && el.shadowRoot.mode === 'open') {
      out.roots.push(el.shadowRoot);
      walk(el.shadowRoot, depth + 1, out);
      continue;
    }
    if (!el.shadowRoot && isCustomElement(el) && el.__fontlensClosedShadow === true) {
      out.closedCount++;
    }
  }
}

export function collectShadowRoots(rootEl) {
  const out = { roots: [], closedCount: 0 };
  walk(rootEl, 1, out);
  return out;
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npx vitest run lib/extractor-shadow.test.js
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/extractor-shadow.js lib/extractor-shadow.test.js
git commit -m "feat(extractor): walk open shadow roots, count closed ones"
```

---

## Task 4: Wire iframes + shadow + caps into the extractor

**Goal:** Compose Tasks 2 and 3 into the existing `content/extractor.js` so a single `extract()` call returns one flat result that includes iframe and shadow rows tagged by host, with footnote payloads for blocked counts and the 5000-node cap.

**Files:**
- Modify: `content/extractor.js` (added in Phase 3)
- Modify: `content/content.js` (added in Phase 2) — install the optional `attachShadow` patch
- Test indirectly via `lib/extractor-iframes.test.js` + `lib/extractor-shadow.test.js` (already green) and a new integration test below.

### Output shape (additions to the Phase 3 shape)

The existing `extract()` already returns `{ groups: [...] }`. We add a `footnotes` array:

```js
{
  groups: [ /* family-grouped style cards, unchanged */ ],
  footnotes: {
    truncated: boolean,           // true when the 5000-node cap was hit
    blockedFrames: number,        // cross-origin iframes counted
    closedShadows: number,        // closed shadow trees counted (best-effort)
    host: string,                 // the top-level host
  }
}
```

Each row inside a group carries a `frame` field (null for the top frame, the iframe's host otherwise).

### Steps

- [ ] **Step 1: Read the current `content/extractor.js`**

Confirm Phase 3 exposes:

```js
export function extract(rootEl, { maxNodes = 5000 } = {}) { /* … */ }
```

If the existing signature differs, adapt the integration but keep the new `footnotes` field shape.

- [ ] **Step 2: Add an integration test**

Create `lib/extract-integration.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { extract } from '../content/extractor.js';

beforeEach(() => { document.body.innerHTML = ''; });

describe('extract — edge cases', () => {
  it('reports truncated:true when the 5000-node cap fires', () => {
    // Build 5100 text-bearing elements.
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 5100; i++) {
      const p = document.createElement('p');
      p.textContent = `n${i}`;
      frag.appendChild(p);
    }
    document.body.appendChild(frag);

    const r = extract(document.body, { maxNodes: 5000 });
    expect(r.footnotes.truncated).toBe(true);
  });

  it('reports blockedFrames count', () => {
    const f = document.createElement('iframe');
    document.body.appendChild(f);
    Object.defineProperty(f, 'contentDocument', {
      get() { throw new Error('SecurityError'); },
      configurable: true,
    });
    const r = extract(document.body);
    expect(r.footnotes.blockedFrames).toBe(1);
  });

  it('includes rows from open shadow roots', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const sh = host.attachShadow({ mode: 'open' });
    sh.innerHTML = '<p style="font-family: Arial; font-size: 16px;">shadowed text</p>';
    const r = extract(document.body);
    const allRows = r.groups.flatMap(g => g.rows || []);
    expect(allRows.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty groups and the empty-state flag for a blank root', () => {
    // No text nodes at all.
    const r = extract(document.body);
    expect(r.groups).toEqual([]);
    // footnotes still populated, just zeroed.
    expect(r.footnotes.truncated).toBe(false);
  });
});
```

- [ ] **Step 3: Modify `content/extractor.js`**

Import the new helpers and weave them into the walk:

```js
import { collectFrames } from '../lib/extractor-iframes.js';
import { collectShadowRoots } from '../lib/extractor-shadow.js';
// (existing imports — detect, inferRole, styleKey — unchanged)

const MAX_NODES = 5000;

export function extract(rootEl, { maxNodes = MAX_NODES } = {}) {
  const seen = new Map();
  let count = 0;
  let truncated = false;

  const topDoc = rootEl.ownerDocument || rootEl;
  const topHost = (topDoc.location && topDoc.location.host) || '';

  const frames = collectFrames(topDoc);
  const shadows = collectShadowRoots(rootEl);

  // Build the list of "roots to walk": top, then each accessible frame's body,
  // then each open shadow root. Each carries a label so we can attach `frame`
  // to its rows.
  const roots = [{ root: rootEl, frame: null }];
  for (const f of frames.accessible) roots.push({ root: f.doc.body || f.doc.documentElement, frame: f.host });
  for (const sh of shadows.roots) roots.push({ root: sh, frame: null });

  for (const { root, frame } of roots) {
    if (truncated) break;
    const els = root.querySelectorAll('*');
    for (const node of els) {
      if (++count > maxNodes) { truncated = true; break; }
      if (!hasVisibleText(node)) continue;
      const d = detect(node);
      const key = styleKey(d.metrics, d.rendered);
      if (!seen.has(key)) {
        seen.set(key, {
          detail: d,
          count: 0,
          nodes: [],
          role: inferRole(node, d.metrics),
          frame,
        });
      }
      const entry = seen.get(key);
      entry.count++;
      entry.nodes.push(node);
    }
  }

  const rows = [...seen.values()].sort((a, b) => b.count - a.count);
  const groups = groupByFamily(rows); // Phase-3 helper, untouched

  return {
    groups,
    footnotes: {
      truncated,
      blockedFrames: frames.blockedCount,
      closedShadows: shadows.closedCount,
      host: topHost,
    },
  };
}
```

`hasVisibleText`, `styleKey`, and `groupByFamily` are Phase-3 internals — re-use whatever names that phase chose. If Phase 3 used different names, swap them in.

- [ ] **Step 4: Install the optional `attachShadow` marker in `content/content.js`**

Closed shadow roots are otherwise invisible. By patching `Element.prototype.attachShadow` early in the content-script lifetime, we can flag any element that later attaches a closed root so `collectShadowRoots` can count it. The patch is opt-in via a flag — if it ever causes site breakage we disable it from the options page.

Add to `content/content.js` (near the top of the file, before any extractor call):

```js
(function installClosedShadowMarker() {
  if (window.__fontlensClosedShadowMarkerInstalled) return;
  window.__fontlensClosedShadowMarkerInstalled = true;
  try {
    const orig = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (init) {
      const sh = orig.apply(this, arguments);
      if (init && init.mode === 'closed') {
        this.__fontlensClosedShadow = true;
      }
      return sh;
    };
  } catch {
    // If anything throws (CSP-locked-down env, frozen prototypes), give up
    // silently — closedCount will read 0, which is honest.
  }
})();
```

- [ ] **Step 5: Run the new integration test**

```bash
npx vitest run lib/extract-integration.test.js
```

Expected: 4 tests pass.

- [ ] **Step 6: Run the full suite to confirm no regression**

```bash
npm test
```

Expected: all Phase 1–4 tests still pass alongside the new tests.

- [ ] **Step 7: Commit**

```bash
git add content/extractor.js content/content.js lib/extract-integration.test.js
git commit -m "feat(extractor): compose iframe/shadow walkers + emit footnotes"
```

---

## Task 5: Panel — empty state, footnotes, cross-origin placeholder

**Goal:** Render the four new panel UI affordances from §10:

1. Empty state when `groups.length === 0`.
2. Footnote strip below the cards: "Showing styles from the first 5000 text nodes." when truncated.
3. Cross-origin placeholder *card* (not just footnote): "N frames couldn't be inspected (cross-origin)."
4. Closed-shadow footnote: "N nodes in closed shadow trees were skipped."

The page-level fallback banner (§8.3) already exists from Phase 4 — this task does not touch it.

**Files:**
- Modify: `sidepanel/panel.html`
- Modify: `sidepanel/panel.js`
- Modify: `sidepanel/panel.css`

### Visual specs (per `DESIGN.md`)

- **Empty state:** centered block, `--fg-muted`, `--t-base`. Copy: "Navigate to a page with text and try again." Single line. Padding `var(--s-8)` top/bottom.
- **Footnote strip:** below the last card, before the page footer. `--fg-faint`, `--t-sm`, mono. Each footnote is its own line. No bullet.
- **Cross-origin placeholder card:** uses standard family-card shell (`--border`, radius 8), but with `--bg-muted` background and no badge color. Header reads exactly `N frame(s) couldn't be inspected (cross-origin)`. Singular when N=1. No inner rows. No copy buttons.

### Steps

- [ ] **Step 1: Add the slots to `panel.html`**

Inside the main region (`<main id="panel-body">`), append these slots in order:

```html
<section id="empty-state" hidden>
  <p>Navigate to a page with text and try again.</p>
</section>

<section id="placeholder-card" hidden class="placeholder-card" role="note" aria-live="polite">
  <!-- populated by panel.js -->
</section>

<aside id="footnotes" class="footnotes" hidden></aside>
```

- [ ] **Step 2: Render logic in `panel.js`**

Where the panel currently consumes the extractor result (`render(extractResult)` or similar from Phase 3), add:

```js
function renderEdgeCaseUI(result) {
  const { groups, footnotes } = result;

  const empty = document.getElementById('empty-state');
  empty.hidden = !(groups.length === 0 && footnotes.blockedFrames === 0);

  const placeholder = document.getElementById('placeholder-card');
  if (footnotes.blockedFrames > 0) {
    placeholder.hidden = false;
    const n = footnotes.blockedFrames;
    placeholder.innerHTML = `
      <header class="fam-head">
        <span class="fam-name">${n} frame${n === 1 ? '' : 's'} couldn't be inspected (cross-origin)</span>
      </header>`;
  } else {
    placeholder.hidden = true;
    placeholder.innerHTML = '';
  }

  const fn = document.getElementById('footnotes');
  const lines = [];
  if (footnotes.truncated) {
    lines.push('Showing styles from the first 5000 text nodes.');
  }
  if (footnotes.closedShadows > 0) {
    const n = footnotes.closedShadows;
    lines.push(`${n} node${n === 1 ? '' : 's'} in closed shadow tree${n === 1 ? '' : 's'} were skipped.`);
  }
  if (lines.length === 0) {
    fn.hidden = true;
    fn.innerHTML = '';
  } else {
    fn.hidden = false;
    fn.innerHTML = lines.map(l => `<p>${l}</p>`).join('');
  }
}
```

Call `renderEdgeCaseUI(result)` immediately after the existing family-card render.

- [ ] **Step 3: Tag iframe rows in the family cards**

In the row template (Phase 3), when a row's underlying entry has `entry.frame`, render a small mono label after the role: `entry.frame` in `--fg-faint`, `--t-xs`. Example: `BODY · stripe.com inside notion.so → metrics…`. This keeps the iframe origin honest at the row level.

Pseudocode addition inside the existing row renderer:

```js
if (entry.frame) {
  roleEl.insertAdjacentHTML('beforeend',
    ` <span class="row-frame" title="From iframe">in ${entry.frame}</span>`);
}
```

- [ ] **Step 4: CSS for the new slots**

`sidepanel/panel.css` additions:

```css
#empty-state {
  padding: var(--s-8) var(--s-6);
  color: var(--fg-muted);
  font-size: var(--t-base);
  text-align: center;
}

.placeholder-card {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-muted);
  padding: var(--s-5);
  margin: var(--s-3) var(--s-6);
  color: var(--fg-muted);
  font-size: var(--t-base);
}

.placeholder-card .fam-name { font-weight: 500; }

.footnotes {
  padding: var(--s-3) var(--s-6) var(--s-7);
  color: var(--fg-faint);
  font-family: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;
  font-size: var(--t-sm);
}

.footnotes p { margin: 0 0 var(--s-1); }
.footnotes p:last-child { margin-bottom: 0; }

.row-frame {
  margin-left: var(--s-2);
  color: var(--fg-faint);
  font-size: var(--t-xs);
  font-variant-numeric: tabular-nums;
}
```

No new color tokens — all values reference `DESIGN.md` §3.

- [ ] **Step 5: Manually verify visually**

Load the unpacked extension in Chrome. Navigate to:

1. `chrome://newtab/` → side panel should show **empty state** (no fonts detected).
2. A page with no iframes and < 5000 text nodes → no footnote strip, no placeholder card.
3. A page that embeds a cross-origin iframe (e.g., a YouTube embed) → placeholder card appears.
4. A massive page (e.g., GitHub's longest issue page, or paste 5100 `<p>` into about:blank via DevTools) → "Showing styles from the first 5000 text nodes." appears.

Take a screenshot of (1) and (3) and save to `docs/mockups/phase5-empty-state.png` and `docs/mockups/phase5-placeholder.png` for future reference.

- [ ] **Step 6: Commit**

```bash
git add sidepanel/panel.html sidepanel/panel.js sidepanel/panel.css
git commit -m "feat(panel): empty state, placeholder card, edge-case footnotes"
```

---

## Task 6: Service-worker cold-wake + first-install detection

**Goal:** Two related survivability concerns:

1. **Cold-wake handling.** The Chrome MV3 service worker sleeps after ~30s of inactivity. The side panel UI must survive — on regain-of-focus the panel re-requests the current page summary via a message to the content script, which is the durable source of session UI state. Any state the SW *itself* needs to recall (e.g., the active tab's last extraction timestamp) goes in `chrome.storage.session`.
2. **First-install detection.** `chrome.runtime.onInstalled` fires for installs, updates, and chrome-updates. We open the demo tab and side panel **only** when `reason === 'install'`.

**Files:**
- Modify: `service-worker.js`
- Modify: `sidepanel/panel.js`
- Modify: `content/content.js`
- Create: `lib/install.js`
- Create: `lib/install.test.js`

### Behavior — first install

`lib/install.js`:

```js
verdict(details, { storageGet, demoUrl }): Promise<
  { action: 'open-demo', url: string }
  | { action: 'noop', reason: string }
>
```

- If `details.reason !== 'install'` → `{ action: 'noop', reason: details.reason }`.
- If a previous install already ran (`storageGet('fontlens.installed') === true`) → `{ action: 'noop', reason: 'already-installed' }`. This defends against the edge case where a developer reinstalls from `chrome://extensions` and we'd re-open the demo every time.
- Otherwise → `{ action: 'open-demo', url: demoUrl }`.

The verdict itself does no Chrome API work — the SW does. Verdict is unit-testable with a fake `storageGet`.

### Tests

- [ ] **Step 1: Write the install tests**

`lib/install.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { verdict } from './install.js';

const url = 'chrome-extension://abc/onboarding/demo.html';

describe('install.verdict', () => {
  it('opens the demo on first install', async () => {
    const v = await verdict({ reason: 'install' }, {
      storageGet: async () => undefined,
      demoUrl: url,
    });
    expect(v).toEqual({ action: 'open-demo', url });
  });

  it('does nothing on update', async () => {
    const v = await verdict({ reason: 'update' }, {
      storageGet: async () => undefined,
      demoUrl: url,
    });
    expect(v.action).toBe('noop');
    expect(v.reason).toBe('update');
  });

  it('does nothing on chrome_update', async () => {
    const v = await verdict({ reason: 'chrome_update' }, {
      storageGet: async () => undefined,
      demoUrl: url,
    });
    expect(v.action).toBe('noop');
  });

  it('does nothing when already-installed flag is set', async () => {
    const v = await verdict({ reason: 'install' }, {
      storageGet: async (k) => k === 'fontlens.installed' ? true : undefined,
      demoUrl: url,
    });
    expect(v.action).toBe('noop');
    expect(v.reason).toBe('already-installed');
  });
});
```

- [ ] **Step 2: Run failing tests**

```bash
npx vitest run lib/install.test.js
```

Expected: failures.

- [ ] **Step 3: Implementation**

`lib/install.js`:

```js
export async function verdict(details, { storageGet, demoUrl }) {
  if (!details || details.reason !== 'install') {
    return { action: 'noop', reason: details?.reason || 'unknown' };
  }
  const already = await storageGet('fontlens.installed');
  if (already === true) {
    return { action: 'noop', reason: 'already-installed' };
  }
  return { action: 'open-demo', url: demoUrl };
}
```

- [ ] **Step 4: Wire it into `service-worker.js`**

Add at the top of the SW (after existing imports):

```js
import { verdict } from './lib/install.js';

const DEMO_PATH = chrome.runtime.getURL('onboarding/demo.html');

chrome.runtime.onInstalled.addListener(async (details) => {
  const storageGet = async (k) => {
    const r = await chrome.storage.local.get(k);
    return r[k];
  };
  const v = await verdict(details, { storageGet, demoUrl: DEMO_PATH });
  if (v.action !== 'open-demo') return;

  // Mark installed so subsequent invocations no-op.
  await chrome.storage.local.set({ 'fontlens.installed': true });

  // Open the demo tab.
  const tab = await chrome.tabs.create({ url: v.url, active: true });

  // Auto-open the side panel for this tab.
  if (chrome.sidePanel && chrome.sidePanel.open) {
    try { await chrome.sidePanel.open({ tabId: tab.id }); } catch {}
  }

  // Stash the tab id so the panel can default to Hover mode for this tab.
  await chrome.storage.session.set({ 'fontlens.onboardingTabId': tab.id });
});
```

- [ ] **Step 5: Cold-wake handling — content script holds state**

Add to `content/content.js`:

```js
// Cache the most recent page summary so the panel can re-request it cheaply
// after a service-worker nap.
let __lastSummary = null;

function buildSummary() {
  // Reuse the Phase-3 extract path. Cheap because it's debounced upstream.
  const result = extract(document.body);
  __lastSummary = { result, at: Date.now() };
  return __lastSummary;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'fontlens:summary-request') {
    // Always recompute on request — cheaper than worrying about staleness.
    sendResponse(buildSummary());
    return true; // async-safe
  }
});
```

- [ ] **Step 6: Cold-wake handling — panel re-requests on focus**

Add to `sidepanel/panel.js`:

```js
async function requestSummary() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  try {
    const summary = await chrome.tabs.sendMessage(tab.id, { type: 'fontlens:summary-request' });
    if (summary && summary.result) render(summary.result);
  } catch {
    // Content script not injected (e.g., chrome:// page) — show empty state.
    render({ groups: [], footnotes: { truncated: false, blockedFrames: 0, closedShadows: 0, host: '' } });
  }
}

window.addEventListener('focus', requestSummary);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') requestSummary();
});
```

- [ ] **Step 7: Run the install tests**

```bash
npx vitest run lib/install.test.js
```

Expected: 4 tests pass.

- [ ] **Step 8: Run the full suite**

```bash
npm test
```

Expected: green.

- [ ] **Step 9: Commit**

```bash
git add lib/install.js lib/install.test.js service-worker.js content/content.js sidepanel/panel.js
git commit -m "feat(sw): first-install demo open + cold-wake re-request loop"
```

---

## Task 7: Onboarding demo page

**Goal:** A static `onboarding/demo.html` page that:

1. Loads exactly one font that *will* load (Inter via Google Fonts, the same face used in the Phase 1 harness).
2. Requests one font that *will not* load (`"FontLensDemoMissing"`) so its first paragraph falls back to a system serif. Side panel will show the amber fallback dot the first time the user hovers it.
3. Auto-opens the side panel in Hover mode (the SW already handled the side-panel open in Task 6; this page sends a "set-mode" message on load).
4. Single instruction line: "Hover the headline below."
5. Confirmation copy appears the moment the user hovers anything tagged with a fallback signal, reading "You've seen the fallback signal — that's the part nobody else shows you."
6. Bottom button "Try it on your favorite site" closes the demo tab.

The confirmation copy is the page reacting to a `postMessage` from the content script's overlay — the chip already fires `'fontlens:fallback-seen'` when it renders an amber-dot frame (Phase 2). This page listens for that event on the same tab via `window.addEventListener('message')`.

**Files:**
- Create: `onboarding/demo.html`
- Create: `onboarding/demo.css`
- Create: `onboarding/demo.js`

### Files

- [ ] **Step 1: Create `onboarding/demo.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>FontLens — Welcome</title>
  <link rel="stylesheet" href="./demo.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">
</head>
<body>
  <main>
    <header class="brand">FontLens</header>

    <p class="instruction" id="instruction">
      Hover the headline below.
    </p>

    <section class="demo">
      <h1 class="fallback-headline">This headline asks for a font that isn't loaded.</h1>
      <p class="fallback-body">It falls back to your system serif — visitors don't see what the designer chose.</p>

      <h1 class="working-headline">This one renders the font the designer chose.</h1>
      <p class="working-body">Same hover, no fallback dot.</p>
    </section>

    <p class="confirmation" id="confirmation" hidden>
      ✓ You've seen the fallback signal — that's the part nobody else shows you.
    </p>

    <button class="cta" id="exit-button" type="button">Try it on your favorite site</button>
  </main>

  <script type="module" src="./demo.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `onboarding/demo.css`**

Uses the same token philosophy as the panel but is fully self-contained — no `@import` from the rest of the extension. Tokens are duplicated inline because we deliberately do not import `lib/tokens.css` (the demo must work even if the rest of the extension is uninstalled or broken).

```css
:root {
  --bg: #ffffff;
  --bg-muted: #fafafa;
  --bg-subtle: #f4f4f5;
  --border: #ececec;
  --fg: #0f0f10;
  --fg-muted: #6b6b6e;
  --fg-faint: #9c9ca0;
  --amber-500: #f59e0b;
  --amber-bg: #fff8eb;
  --amber-fg: #7a4a1d;
  --link: #1e6fd8;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0e0e10;
    --bg-muted: #161618;
    --bg-subtle: #1f1f22;
    --border: #26262a;
    --fg: #f5f5f7;
    --fg-muted: #a1a1a6;
    --fg-faint: #6b6b6e;
    --amber-500: #f5b840;
    --amber-bg: #2a1e08;
    --amber-fg: #f5d089;
  }
}

* { box-sizing: border-box; }

html, body {
  background: var(--bg);
  color: var(--fg);
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

main {
  max-width: 720px;
  margin: 0 auto;
  padding: 64px 24px 96px;
}

.brand {
  font-weight: 600;
  font-size: 13px;
  letter-spacing: 0.02em;
  color: var(--fg-muted);
  margin-bottom: 48px;
}

.instruction {
  font-size: 18px;
  line-height: 1.4;
  color: var(--fg);
  margin: 0 0 32px;
}

.demo {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 32px;
  margin: 0 0 32px;
  background: var(--bg);
}

/* The intentionally-missing face — falls back, on purpose. */
.fallback-headline {
  font-family: "FontLensDemoMissing", Georgia, serif;
  font-size: 28px;
  line-height: 1.2;
  margin: 0 0 8px;
}
.fallback-body {
  font-family: "FontLensDemoMissing", Georgia, serif;
  font-size: 15px;
  line-height: 1.55;
  margin: 0 0 32px;
  color: var(--fg-muted);
}

/* The intentionally-loading face — renders cleanly. */
.working-headline {
  font-family: "Inter", sans-serif;
  font-weight: 700;
  font-size: 28px;
  line-height: 1.2;
  margin: 0 0 8px;
}
.working-body {
  font-family: "Inter", sans-serif;
  font-weight: 400;
  font-size: 15px;
  line-height: 1.55;
  margin: 0;
  color: var(--fg-muted);
}

.confirmation {
  background: var(--amber-bg);
  color: var(--amber-fg);
  border: 1px solid var(--amber-500);
  border-radius: 8px;
  padding: 12px 14px;
  font-size: 14px;
  margin: 0 0 32px;
  animation: confirmation-fade 200ms ease-out;
}

@keyframes confirmation-fade {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}

.cta {
  appearance: none;
  background: var(--fg);
  color: var(--bg);
  border: none;
  border-radius: 8px;
  padding: 12px 20px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.cta:hover { opacity: 0.92; }
.cta:focus-visible { outline: 2px solid var(--link); outline-offset: 2px; }

@media (prefers-reduced-motion: reduce) {
  .confirmation { animation: none; }
}
```

- [ ] **Step 3: Create `onboarding/demo.js`**

```js
// 1. Ask the side panel (via the service worker) to enter Hover mode for this tab.
try {
  chrome.runtime.sendMessage({ type: 'fontlens:set-mode', mode: 'hover' });
} catch {
  // If we're loaded directly (not via the extension), no-op silently.
}

// 2. Reveal the confirmation line the first time the overlay reports an
//    amber-dot render. The overlay (Phase 2) posts this message to the
//    page window when its fallback chip renders.
const confirmation = document.getElementById('confirmation');

window.addEventListener('message', (e) => {
  if (e.source !== window) return;
  if (!e.data || e.data.type !== 'fontlens:fallback-seen') return;
  if (!confirmation.hidden) return; // already shown
  confirmation.hidden = false;
});

// 3. Exit button closes the demo tab.
const exitButton = document.getElementById('exit-button');
exitButton.addEventListener('click', async () => {
  // Prefer the extension API if available; otherwise close the window.
  if (window.chrome && chrome.tabs && chrome.tabs.getCurrent) {
    try {
      const tab = await chrome.tabs.getCurrent();
      if (tab && tab.id != null) {
        await chrome.tabs.remove(tab.id);
        return;
      }
    } catch { /* fall through */ }
  }
  window.close();
});

// 4. Defensive: if the user does nothing for 8 seconds, gently bold the
//    instruction line so it stays visible. (No autoplay, no popovers.)
setTimeout(() => {
  const instruction = document.getElementById('instruction');
  if (instruction) instruction.style.fontWeight = '600';
}, 8000);
```

- [ ] **Step 4: Confirm the overlay posts the fallback-seen event**

Open `content/overlay.js` (Phase 2). Verify that when the chip renders with the amber dot, it posts the message to the page window. If Phase 2 didn't include this, add it now at the moment the amber-dot DOM is appended:

```js
try { window.postMessage({ type: 'fontlens:fallback-seen' }, '*'); } catch {}
```

This must be a no-op on non-onboarding pages — the receiver only exists on `onboarding/demo.html`.

- [ ] **Step 5: Add the resource to `web_accessible_resources` if not already**

`manifest.json` — the demo page is loaded from the extension origin so it's already accessible. But it ships with linked Google Fonts. Ensure `content_security_policy` (if set) permits `fonts.googleapis.com` and `fonts.gstatic.com`. If the manifest currently has no CSP override, Chrome's MV3 default permits this. If Phase 2 added a strict CSP, add:

```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self'; font-src 'self' https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com"
}
```

(Unsafe-inline on styles is necessary for the Google Fonts CSS to apply. The page does not execute remote scripts.)

- [ ] **Step 6: Manual test — install the extension fresh**

```bash
# Load the extension in chrome://extensions, "Load unpacked"
# Then click Remove and Load again to simulate first install.
```

Expected behavior on first install:
- A new tab opens at `chrome-extension://<id>/onboarding/demo.html`.
- The side panel auto-opens in Hover mode.
- Hovering the first headline shows the amber fallback dot. The confirmation line appears below the demo box.
- Hovering the second headline shows the chip with the rendered font (Inter), no fallback dot.
- Clicking "Try it on your favorite site" closes the tab.

On reload of the unpacked extension, the demo must **not** re-open.

- [ ] **Step 7: Commit**

```bash
git add onboarding/demo.html onboarding/demo.css onboarding/demo.js content/overlay.js manifest.json
git commit -m "feat(onboarding): first-install demo page with fallback signal moment"
```

---

## Task 8: Performance guards + real-site harness

**Goal:** Confirm the performance commitments from §11 and run the manual real-site CSP checklist.

### Performance guards to verify (already implemented in prior phases — this task is a *check*, not new code unless something is missing)

| Guard | Location | How to verify |
|-------|----------|---------------|
| 60Hz `requestAnimationFrame` throttle on mousemove | `content/content.js` (Phase 2) | DevTools Performance → record 5s of cursor flicking → `detect()` calls per second ≤ 60 |
| 150ms debounce on inspect-click before extraction | `content/content.js` or `content/extractor.js` (Phase 3) | Click rapidly 5x → only one `extract()` runs |
| 5000-node cap | `content/extractor.js` (Task 4) | Integration test (added) |
| Shadow root recycled (one chip element per content-script lifetime) | `content/overlay.js` (Phase 2) | After 200 hover events, `document.querySelectorAll('fontlens-chip').length` is still 1 |

- [ ] **Step 1: Audit each guard**

Open the relevant file and confirm the implementation. If any is missing or weaker than spec, add it now. Document each verification in the commit message.

If the rAF throttle is missing, add to the mousemove handler in `content/content.js`:

```js
let __rafScheduled = false;
let __lastEvent = null;
function onMouseMove(e) {
  __lastEvent = e;
  if (__rafScheduled) return;
  __rafScheduled = true;
  requestAnimationFrame(() => {
    __rafScheduled = false;
    handleHover(__lastEvent);
  });
}
```

If the 150ms debounce is missing, add to the inspect-click handler:

```js
let __extractTimer = null;
function scheduleExtract(el) {
  if (__extractTimer) clearTimeout(__extractTimer);
  __extractTimer = setTimeout(() => {
    __extractTimer = null;
    sendExtractResult(extract(el));
  }, 150);
}
```

- [ ] **Step 2: Create the manual real-site checklist**

`test/harness/csp-strict.md`:

```markdown
# Phase 5 — Real-site manual checklist

Run after every Phase 5 change. Sign off with date + initials at the bottom.

## Setup
- [ ] Load the unpacked extension from this branch.
- [ ] Open DevTools Console on each target site.

## Sites

### Stripe (`https://stripe.com`)
- [ ] Toolbar click opens the side panel.
- [ ] Hover chip shows on h1 with the rendered font name.
- [ ] If canvas read is CSP-blocked, the chip's family row carries the `?` confidence badge (no red error in console).
- [ ] No console errors from the extension.

### GitHub (`https://github.com/anthropics/claude-code`)
- [ ] Side panel renders family-grouped cards.
- [ ] No fallback amber dots on production GitHub (it self-hosts its fonts cleanly).
- [ ] Inspect-click on a code block returns rows tagged `code` role.

### Notion (`https://www.notion.so/help`)
- [ ] Confirmation: open shadow roots get walked — counts > 0 in the panel summary.
- [ ] No console errors.

### YouTube watch page
- [ ] Cross-origin iframe (`<iframe>` embeds) produce the placeholder card: "N frame(s) couldn't be inspected (cross-origin)".

### A massive page
- Open https://en.wikipedia.org/wiki/Lists_of_lists_of_lists or any 10k-node page.
- [ ] Side panel shows "Showing styles from the first 5000 text nodes." footnote.
- [ ] Extraction finishes in < 500ms (visible on DevTools Performance).

### A blank page
- Navigate to `about:blank` (or open a fresh empty tab and side-panel it).
- [ ] Side panel shows the empty state: "Navigate to a page with text and try again."

### Cold-wake test
- Open the side panel on a real site, then leave the tab idle for 35 seconds.
- Switch focus away and back to the side panel.
- [ ] Panel re-renders the current page summary (visible by network panel: a single `chrome.tabs.sendMessage` round-trip).
- [ ] No "Receiving end does not exist" errors.

### First-install test (incognito session helps)
- Remove the extension from `chrome://extensions`.
- Re-install via "Load unpacked".
- [ ] Demo tab opens automatically.
- [ ] Side panel opens in Hover mode.
- [ ] Hover the first headline → confirmation line appears.
- [ ] Click "Try it on your favorite site" → tab closes.
- [ ] Manually reload the extension. Demo tab does NOT reopen.

---

Signed off: __________ on __________
```

- [ ] **Step 3: Create iframe + shadow browser harnesses**

`test/harness/iframes.html`:

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>FontLens iframe harness</title>
  <style>
    body { font: 16px/1.5 system-ui; padding: 24px; }
    iframe { width: 100%; height: 220px; border: 1px solid #ddd; }
  </style>
</head>
<body>
  <h1>iframe harness</h1>
  <p>Inspect this page with FontLens. Expect 2 same-origin iframe rows + 1 cross-origin placeholder.</p>

  <h2>Same-origin frame</h2>
  <iframe src="./_iframe-child.html"></iframe>

  <h2>Cross-origin frame</h2>
  <iframe src="https://example.org/"></iframe>

  <h2>Same-origin frame, second copy</h2>
  <iframe src="./_iframe-child.html"></iframe>
</body>
</html>
```

`test/harness/_iframe-child.html`:

```html
<!doctype html>
<html>
<head><meta charset="utf-8">
<style>
  body { font: 14px/1.4 Georgia, serif; padding: 8px; }
  h3 { font-family: "ChildMissing", Arial, sans-serif; }
</style>
</head>
<body>
  <h3>Child heading (asks for ChildMissing — falls back).</h3>
  <p>Some body text in Georgia.</p>
</body>
</html>
```

`test/harness/shadow.html`:

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>FontLens shadow harness</title>
  <style>
    body { font: 16px/1.5 system-ui; padding: 24px; }
  </style>
</head>
<body>
  <h1>shadow-root harness</h1>
  <my-card></my-card>
  <my-closed-card></my-closed-card>

  <script>
    class MyCard extends HTMLElement {
      constructor() {
        super();
        const sh = this.attachShadow({ mode: 'open' });
        sh.innerHTML = `
          <style>p { font-family: Georgia, serif; font-size: 18px; }</style>
          <p>Shadowed paragraph (open) — should appear in the panel.</p>`;
      }
    }
    customElements.define('my-card', MyCard);

    class MyClosedCard extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'closed' });
      }
    }
    customElements.define('my-closed-card', MyClosedCard);
  </script>
</body>
</html>
```

- [ ] **Step 4: Run the manual harness pass**

```bash
npm run harness
```

Open `http://localhost:5173/iframes.html`, click the FontLens toolbar button:

- Expected side-panel content: rows from the top page + rows from `_iframe-child.html` (twice, both tagged `localhost:5173`) + placeholder card "1 frame couldn't be inspected (cross-origin)".

Open `http://localhost:5173/shadow.html`:

- Expected: a row for the shadowed Georgia paragraph + a footnote "1 node in closed shadow tree was skipped." (only if the `attachShadow` patch from Task 4 is active before `my-closed-card` is defined — order matters, the patch must precede script tags. If your manifest doesn't run the content script before page scripts, the count may legitimately be 0; that's documented honesty per spec §10).

- [ ] **Step 5: Commit**

```bash
git add test/harness/iframes.html test/harness/_iframe-child.html test/harness/shadow.html test/harness/csp-strict.md content/content.js
git commit -m "test(phase5): manual harness pages + real-site checklist"
```

---

## Task 9: Phase 5 closeout

- [ ] **Step 1: Full test suite**

```bash
npm test
```

Expected: all tests pass — Phase 1 (≥47) + Phase 3/4 baselines + Phase 5 new (~21 across iframes, shadow, extract integration, install).

- [ ] **Step 2: Lint-like check**

```bash
node --check service-worker.js
node --check content/content.js
node --check content/extractor.js
node --check sidepanel/panel.js
node --check onboarding/demo.js
node --check lib/extractor-iframes.js
node --check lib/extractor-shadow.js
node --check lib/install.js
```

Expected: all syntactically valid.

- [ ] **Step 3: Complete the manual checklist in `test/harness/csp-strict.md`**

Sign off with date + initials.

- [ ] **Step 4: Push and tag**

```bash
git push origin main
git tag -a phase5-edges -m "Phase 5: edge cases + onboarding"
git push origin phase5-edges
```

- [ ] **Step 5: Move to Phase 6 (Store prep)**

Phase 5 hands off a Chrome MV3 build that's honest on the messy web and respectful on first install. Phase 6 takes screenshots (lead with the fallback chip from the demo page!), writes listing copy, drafts the privacy disclosure, and submits.

---

## Acceptance criteria (gate for Phase 6 / store submission)

Phase 5 is done when ALL of these are true:

- [ ] `npm test` passes with zero failures and at least 21 new tests added in this phase.
- [ ] `lib/extractor-iframes.js` exports `collectFrames(rootDoc)` and is independently testable.
- [ ] `lib/extractor-shadow.js` exports `collectShadowRoots(rootEl)` and is independently testable.
- [ ] `lib/install.js` exports `verdict(details, deps)` and is independently testable.
- [ ] `content/extractor.js` composes the two walkers and returns a `footnotes` object with at minimum `truncated`, `blockedFrames`, `closedShadows`, `host` keys.
- [ ] Side panel renders the empty state when zero text nodes are detected.
- [ ] Side panel renders a cross-origin placeholder card when `blockedFrames > 0`.
- [ ] Side panel renders the truncation footnote when `truncated === true`.
- [ ] Side panel re-requests the page summary on focus/visibility change after a service-worker nap.
- [ ] `service-worker.js` opens `onboarding/demo.html` and the side panel exactly once, only when `chrome.runtime.onInstalled` fires with `reason === 'install'`.
- [ ] `onboarding/demo.html` loads one missing and one working face. The confirmation line appears on first fallback-dot hover. The exit button closes the tab.
- [ ] CSP-strict sites (Stripe, GitHub) show low-confidence `?` badges on rows the canvas couldn't fingerprint, with no console errors from the extension.
- [ ] `test/harness/csp-strict.md` is signed off.
- [ ] `git tag phase5-edges` is pushed.

---

## Notes for the implementer

- **Honest counters, not pretend ones.** When a closed shadow root exists but our `attachShadow` patch wasn't installed in time (content script ran after page scripts), report 0. Lying counts erodes the trust the wedge is built on. Spec §10 explicitly endorses "report a quiet footnote" rather than inflating numbers.
- **The demo page is a marketing surface.** The "You've seen the fallback signal — that's the part nobody else shows you" line is the same copy that ships in `DESIGN.md` §1. Do not paraphrase it. It is the wedge in one sentence.
- **First-install is one-shot.** The `fontlens.installed` flag in `chrome.storage.local` guards against re-opens. Do not also gate on the SW's in-memory state — the SW dies after 30 seconds.
- **Cold-wake re-request is the only durable refresh.** Do not add a `setInterval` poll. The focus/visibility events cover every real-world case and don't burn battery.
- **Cross-origin iframe placeholder is a card, not a row.** Per the user's framing — the goal is one obvious, named affordance: "I tried, here's what I couldn't see." Putting it inline as a row would hide it.
- **rAF throttle and 150ms debounce are non-negotiable.** Janking the page during inspect is the fastest way to one-star review. If Phase 2/3 forgot these, this phase is the last chance to install them before launch.
- **Do not introduce new color tokens.** Everything in this phase reuses `DESIGN.md` §3. If you find yourself reaching for a new hex, stop and check whether `--bg-muted` or `--fg-faint` is what you actually wanted.
- **No scope creep into Phase 6.** Don't write the store listing. Don't take the marketing screenshots. Don't draft the privacy policy. Phase 5 is invisible-quality work — the kind that earns the right to ship.
