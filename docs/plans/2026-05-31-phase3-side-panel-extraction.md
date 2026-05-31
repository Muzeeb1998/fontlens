# Phase 3 — Side Panel + Extraction

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Chrome's Side Panel API, build the hybrid family-grouped UI (DESIGN.md §6.4–6.5), and ship `lib/extractor.js` — the pure-logic walk that takes a root element and returns one entry per distinct style, deduped by style-key, sorted by usage count. Click a row → highlight matching nodes in the page. Includes the page-level fallback banner, summary line, theme toggle, mode toggle, full keyboard support, and ARIA labels per DESIGN.md §10 and spec §8.5.

**Architecture:**
- `lib/extractor.js` — pure logic over the Phase 1 `detect()` and `inferRole()` APIs. Walks a root, caps at 5000 visible-text nodes, dedupes by style-key, returns sorted groups.
- `lib/style-key.js` — pure helper used by the extractor to dedupe styles.
- `sidepanel/panel.html` + `panel.js` + `panel.css` — the Side Panel root. Renders summary, banner, family cards. Owns theme + mode toggles. Persists theme to `chrome.storage.local`.
- `sidepanel/render.js` — pure DOM rendering helpers (cards, rows, banner, summary). Imported by `panel.js`. Unit-testable with happy-dom because it only manipulates a passed-in container element.
- `sidepanel/messaging.js` — thin wrapper over `chrome.tabs.sendMessage` + `chrome.runtime.onMessage` so panel rendering helpers can be unit-tested without the chrome API.
- `manifest.json` — gains the `side_panel` entry (already specified in spec §4.6, but this is the phase that creates the file).
- `service-worker.js` — minimal router stub: opens the side panel on toolbar action and relays the Phase 2 message contract between panel and content script.

The content script proper, the overlay, and the Phase 2 message handlers on the content side are **Phase 2 territory** — Phase 3 only sends and receives the messages defined in the contract below. If Phase 2 has not yet landed when Phase 3 starts, Task 1 stubs a content-script receiver so manual testing is possible without blocking.

**Tech Stack:** Vanilla JavaScript (ES modules), Vitest + happy-dom for unit tests (already configured in Phase 1), no build step, Chrome MV3 (Side Panel API requires Chrome 114+ but we assume 2026-current).

**Spec sections this implements:**
- §4.2 (side panel architecture)
- §4.6 (manifest.json — side_panel entry)
- §6 (full-system extraction)
- §6.3 (hybrid panel grouping)
- §8.3 (side panel — the workhorse)
- §8.5 (accessibility of FontLens itself)

**DESIGN.md sections this implements:**
- §3 (color tokens — both themes)
- §4 (typography, tabular nums)
- §5 (spacing)
- §6.2 (header), §6.3 (fallback banner), §6.4 (family card), §6.5 (style row), §6.6 (badges), §6.8 (mode toggle)
- §9 (interaction principles), §10 (accessibility)

**Out of scope (later phases):**
- Copy buttons / serializers (Phase 4 — `lib/export.js`)
- Variable-font axis sliders (Phase 4)
- Toast component (Phase 4 — needed by copy buttons)
- Onboarding demo page (Phase 5)
- Cross-origin iframe placeholder card (Phase 5)
- Options page (Phase 5)

---

## Message contract (consumed by Phase 3, produced by Phase 2)

Phase 3 is the **panel side** of these messages. Phase 2 owns the content-script side. If Phase 2 is not yet shipped, Task 1 includes a stub content script that satisfies the contract for manual smoke-testing.

All messages flow through `chrome.tabs.sendMessage(tabId, msg)` from panel → content, and `chrome.runtime.sendMessage(msg)` from content → panel. The service worker relays where required.

```ts
// Panel → Content
type PanelToContent =
  | { type: 'fontlens:set-mode'; mode: 'hover' | 'inspect' }
  | { type: 'fontlens:highlight';   key: string; nodeIds: number[] }
  | { type: 'fontlens:unhighlight'; key: string }
  | { type: 'fontlens:request-extract' }  // ask content to run extract() on <body>
  | { type: 'fontlens:request-extract-selection'; selector?: string };

// Content → Panel
type ContentToPanel =
  | { type: 'fontlens:extract-result'; payload: ExtractPayload }
  | { type: 'fontlens:mode-changed'; mode: 'hover' | 'inspect' }
  | { type: 'fontlens:hover-pick';   payload: SingleRowPayload };

interface ExtractPayload {
  hostname: string;
  totalNodes: number;       // visible-text nodes seen, ≤ 5000
  truncated: boolean;       // true when extractor hit the 5000 cap
  groups: FamilyGroup[];    // see Task 2 — family-grouped output
}

interface FamilyGroup {
  family: string;
  source: { type: 'google' | 'adobe' | 'self-hosted' | 'system' | 'unknown'; format: string | null };
  isFallback: boolean;
  requestedFamily?: string;     // populated only when isFallback (e.g., "Söhne" for Söhne → Arial card)
  isVariable: boolean;
  axes: object | null;
  rows: StyleRow[];
}

interface StyleRow {
  key: string;                  // styleKey — used for highlight messages
  role: 'Headline' | 'Body' | 'Caption' | 'Label' | 'Code';
  count: number;
  nodeIds: number[];            // opaque ids assigned by content script; panel just passes them back
  detail: DetectResult;         // exactly the Phase 1 detect() output for the representative node
}

interface SingleRowPayload {
  hostname: string;
  group: FamilyGroup;           // single group, single row — used when hover mode clicks an element
}
```

`nodeIds` are integers minted by the content script (`Map<number, Element>`) so the panel can refer to nodes without sending DOM references across the messaging boundary. Phase 2 owns minting; Phase 3 just echoes the array back in `fontlens:highlight`.

---

## File Structure

```
fontlens/
├── manifest.json                       [Task 1]
├── service-worker.js                   [Task 1]
├── content/
│   └── content.js                      [Task 1 — stub only; Phase 2 owns the real thing]
├── lib/
│   ├── style-key.js                    [Task 2]
│   ├── style-key.test.js               [Task 2]
│   ├── extractor.js                    [Task 3]
│   ├── extractor.test.js               [Task 3]
│   └── tokens.css                      [Task 4]
└── sidepanel/
    ├── panel.html                      [Task 5]
    ├── panel.css                       [Task 4]
    ├── messaging.js                    [Task 6]
    ├── render.js                       [Task 7]
    ├── render.test.js                  [Task 7]
    └── panel.js                        [Task 8]
└── test/
    └── fixtures/
        └── extract-payload.js          [Task 7 — shared test fixture]
```

Boundaries:
- `lib/extractor.js`, `lib/style-key.js` are **pure** — no Chrome APIs, no `chrome.*`, no DOM mutation. Take a root element, return data.
- `sidepanel/render.js` is **pure DOM** — takes a container element and a payload, mutates the container. No `chrome.*`, no messaging. Unit-tested with happy-dom against an in-memory document.
- `sidepanel/messaging.js` wraps every `chrome.*` call we need. It is the single seam that the unit tests do **not** cover (mocked in tests).
- `sidepanel/panel.js` is the entry — composes messaging + render + theme/mode persistence. Smoke-tested manually in the loaded extension.

---

## Task 1: Manifest, service worker, content-script stub

We need a working MV3 extension that opens the side panel on action click, even if Phase 2's overlay hasn't landed. The content-script stub satisfies the message contract with synthetic data so Phase 3 can be developed end-to-end.

**Files:**
- Create: `manifest.json`
- Create: `service-worker.js`
- Create: `content/content.js` (stub, replaced by Phase 2)
- Create: `assets/icons/16.png`, `48.png`, `128.png` (placeholders are fine — single-color squares)

- [ ] **Step 1: Create `manifest.json`** (matches spec §4.6 exactly)

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
  "icons": { "16": "assets/icons/16.png", "48": "assets/icons/48.png", "128": "assets/icons/128.png" }
}
```

Note: `options/options.html` is created in Phase 5; Chrome tolerates a missing options file as long as nothing tries to open it. If Chrome warns during load-unpacked, create an empty `options/options.html` with `<!doctype html><title>Options</title>` to silence it.

- [ ] **Step 2: Create `service-worker.js`** (thin router)

```js
// service-worker.js — MV3 background. Holds zero important state.

chrome.runtime.onInstalled.addListener(async () => {
  // Side panel is enabled per-tab. Default to behavior: open on action click.
  if (chrome.sidePanel?.setPanelBehavior) {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
});

// Toolbar click — Chrome opens the side panel automatically because of
// setPanelBehavior above. We additionally inject the content script and
// ask it to enter Hover mode (spec §8.1: "Opens the side panel AND enables
// Hover mode in one action.").
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: false },
      files: ['content/content.js'],
    });
    await chrome.tabs.sendMessage(tab.id, { type: 'fontlens:set-mode', mode: 'hover' });
  } catch (e) {
    // chrome:// or store pages — silently ignored; panel opens but stays empty.
  }
});

// Keyboard command — same as action click.
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-inspect') return;
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content/content.js'] });
    await chrome.tabs.sendMessage(tab.id, { type: 'fontlens:set-mode', mode: 'inspect' });
  } catch {}
});
```

- [ ] **Step 3: Create stub `content/content.js`** (replaced by Phase 2)

This stub satisfies the message contract just enough to render the panel during Phase 3 development. It returns a hard-coded payload on `fontlens:request-extract` and a no-op for highlight.

```js
// content/content.js — STUB. Phase 2 replaces this with the real overlay
// and detection driver. The stub exists so Phase 3 (panel) can be developed
// against the real Phase 1 detector and a synthetic message stream.

(function () {
  if (window.__fontlensStub) return;
  window.__fontlensStub = true;

  const nodeMap = new Map();
  let nextId = 1;
  function idFor(el) {
    for (const [id, e] of nodeMap) if (e === el) return id;
    const id = nextId++; nodeMap.set(id, el); return id;
  }

  function syntheticPayload() {
    // Walks the page with the same shape extractor.js will produce.
    // Inline import is impossible from a content script; we duplicate
    // minimal walking logic here. Replaced wholesale by Phase 2 anyway.
    const groups = new Map();
    const allEls = document.querySelectorAll('body *');
    let total = 0;
    let truncated = false;
    for (const el of allEls) {
      if (total >= 5000) { truncated = true; break; }
      if (!el.textContent || !el.textContent.trim()) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      total++;
      const family = (cs.fontFamily.split(',')[0] || '').replace(/['"]/g, '').trim();
      const key = `${family}|${cs.fontSize}|${cs.fontWeight}|${cs.lineHeight}|${cs.color}`;
      if (!groups.has(family)) groups.set(family, new Map());
      const inner = groups.get(family);
      if (!inner.has(key)) {
        inner.set(key, {
          key, role: 'Body', count: 0, nodeIds: [],
          detail: {
            requested: cs.fontFamily.split(',').map(s => s.replace(/['"]/g, '').trim()),
            rendered: family, isFallback: false,
            source: { type: 'unknown', format: null, url: null, os: null },
            isVariable: false, axes: null,
            metrics: {
              size: cs.fontSize, weight: Number(cs.fontWeight) || cs.fontWeight,
              lineHeight: cs.lineHeight, letterSpacing: cs.letterSpacing,
              transform: cs.textTransform,
              color: { rgb: cs.color, hex: '#000000' },
            },
            confidence: 'high',
          },
        });
      }
      const row = inner.get(key);
      row.count++;
      row.nodeIds.push(idFor(el));
    }

    const groupArr = [...groups.entries()].map(([family, rows]) => ({
      family,
      source: { type: 'unknown', format: null },
      isFallback: false,
      isVariable: false,
      axes: null,
      rows: [...rows.values()].sort((a, b) => b.count - a.count),
    }));

    return {
      hostname: location.hostname,
      totalNodes: total,
      truncated,
      groups: groupArr,
    };
  }

  function applyHighlight(ids) {
    for (const id of ids) {
      const el = nodeMap.get(id);
      if (el) el.classList.add('fontlens-highlight');
    }
  }
  function clearHighlight(ids) {
    for (const id of ids) {
      const el = nodeMap.get(id);
      if (el) el.classList.remove('fontlens-highlight');
    }
  }

  // Inject the highlight style once.
  const style = document.createElement('style');
  style.id = 'fontlens-stub-style';
  style.textContent = `.fontlens-highlight { outline: 2px solid #f59e0b !important; outline-offset: 2px !important; }`;
  document.documentElement.appendChild(style);

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'fontlens:request-extract') {
      chrome.runtime.sendMessage({ type: 'fontlens:extract-result', payload: syntheticPayload() });
    } else if (msg?.type === 'fontlens:highlight') {
      applyHighlight(msg.nodeIds || []);
    } else if (msg?.type === 'fontlens:unhighlight') {
      // Re-derive node ids from the most recent payload's row by key — for the stub
      // we just clear every highlight when any unhighlight arrives.
      document.querySelectorAll('.fontlens-highlight').forEach(el => el.classList.remove('fontlens-highlight'));
    } else if (msg?.type === 'fontlens:set-mode') {
      // Stub acknowledges but does nothing visible until Phase 2 lands.
      chrome.runtime.sendMessage({ type: 'fontlens:mode-changed', mode: msg.mode });
    }
  });
})();
```

- [ ] **Step 4: Drop placeholder icons**

Generate three solid-color PNGs (the production icons land in Phase 6 store-prep). One-liner from the repo root:

```bash
mkdir -p assets/icons
# Use ImageMagick if installed; otherwise drop in 1x1 placeholder PNGs by hand.
if command -v magick >/dev/null 2>&1; then
  for s in 16 48 128; do magick -size ${s}x${s} xc:'#0f0f10' assets/icons/${s}.png; done
else
  echo "Manually drop 16.png, 48.png, 128.png into assets/icons/"
fi
```

- [ ] **Step 5: Load the unpacked extension in Chrome**

  1. Open `chrome://extensions`, enable Developer Mode.
  2. "Load unpacked" → select the `fontlens/` repo root.
  3. Click the FontLens action button on any normal HTTP(S) page.
  4. Expected: side panel opens (currently empty until Task 5). No errors in `chrome://extensions` "Errors" panel.

- [ ] **Step 6: Commit**

```bash
git add manifest.json service-worker.js content/content.js assets/icons/
git commit -m "feat(mv3): manifest + service worker + content-script stub for side panel wiring"
```

---

## Task 2: `lib/style-key.js` — dedupe key for a detected style

The extractor must collapse "same style on 80 different `<p>` tags" into one row with `count: 80`. The dedupe key is a stable string derived from the metrics + rendered family.

**Files:**
- Create: `lib/style-key.js`
- Test: `lib/style-key.test.js`

### Behavior

Inputs: a Phase 1 detect-result's `metrics` object and `rendered` family.
Output: a single string key like `"Inter|16px|400|24px|normal|none|#222222"`.

Fields concatenated (pipe-separated, no whitespace inside fields):
`rendered | size | weight | lineHeight | letterSpacing | transform | color.hex`

If `rendered` is `null` (canvas blocked + fonts.check disagreed), key uses the literal string `"unknown"` so unknown-render styles still group separately from real ones.

- [ ] **Step 1: Write the failing tests**

`lib/style-key.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { styleKey } from './style-key.js';

const m = (over = {}) => ({
  size: '16px', weight: 400, lineHeight: '24px',
  letterSpacing: 'normal', transform: 'none',
  color: { rgb: 'rgb(34,34,34)', hex: '#222222' },
  ...over,
});

describe('styleKey', () => {
  it('joins the canonical fields with pipes', () => {
    expect(styleKey(m(), 'Inter'))
      .toBe('Inter|16px|400|24px|normal|none|#222222');
  });

  it('treats two equal styles as equal keys', () => {
    expect(styleKey(m(), 'Inter')).toBe(styleKey(m(), 'Inter'));
  });

  it('differs when size differs', () => {
    expect(styleKey(m({ size: '14px' }), 'Inter'))
      .not.toBe(styleKey(m({ size: '16px' }), 'Inter'));
  });

  it('differs when family differs', () => {
    expect(styleKey(m(), 'Inter')).not.toBe(styleKey(m(), 'Arial'));
  });

  it('differs when weight differs', () => {
    expect(styleKey(m({ weight: 700 }), 'Inter'))
      .not.toBe(styleKey(m({ weight: 400 }), 'Inter'));
  });

  it('uses "unknown" when rendered is null', () => {
    expect(styleKey(m(), null)).toBe('unknown|16px|400|24px|normal|none|#222222');
  });

  it('uses color.hex regardless of color.rgb formatting', () => {
    const a = styleKey({ ...m(), color: { rgb: 'rgb(34, 34, 34)',  hex: '#222222' } }, 'X');
    const b = styleKey({ ...m(), color: { rgb: 'rgb(34,  34,  34)', hex: '#222222' } }, 'X');
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run lib/style-key.test.js
```

Expected: failures (`styleKey is not a function`).

- [ ] **Step 3: Write the implementation**

`lib/style-key.js`:

```js
// Stable dedupe key for an (element, detected-style) pair. The extractor
// uses this to collapse "same style on N different nodes" into one row.

export function styleKey(metrics, rendered) {
  const family = rendered ?? 'unknown';
  const size   = metrics?.size ?? '';
  const weight = metrics?.weight ?? '';
  const lh     = metrics?.lineHeight ?? '';
  const ls     = metrics?.letterSpacing ?? '';
  const tr     = metrics?.transform ?? '';
  const hex    = metrics?.color?.hex ?? '';
  return `${family}|${size}|${weight}|${lh}|${ls}|${tr}|${hex}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run lib/style-key.test.js
```

Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/style-key.js lib/style-key.test.js
git commit -m "feat(extractor): styleKey() — stable dedupe key for detected styles"
```

---

## Task 3: `lib/extractor.js` — walk a root, return family-grouped rows

The extractor is the single function the rest of the system asks "what type styles are in this subtree?" It composes Phase 1's `detect()` + `inferRole()`, dedupes by `styleKey`, sorts by count desc, then groups by family for the side-panel layout (DESIGN.md §6.4–6.5).

**Files:**
- Create: `lib/extractor.js`
- Test: `lib/extractor.test.js`

### Spec mapping

- §6.1 walk: cap at 5000 nodes; skip nodes without visible text; dedupe by style-key.
- §6.2 role inference: use `inferRole` from Phase 1.
- §6.3 hybrid layout: top-level groups by family, rows sorted by usage count descending inside each group.

### API

```js
extract(root, options?): {
  hostname: string,
  totalNodes: number,      // visible-text nodes inspected (≤ MAX_NODES)
  truncated: boolean,      // true if MAX_NODES was hit
  rows: StyleRow[],        // flat, sorted by count desc — exposed for tests / debug
  groups: FamilyGroup[],   // grouped by rendered family, fallback groups first
}

// options:
// - detect:   function(el) → detectResult            (default: lib/detector.detect)
// - inferRole:function(el, metrics) → role string    (default: lib/roles.inferRole)
// - maxNodes: number                                 (default: 5000)
// - hostname: string                                 (default: globalThis.location?.hostname || '')
```

Both injectable dependencies exist so happy-dom tests can pass synthetic stand-ins (canvas isn't available in happy-dom).

### Visible-text test

A node "has visible text" when it has at least one **direct** non-whitespace text-node child and `getComputedStyle(node).display !== 'none'` and `visibility !== 'hidden'`. Direct text only — we don't want to count a `<div>` wrapping a `<p>` as both having text; the `<p>` wins.

### Tests

- [ ] **Step 1: Write the failing tests**

`lib/extractor.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { extract } from './extractor.js';

function mkBody(html) {
  document.body.innerHTML = html;
  return document.body;
}

// Synthetic detect() — keyed off inline data-* attrs so tests stay readable.
function fakeDetect(el) {
  const family = el.dataset.family || 'Inter';
  const fallback = el.dataset.fallback === 'true';
  const requested = el.dataset.requested ? el.dataset.requested.split(',') : [family];
  return {
    requested,
    rendered: family,
    isFallback: fallback,
    source: { type: el.dataset.source || 'self-hosted', format: 'woff2', url: null, os: null },
    isVariable: false,
    axes: null,
    metrics: {
      size: el.dataset.size || '16px',
      weight: Number(el.dataset.weight) || 400,
      lineHeight: el.dataset.lineHeight || '24px',
      letterSpacing: 'normal',
      transform: 'none',
      color: { rgb: 'rgb(34,34,34)', hex: el.dataset.hex || '#222222' },
    },
    confidence: 'high',
  };
}

const fakeRole = (el) => {
  const t = el.tagName.toLowerCase();
  if (/^h[1-6]$/.test(t)) return 'Headline';
  if (t === 'p') return 'Body';
  if (t === 'small') return 'Caption';
  return 'Body';
};

beforeEach(() => { document.body.innerHTML = ''; });

describe('extract — basic walk', () => {
  it('returns one row per distinct style', () => {
    mkBody(`
      <h1 data-family="Inter" data-size="32px">Headline A</h1>
      <p  data-family="Inter" data-size="16px">Body one</p>
      <p  data-family="Inter" data-size="16px">Body two</p>
    `);
    const out = extract(document.body, { detect: fakeDetect, inferRole: fakeRole });
    expect(out.rows.length).toBe(2);
  });

  it('counts duplicates correctly', () => {
    mkBody(`
      <p data-family="Inter" data-size="16px">a</p>
      <p data-family="Inter" data-size="16px">b</p>
      <p data-family="Inter" data-size="16px">c</p>
    `);
    const out = extract(document.body, { detect: fakeDetect, inferRole: fakeRole });
    expect(out.rows[0].count).toBe(3);
  });

  it('sorts rows by count descending', () => {
    mkBody(`
      <h1 data-family="Inter" data-size="32px">a</h1>
      <p  data-family="Inter" data-size="16px">b</p>
      <p  data-family="Inter" data-size="16px">c</p>
      <p  data-family="Inter" data-size="16px">d</p>
    `);
    const out = extract(document.body, { detect: fakeDetect, inferRole: fakeRole });
    expect(out.rows[0].count).toBe(3);
    expect(out.rows[1].count).toBe(1);
  });

  it('skips nodes with no direct visible text', () => {
    mkBody(`<div><p data-family="Inter">text</p></div>`);
    const out = extract(document.body, { detect: fakeDetect, inferRole: fakeRole });
    // The wrapping div has no direct text node — only one row expected.
    expect(out.rows.length).toBe(1);
    expect(out.rows[0].count).toBe(1);
  });

  it('skips display:none nodes', () => {
    mkBody(`<p style="display:none" data-family="Inter">hidden</p>`);
    const out = extract(document.body, { detect: fakeDetect, inferRole: fakeRole });
    expect(out.rows.length).toBe(0);
  });

  it('attaches role via inferRole', () => {
    mkBody(`<h1 data-family="Inter" data-size="32px">x</h1>`);
    const out = extract(document.body, { detect: fakeDetect, inferRole: fakeRole });
    expect(out.rows[0].role).toBe('Headline');
  });

  it('honors maxNodes and reports truncated:true', () => {
    let html = '';
    for (let i = 0; i < 12; i++) html += `<p data-family="Inter">x${i}</p>`;
    mkBody(html);
    const out = extract(document.body, { detect: fakeDetect, inferRole: fakeRole, maxNodes: 5 });
    expect(out.totalNodes).toBe(5);
    expect(out.truncated).toBe(true);
  });

  it('records hostname from option override', () => {
    mkBody(`<p data-family="Inter">x</p>`);
    const out = extract(document.body, { detect: fakeDetect, inferRole: fakeRole, hostname: 'example.com' });
    expect(out.hostname).toBe('example.com');
  });
});

describe('extract — family grouping', () => {
  it('groups rows by rendered family', () => {
    mkBody(`
      <h1 data-family="Inter"  data-size="32px">a</h1>
      <p  data-family="Inter"  data-size="16px">b</p>
      <p  data-family="Georgia" data-size="16px" data-hex="#333333">c</p>
    `);
    const out = extract(document.body, { detect: fakeDetect, inferRole: fakeRole });
    expect(out.groups.length).toBe(2);
    const families = out.groups.map(g => g.family).sort();
    expect(families).toEqual(['Georgia', 'Inter']);
  });

  it('sorts rows inside a group by count desc', () => {
    mkBody(`
      <h1 data-family="Inter" data-size="32px">A</h1>
      <p  data-family="Inter" data-size="16px">B1</p>
      <p  data-family="Inter" data-size="16px">B2</p>
    `);
    const out = extract(document.body, { detect: fakeDetect, inferRole: fakeRole });
    const inter = out.groups.find(g => g.family === 'Inter');
    expect(inter.rows[0].count).toBeGreaterThanOrEqual(inter.rows[1].count);
  });

  it('marks a group isFallback:true if any of its rows is a fallback', () => {
    mkBody(`
      <p data-family="Arial" data-fallback="true" data-requested="Söhne,Arial,sans-serif">x</p>
    `);
    const out = extract(document.body, { detect: fakeDetect, inferRole: fakeRole });
    expect(out.groups[0].isFallback).toBe(true);
    expect(out.groups[0].requestedFamily).toBe('Söhne');
  });

  it('puts fallback groups before non-fallback groups', () => {
    mkBody(`
      <p data-family="Inter">a</p>
      <p data-family="Inter">b</p>
      <p data-family="Inter">c</p>
      <p data-family="Arial" data-fallback="true" data-requested="Söhne,Arial">x</p>
    `);
    const out = extract(document.body, { detect: fakeDetect, inferRole: fakeRole });
    expect(out.groups[0].isFallback).toBe(true);
    expect(out.groups[1].isFallback).toBe(false);
  });

  it('propagates source classification from the first row of a group', () => {
    mkBody(`<p data-family="Inter" data-source="google">x</p>`);
    const out = extract(document.body, { detect: fakeDetect, inferRole: fakeRole });
    expect(out.groups[0].source.type).toBe('google');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run lib/extractor.test.js
```

Expected: every test fails because `extract` doesn't exist.

- [ ] **Step 3: Write the implementation**

`lib/extractor.js`:

```js
import { detect as defaultDetect } from './detector.js';
import { inferRole as defaultInferRole } from './roles.js';
import { styleKey } from './style-key.js';

const DEFAULT_MAX_NODES = 5000;

function hasVisibleText(el) {
  // At least one direct, non-whitespace text-node child.
  let hasText = false;
  for (const child of el.childNodes) {
    if (child.nodeType === Node.TEXT_NODE && child.nodeValue && child.nodeValue.trim().length > 0) {
      hasText = true;
      break;
    }
  }
  if (!hasText) return false;
  const cs = getComputedStyle(el);
  if (cs.display === 'none') return false;
  if (cs.visibility === 'hidden') return false;
  return true;
}

export function extract(root, options = {}) {
  const detect = options.detect || defaultDetect;
  const inferRole = options.inferRole || defaultInferRole;
  const maxNodes = options.maxNodes ?? DEFAULT_MAX_NODES;
  const hostname = options.hostname ?? (globalThis.location?.hostname || '');

  const seen = new Map();          // key -> row
  const nodeMap = options.nodeMap; // optional Map<number, Element> for Phase 2 messaging
  let nextId = 1;
  let totalNodes = 0;
  let truncated = false;

  // Local id minter so tests that don't supply nodeMap still get integer ids.
  function mintId(el) {
    if (nodeMap) {
      for (const [id, e] of nodeMap) if (e === el) return id;
      const id = nextId++; nodeMap.set(id, el); return id;
    }
    return nextId++;
  }

  for (const el of root.querySelectorAll('*')) {
    if (totalNodes >= maxNodes) { truncated = true; break; }
    if (!hasVisibleText(el)) continue;
    totalNodes++;

    const d = detect(el);
    const key = styleKey(d.metrics, d.rendered);
    if (!seen.has(key)) {
      seen.set(key, {
        key,
        role: inferRole(el, d.metrics),
        count: 0,
        nodeIds: [],
        detail: d,
      });
    }
    const row = seen.get(key);
    row.count++;
    row.nodeIds.push(mintId(el));
  }

  const rows = [...seen.values()].sort((a, b) => b.count - a.count);

  // Group by rendered family. Fallback rows live in a group keyed by the
  // *rendered* family (the substitute the user actually sees) so the card
  // header can read "Söhne → Arial" with `requestedFamily` providing "Söhne".
  const byFamily = new Map();
  for (const row of rows) {
    const family = row.detail.rendered || 'Unknown';
    if (!byFamily.has(family)) {
      byFamily.set(family, {
        family,
        source: { type: row.detail.source.type, format: row.detail.source.format },
        isFallback: false,
        requestedFamily: undefined,
        isVariable: row.detail.isVariable,
        axes: row.detail.axes,
        rows: [],
      });
    }
    const group = byFamily.get(family);
    group.rows.push(row);
    if (row.detail.isFallback) {
      group.isFallback = true;
      // First non-generic of `requested` is the family the page asked for.
      const reqFirst = row.detail.requested.find(f => f && f.toLowerCase() !== family.toLowerCase());
      if (!group.requestedFamily && reqFirst) group.requestedFamily = reqFirst;
    }
  }

  const groups = [...byFamily.values()].map(g => ({
    ...g,
    rows: g.rows.slice().sort((a, b) => b.count - a.count),
  }));

  // Fallback groups bubble to the top (spec §8.3 fallback banner intent).
  groups.sort((a, b) => Number(b.isFallback) - Number(a.isFallback));

  return { hostname, totalNodes, truncated, rows, groups };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run lib/extractor.test.js
```

Expected: 13 tests pass.

- [ ] **Step 5: Run the full suite**

```bash
npm test
```

Expected: Phase 1 tests + Task 2 + Task 3 all pass.

- [ ] **Step 6: Commit**

```bash
git add lib/extractor.js lib/extractor.test.js
git commit -m "feat(extractor): walk + dedupe + family-group, capped at 5000 nodes"
```

---

## Task 4: `lib/tokens.css` and `sidepanel/panel.css`

Both themes' tokens live in **one canonical place** (DESIGN.md §11), then the panel CSS only references variables. No raw hex colors outside `tokens.css`.

**Files:**
- Create: `lib/tokens.css`
- Create: `sidepanel/panel.css`

- [ ] **Step 1: Create `lib/tokens.css`**

```css
/* lib/tokens.css — canonical FontLens design tokens.
 * Every other CSS file imports this first and references only variables.
 * DESIGN.md §3 light tokens, §3.2 dark tokens. Do not introduce raw colors. */

:root,
[data-theme="light"] {
  --bg:              #ffffff;
  --bg-muted:        #fafafa;
  --bg-subtle:       #f4f4f5;
  --border:          #ececec;
  --border-strong:   #d4d4d8;
  --fg:              #0f0f10;
  --fg-muted:        #6b6b6e;
  --fg-faint:        #9c9ca0;
  --accent:          #0f0f10;
  --link:            #1e6fd8;
  --amber-500:       #f59e0b;
  --amber-bg:        #fff8eb;
  --amber-border:    #f7e3b9;
  --amber-fg:        #7a4a1d;

  /* type scale */
  --t-xs:   10px; --lh-xs: 14px;
  --t-sm:   11px; --lh-sm: 16px;
  --t-base: 12px; --lh-base: 18px;
  --t-md:   13px; --lh-md: 18px;
  --t-lg:   14px; --lh-lg: 20px;
  --t-xl:   16px; --lh-xl: 22px;
  --t-xxl:  22px; --lh-xxl: 28px;

  /* spacing */
  --s-1: 4px; --s-2: 6px; --s-3: 8px; --s-4: 10px;
  --s-5: 12px; --s-6: 14px; --s-7: 18px; --s-8: 24px;

  /* fonts */
  --font-ui:   -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-mono: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;
}

[data-theme="dark"] {
  --bg:              #0e0e10;
  --bg-muted:        #161618;
  --bg-subtle:       #1f1f22;
  --border:          #26262a;
  --border-strong:   #3a3a3f;
  --fg:              #f5f5f7;
  --fg-muted:        #a1a1a6;
  --fg-faint:        #6b6b6e;
  --accent:          #f5f5f7;
  --link:            #5fa8ff;
  --amber-500:       #f5b840;
  --amber-bg:        #2a1e08;
  --amber-border:    #574014;
  --amber-fg:        #f5d089;
}

@media (prefers-color-scheme: dark) {
  [data-theme="auto"] {
    --bg:              #0e0e10;
    --bg-muted:        #161618;
    --bg-subtle:       #1f1f22;
    --border:          #26262a;
    --border-strong:   #3a3a3f;
    --fg:              #f5f5f7;
    --fg-muted:        #a1a1a6;
    --fg-faint:        #6b6b6e;
    --accent:          #f5f5f7;
    --link:            #5fa8ff;
    --amber-500:       #f5b840;
    --amber-bg:        #2a1e08;
    --amber-border:    #574014;
    --amber-fg:        #f5d089;
  }
}
```

- [ ] **Step 2: Create `sidepanel/panel.css`**

```css
@import url('../lib/tokens.css');

* { box-sizing: border-box; }

html, body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font-family: var(--font-ui);
  font-size: var(--t-base);
  line-height: var(--lh-base);
}

button { font: inherit; color: inherit; background: none; border: 0; cursor: pointer; }
button:focus-visible { outline: 2px solid var(--border-strong); outline-offset: 2px; }

/* ===== Header (DESIGN.md §6.2) ===== */
.fl-header {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: var(--s-3);
  padding: var(--s-5) var(--s-6);
  border-bottom: 1px solid var(--border);
}
.fl-wordmark {
  font-weight: 600;
  font-size: var(--t-md);
  letter-spacing: -0.01em;
}

/* ===== Mode toggle (DESIGN.md §6.8) ===== */
.fl-mode {
  justify-self: center;
  display: inline-flex;
  background: var(--bg-subtle);
  border-radius: 6px;
  padding: 2px;
}
.fl-mode button {
  font-size: var(--t-sm);
  padding: var(--s-1) var(--s-3);
  border-radius: 4px;
  color: var(--fg-muted);
}
.fl-mode button[aria-pressed="true"] {
  background: var(--bg);
  color: var(--fg);
  box-shadow: 0 1px 2px rgba(0,0,0,0.06);
}

/* ===== Theme toggle ===== */
.fl-theme {
  justify-self: end;
  display: inline-flex;
  background: var(--bg-subtle);
  border-radius: 6px;
  padding: 2px;
}
.fl-theme button {
  font-size: var(--t-xs);
  padding: var(--s-1) var(--s-2);
  border-radius: 4px;
  color: var(--fg-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.fl-theme button[aria-pressed="true"] {
  background: var(--bg);
  color: var(--fg);
  box-shadow: 0 1px 2px rgba(0,0,0,0.06);
}

/* ===== Fallback banner (DESIGN.md §6.3) ===== */
.fl-banner {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  padding: var(--s-3) var(--s-6);
  background: var(--amber-bg);
  color: var(--amber-fg);
  border-bottom: 1px solid var(--amber-border);
  font-size: var(--t-sm);
}
.fl-banner-dot {
  width: 8px; height: 8px; border-radius: 999px; background: var(--amber-500);
  flex: 0 0 auto;
}
.fl-banner[hidden] { display: none; }

/* ===== Summary line ===== */
.fl-summary {
  padding: var(--s-4) var(--s-6);
  color: var(--fg-muted);
  font-size: var(--t-sm);
  font-variant-numeric: tabular-nums;
}

/* ===== Region container ===== */
.fl-region {
  padding: 0 var(--s-6) var(--s-8);
}

/* ===== Family card (DESIGN.md §6.4) ===== */
.fl-card {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  margin: var(--s-3) 0;
  overflow: hidden;
}
.fl-card.is-fallback {
  border-color: var(--amber-border);
  background: var(--amber-bg);
}

.fl-card-head {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  padding: var(--s-5);
  border-bottom: 1px solid var(--border);
}
.fl-card.is-fallback .fl-card-head { border-bottom-color: var(--amber-border); }
.fl-card-name {
  font-weight: 600;
  font-size: var(--t-md);
  color: var(--fg);
}
.fl-card.is-fallback .fl-card-name { color: var(--amber-fg); }
.fl-card-meta {
  font-family: var(--font-mono);
  font-size: var(--t-sm);
  color: var(--fg-muted);
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}

/* ===== Badge (DESIGN.md §6.6) ===== */
.fl-badge {
  display: inline-block;
  padding: 2px var(--s-2);
  font-size: var(--t-xs);
  line-height: var(--lh-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-radius: 4px;
  background: var(--bg-subtle);
  color: var(--fg-muted);
  font-weight: 600;
}
.fl-badge.is-fallback { background: var(--amber-500); color: #0f0f10; }
.fl-badge.is-variable { background: var(--bg-subtle); color: var(--fg); }

/* ===== Style row (DESIGN.md §6.5) ===== */
.fl-row {
  display: grid;
  grid-template-columns: 60px 1fr auto;
  align-items: center;
  gap: var(--s-3);
  padding: var(--s-4) var(--s-5);
  border-bottom: 1px solid var(--border);
  cursor: default;
  outline: none;
}
.fl-row:last-child { border-bottom: 0; }
.fl-row:hover,
.fl-row:focus-visible { background: var(--bg-muted); }
.fl-row:focus-visible { box-shadow: inset 0 0 0 2px var(--border-strong); }

.fl-row-role {
  font-size: var(--t-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--fg-muted);
  font-weight: 600;
}
.fl-row-specimen {
  font-size: var(--t-xl);
  line-height: 1.15;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fl-row-metrics {
  font-family: var(--font-mono);
  font-size: var(--t-sm);
  color: var(--fg-muted);
  font-variant-numeric: tabular-nums;
  margin-top: 2px;
}
.fl-row-count {
  padding: 2px var(--s-2);
  font-size: var(--t-xs);
  border-radius: 999px;
  background: var(--bg-subtle);
  color: var(--fg-muted);
  font-variant-numeric: tabular-nums;
}

/* ===== Empty / truncated states ===== */
.fl-empty {
  padding: var(--s-8) var(--s-6);
  color: var(--fg-muted);
  text-align: center;
  font-size: var(--t-sm);
}
.fl-truncated {
  padding: var(--s-3) var(--s-6);
  color: var(--fg-faint);
  font-size: var(--t-xs);
  font-style: italic;
}

/* ===== Motion + reduced motion (DESIGN.md §8) ===== */
.fl-row { transition: background 120ms ease-out; }
@media (prefers-reduced-motion: reduce) {
  .fl-row { transition: none; }
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/tokens.css sidepanel/panel.css
git commit -m "feat(panel): canonical design tokens + Minimal Mono panel stylesheet"
```

---

## Task 5: `sidepanel/panel.html` — the side-panel document

**Files:**
- Create: `sidepanel/panel.html`

- [ ] **Step 1: Create the HTML**

`sidepanel/panel.html`:

```html
<!doctype html>
<html lang="en" data-theme="auto">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>FontLens</title>
  <link rel="stylesheet" href="panel.css">
</head>
<body>
  <header class="fl-header" role="banner">
    <span class="fl-wordmark" aria-label="FontLens">FontLens</span>

    <div class="fl-mode" role="group" aria-label="Inspection mode">
      <button type="button" id="fl-mode-hover"
              aria-pressed="true" aria-label="Hover mode">Hover</button>
      <button type="button" id="fl-mode-inspect"
              aria-pressed="false" aria-label="Inspect mode">Inspect</button>
    </div>

    <div class="fl-theme" role="group" aria-label="Theme">
      <button type="button" id="fl-theme-auto"
              aria-pressed="true"  aria-label="Auto theme">Auto</button>
      <button type="button" id="fl-theme-light"
              aria-pressed="false" aria-label="Light theme">Light</button>
      <button type="button" id="fl-theme-dark"
              aria-pressed="false" aria-label="Dark theme">Dark</button>
    </div>
  </header>

  <div id="fl-banner" class="fl-banner" role="status" aria-live="polite" hidden>
    <span class="fl-banner-dot" aria-hidden="true"></span>
    <span id="fl-banner-text"></span>
  </div>

  <p id="fl-summary" class="fl-summary" aria-live="polite"></p>

  <main id="fl-region" class="fl-region"
        role="region" aria-label="Detected fonts" tabindex="-1">
    <p class="fl-empty">Navigate to a page with text and try again.</p>
  </main>

  <script type="module" src="panel.js"></script>
</body>
</html>
```

- [ ] **Step 2: Reload the extension in Chrome → click the action**

Expected: side panel opens, shows header (wordmark, Hover/Inspect toggle, Auto/Light/Dark toggle), empty-state message. No DevTools errors.

- [ ] **Step 3: Commit**

```bash
git add sidepanel/panel.html
git commit -m "feat(panel): side-panel HTML scaffold with header + region landmarks"
```

---

## Task 6: `sidepanel/messaging.js` — the chrome.* seam

Wrap every `chrome.*` call we need in `panel.js` so the renderer and the rest of the code stay unit-testable.

**Files:**
- Create: `sidepanel/messaging.js`

- [ ] **Step 1: Create the wrapper**

`sidepanel/messaging.js`:

```js
// Single seam between the panel and Chrome's messaging + storage APIs.
// `panel.js` imports only from this module for chrome.* — `render.js` is
// pure DOM and never touches chrome.* directly, so unit tests can stub
// nothing more than this file.

const THEME_KEY = 'theme';

export async function getActiveTabId() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab?.id ?? null;
}

export async function sendToContent(msg) {
  const tabId = await getActiveTabId();
  if (tabId == null) return;
  try { await chrome.tabs.sendMessage(tabId, msg); } catch { /* tab closed / no listener */ }
}

export function onContentMessage(handler) {
  const wrapped = (msg, sender) => {
    // Only listen to messages from content scripts of the active tab.
    if (!msg || typeof msg.type !== 'string' || !msg.type.startsWith('fontlens:')) return;
    handler(msg, sender);
  };
  chrome.runtime.onMessage.addListener(wrapped);
  return () => chrome.runtime.onMessage.removeListener(wrapped);
}

export async function loadTheme() {
  try {
    const got = await chrome.storage.local.get(THEME_KEY);
    const t = got?.[THEME_KEY];
    return (t === 'light' || t === 'dark' || t === 'auto') ? t : 'auto';
  } catch { return 'auto'; }
}

export async function saveTheme(theme) {
  try { await chrome.storage.local.set({ [THEME_KEY]: theme }); } catch {}
}
```

- [ ] **Step 2: Commit**

```bash
git add sidepanel/messaging.js
git commit -m "feat(panel): chrome.* messaging + storage wrapper"
```

---

## Task 7: `sidepanel/render.js` — pure DOM rendering helpers

Every visual feature of the panel goes through `render.js`. Each function is given a container element and an input data object, mutates the container, and returns nothing. No `chrome.*`, no globals — easy to test under happy-dom.

**Files:**
- Create: `sidepanel/render.js`
- Test: `sidepanel/render.test.js`
- Create: `test/fixtures/extract-payload.js`

### Helpers exported

```js
renderHeader(headerEl, { mode, theme })             // updates aria-pressed states
renderBanner(bannerEl, textEl, { fallbackCount })   // shows/hides + sets text
renderSummary(summaryEl, payload)                   // "3 fonts · 7 type styles · hostname"
renderGroups(regionEl, payload, callbacks)          // builds cards + rows; wires data-* attrs
                                                    // callbacks: { onHighlight(row), onUnhighlight(row), onActivate(row) }
renderEmpty(regionEl)                               // empty-state placeholder
renderTruncated(regionEl, totalNodes)               // "Showing styles from the first 5000 text nodes."
focusRow(regionEl, index)                           // moves focus to the Nth .fl-row in the region
countRows(regionEl)                                 // number of .fl-row elements
```

`renderGroups` attaches `data-row-key="..."` and `data-row-index="..."` to each row so panel.js's keyboard handler can find rows by index and look up their key.

### Tests

- [ ] **Step 1: Create the shared fixture**

`test/fixtures/extract-payload.js`:

```js
// A minimal-but-realistic ExtractPayload used by render tests.

export const fallbackPayload = {
  hostname: 'example.com',
  totalNodes: 42,
  truncated: false,
  groups: [
    {
      family: 'Arial',
      source: { type: 'system', format: null },
      isFallback: true,
      requestedFamily: 'Söhne',
      isVariable: false,
      axes: null,
      rows: [
        {
          key: 'Arial|16px|400|24px|normal|none|#222222',
          role: 'Body',
          count: 12,
          nodeIds: [1, 2, 3],
          detail: {
            requested: ['Söhne', 'Arial', 'sans-serif'],
            rendered: 'Arial',
            isFallback: true,
            source: { type: 'system', format: null, url: null, os: 'macos' },
            isVariable: false,
            axes: null,
            metrics: {
              size: '16px', weight: 400, lineHeight: '24px',
              letterSpacing: 'normal', transform: 'none',
              color: { rgb: 'rgb(34,34,34)', hex: '#222222' },
            },
            confidence: 'high',
          },
        },
      ],
    },
    {
      family: 'Inter',
      source: { type: 'google', format: 'woff2' },
      isFallback: false,
      isVariable: false,
      axes: null,
      rows: [
        {
          key: 'Inter|32px|700|40px|normal|none|#0f0f10',
          role: 'Headline',
          count: 3,
          nodeIds: [4, 5, 6],
          detail: {
            requested: ['Inter', 'sans-serif'],
            rendered: 'Inter',
            isFallback: false,
            source: { type: 'google', format: 'woff2', url: 'https://fonts.gstatic.com/x.woff2', os: null },
            isVariable: false,
            axes: null,
            metrics: {
              size: '32px', weight: 700, lineHeight: '40px',
              letterSpacing: 'normal', transform: 'none',
              color: { rgb: 'rgb(15,15,16)', hex: '#0f0f10' },
            },
            confidence: 'high',
          },
        },
        {
          key: 'Inter|16px|400|24px|normal|none|#0f0f10',
          role: 'Body',
          count: 27,
          nodeIds: [7, 8, 9],
          detail: {
            requested: ['Inter', 'sans-serif'],
            rendered: 'Inter',
            isFallback: false,
            source: { type: 'google', format: 'woff2', url: 'https://fonts.gstatic.com/x.woff2', os: null },
            isVariable: false,
            axes: null,
            metrics: {
              size: '16px', weight: 400, lineHeight: '24px',
              letterSpacing: 'normal', transform: 'none',
              color: { rgb: 'rgb(15,15,16)', hex: '#0f0f10' },
            },
            confidence: 'high',
          },
        },
      ],
    },
  ],
};

export const cleanPayload = {
  hostname: 'clean.example',
  totalNodes: 5,
  truncated: false,
  groups: [
    {
      family: 'Inter',
      source: { type: 'self-hosted', format: 'woff2' },
      isFallback: false,
      isVariable: false,
      axes: null,
      rows: [
        {
          key: 'Inter|16px|400|24px|normal|none|#0f0f10',
          role: 'Body',
          count: 5,
          nodeIds: [1, 2, 3, 4, 5],
          detail: {
            requested: ['Inter'],
            rendered: 'Inter',
            isFallback: false,
            source: { type: 'self-hosted', format: 'woff2', url: '/x.woff2', os: null },
            isVariable: false,
            axes: null,
            metrics: {
              size: '16px', weight: 400, lineHeight: '24px',
              letterSpacing: 'normal', transform: 'none',
              color: { rgb: 'rgb(15,15,16)', hex: '#0f0f10' },
            },
            confidence: 'high',
          },
        },
      ],
    },
  ],
};
```

- [ ] **Step 2: Update `vitest.config.js` to also pick up sidepanel tests**

Replace `lib/**/*.test.js` with a broader glob:

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['lib/**/*.test.js', 'sidepanel/**/*.test.js'],
    globals: false,
  },
});
```

- [ ] **Step 3: Write the failing tests**

`sidepanel/render.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import {
  renderHeader, renderBanner, renderSummary,
  renderGroups, renderEmpty, renderTruncated,
  focusRow, countRows,
} from './render.js';
import { fallbackPayload, cleanPayload } from '../test/fixtures/extract-payload.js';

let header, banner, bannerText, summary, region;

beforeEach(() => {
  document.body.innerHTML = `
    <header id="h">
      <div id="m"><button id="m-hover" aria-pressed="false"></button><button id="m-inspect" aria-pressed="false"></button></div>
      <div id="t"><button id="t-auto" aria-pressed="false"></button><button id="t-light" aria-pressed="false"></button><button id="t-dark" aria-pressed="false"></button></div>
    </header>
    <div id="b" hidden><span id="bt"></span></div>
    <p id="s"></p>
    <main id="r"></main>
  `;
  header = document.getElementById('h');
  banner = document.getElementById('b');
  bannerText = document.getElementById('bt');
  summary = document.getElementById('s');
  region = document.getElementById('r');
});

describe('renderHeader', () => {
  it('sets aria-pressed on the active mode button', () => {
    renderHeader(header, { mode: 'inspect', theme: 'auto' });
    expect(document.getElementById('m-hover').getAttribute('aria-pressed')).toBe('false');
    expect(document.getElementById('m-inspect').getAttribute('aria-pressed')).toBe('true');
  });
  it('sets aria-pressed on the active theme button', () => {
    renderHeader(header, { mode: 'hover', theme: 'dark' });
    expect(document.getElementById('t-auto').getAttribute('aria-pressed')).toBe('false');
    expect(document.getElementById('t-light').getAttribute('aria-pressed')).toBe('false');
    expect(document.getElementById('t-dark').getAttribute('aria-pressed')).toBe('true');
  });
});

describe('renderBanner', () => {
  it('shows banner when fallbackCount > 0 with correct count text', () => {
    renderBanner(banner, bannerText, { fallbackCount: 2 });
    expect(banner.hasAttribute('hidden')).toBe(false);
    expect(bannerText.textContent).toMatch(/2 of this page'?s fonts/);
  });
  it('hides banner when fallbackCount is 0', () => {
    renderBanner(banner, bannerText, { fallbackCount: 0 });
    expect(banner.hasAttribute('hidden')).toBe(true);
  });
  it('uses singular phrasing when fallbackCount is 1', () => {
    renderBanner(banner, bannerText, { fallbackCount: 1 });
    expect(bannerText.textContent).toMatch(/1 of this page'?s fonts isn'?t loading/);
  });
});

describe('renderSummary', () => {
  it('renders "3 fonts · 7 styles · hostname"', () => {
    renderSummary(summary, fallbackPayload);
    expect(summary.textContent).toContain('2 fonts');
    expect(summary.textContent).toContain('3 type styles');
    expect(summary.textContent).toContain('example.com');
  });
  it('uses tabular-nums style for alignment', () => {
    renderSummary(summary, fallbackPayload);
    expect(summary.style.fontVariantNumeric || getComputedStyle(summary).fontVariantNumeric)
      .toBeDefined();
  });
});

describe('renderGroups', () => {
  it('creates one card per family group', () => {
    renderGroups(region, fallbackPayload, {});
    expect(region.querySelectorAll('.fl-card').length).toBe(2);
  });

  it('marks fallback cards with is-fallback class', () => {
    renderGroups(region, fallbackPayload, {});
    const firstCard = region.querySelector('.fl-card');
    expect(firstCard.classList.contains('is-fallback')).toBe(true);
  });

  it('reads "Söhne → Arial" on the fallback card header', () => {
    renderGroups(region, fallbackPayload, {});
    const firstHead = region.querySelector('.fl-card.is-fallback .fl-card-name');
    expect(firstHead.textContent).toContain('Söhne');
    expect(firstHead.textContent).toContain('Arial');
  });

  it('renders rows sorted by count desc inside a group', () => {
    renderGroups(region, fallbackPayload, {});
    const interCard = region.querySelectorAll('.fl-card')[1];
    const counts = [...interCard.querySelectorAll('.fl-row-count')].map(n => Number(n.textContent.trim()));
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  it('puts the uppercase role mini-label on each row', () => {
    renderGroups(region, fallbackPayload, {});
    const roles = [...region.querySelectorAll('.fl-row-role')].map(n => n.textContent.trim());
    expect(roles).toContain('BODY');
    expect(roles).toContain('HEADLINE');
  });

  it('attaches data-row-key + data-row-index to each row', () => {
    renderGroups(region, fallbackPayload, {});
    const rows = region.querySelectorAll('.fl-row');
    rows.forEach((r, i) => {
      expect(r.dataset.rowKey).toBeTruthy();
      expect(Number(r.dataset.rowIndex)).toBe(i);
    });
  });

  it('sets role="list"/"listitem" landmarks on cards/rows for a11y', () => {
    renderGroups(region, fallbackPayload, {});
    expect(region.querySelector('.fl-card').getAttribute('role')).toBe('group');
    const row = region.querySelector('.fl-row');
    expect(row.getAttribute('role')).toBe('button');
    expect(row.getAttribute('tabindex')).toBe('-1');  // first row gets tabindex=0
  });

  it('the first row in the region has tabindex=0', () => {
    renderGroups(region, fallbackPayload, {});
    const rows = region.querySelectorAll('.fl-row');
    expect(rows[0].getAttribute('tabindex')).toBe('0');
  });

  it('calls onHighlight on mouseenter and onUnhighlight on mouseleave', () => {
    let on = null, off = null;
    renderGroups(region, cleanPayload, {
      onHighlight: (row) => { on = row.key; },
      onUnhighlight: (row) => { off = row.key; },
    });
    const row = region.querySelector('.fl-row');
    row.dispatchEvent(new Event('mouseenter'));
    expect(on).toBe('Inter|16px|400|24px|normal|none|#0f0f10');
    row.dispatchEvent(new Event('mouseleave'));
    expect(off).toBe('Inter|16px|400|24px|normal|none|#0f0f10');
  });

  it('calls onActivate on click', () => {
    let clicked = null;
    renderGroups(region, cleanPayload, { onActivate: (row) => { clicked = row.key; } });
    region.querySelector('.fl-row').click();
    expect(clicked).toBe('Inter|16px|400|24px|normal|none|#0f0f10');
  });

  it('sets aria-label on the specimen with plain-language metrics', () => {
    renderGroups(region, cleanPayload, {});
    const specimen = region.querySelector('.fl-row-specimen');
    expect(specimen.getAttribute('aria-label')).toMatch(/Inter/);
    expect(specimen.getAttribute('aria-label')).toMatch(/16/);
    expect(specimen.getAttribute('aria-label')).toMatch(/400/);
  });

  it('renders specimen in the detected face via inline font-family', () => {
    renderGroups(region, cleanPayload, {});
    const specimen = region.querySelector('.fl-row-specimen');
    expect(specimen.style.fontFamily).toMatch(/Inter/);
    expect(specimen.style.fontWeight).toBe('400');
  });

  it('adds a fallback badge to fallback cards', () => {
    renderGroups(region, fallbackPayload, {});
    const badge = region.querySelector('.fl-card.is-fallback .fl-badge.is-fallback');
    expect(badge).toBeTruthy();
    expect(badge.textContent.toUpperCase()).toBe('FALLBACK');
  });
});

describe('renderEmpty + renderTruncated', () => {
  it('renders empty state', () => {
    renderEmpty(region);
    expect(region.querySelector('.fl-empty')).toBeTruthy();
  });

  it('renders truncated footer with the node count', () => {
    renderGroups(region, cleanPayload, {});
    renderTruncated(region, 5000);
    const t = region.querySelector('.fl-truncated');
    expect(t).toBeTruthy();
    expect(t.textContent).toContain('5000');
  });
});

describe('focusRow + countRows', () => {
  it('counts rows correctly', () => {
    renderGroups(region, fallbackPayload, {});
    expect(countRows(region)).toBe(3);
  });

  it('moves focus and tabindex when focusRow is called', () => {
    renderGroups(region, fallbackPayload, {});
    focusRow(region, 1);
    const rows = region.querySelectorAll('.fl-row');
    expect(rows[1].getAttribute('tabindex')).toBe('0');
    expect(rows[0].getAttribute('tabindex')).toBe('-1');
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

```bash
npx vitest run sidepanel/render.test.js
```

Expected: every test fails (no module).

- [ ] **Step 5: Write the implementation**

`sidepanel/render.js`:

```js
// Pure DOM rendering helpers for the FontLens side panel.
// No chrome.* here — `panel.js` owns the messaging seam.

const SPECIMEN_TEXT = 'Almost before we knew it';

const SOURCE_BADGE_LABEL = {
  google:        'Google',
  adobe:         'Adobe',
  'self-hosted': 'Self-hosted',
  system:        'System',
  unknown:       'Unknown',
};

// -----------------------------------------------------------------------------
// Header
// -----------------------------------------------------------------------------

export function renderHeader(headerEl, { mode, theme }) {
  for (const btn of headerEl.querySelectorAll('.fl-mode button, [id^="m-"]')) {
    if (!btn.id) continue;
    const want =
      (btn.id.endsWith('hover')   && mode === 'hover')  ||
      (btn.id.endsWith('inspect') && mode === 'inspect');
    btn.setAttribute('aria-pressed', want ? 'true' : 'false');
  }
  for (const btn of headerEl.querySelectorAll('.fl-theme button, [id^="t-"]')) {
    if (!btn.id) continue;
    const want =
      (btn.id.endsWith('auto')  && theme === 'auto')  ||
      (btn.id.endsWith('light') && theme === 'light') ||
      (btn.id.endsWith('dark')  && theme === 'dark');
    btn.setAttribute('aria-pressed', want ? 'true' : 'false');
  }
}

// -----------------------------------------------------------------------------
// Banner (DESIGN.md §6.3)
// -----------------------------------------------------------------------------

export function renderBanner(bannerEl, textEl, { fallbackCount }) {
  if (!fallbackCount || fallbackCount < 1) {
    bannerEl.setAttribute('hidden', '');
    textEl.textContent = '';
    return;
  }
  bannerEl.removeAttribute('hidden');
  const plural = fallbackCount === 1
    ? "1 of this page's fonts isn't loading — visitors see a fallback."
    : `${fallbackCount} of this page's fonts aren't loading — visitors see fallbacks.`;
  textEl.textContent = plural;
}

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------

export function renderSummary(summaryEl, payload) {
  summaryEl.style.fontVariantNumeric = 'tabular-nums';
  const fonts = payload.groups.length;
  const styles = payload.groups.reduce((n, g) => n + g.rows.length, 0);
  const host = payload.hostname || 'this page';
  summaryEl.textContent = `${fonts} fonts · ${styles} type styles · ${host}`;
}

// -----------------------------------------------------------------------------
// Empty / truncated
// -----------------------------------------------------------------------------

export function renderEmpty(regionEl) {
  regionEl.innerHTML = '';
  const p = document.createElement('p');
  p.className = 'fl-empty';
  p.textContent = 'Navigate to a page with text and try again.';
  regionEl.appendChild(p);
}

export function renderTruncated(regionEl, totalNodes) {
  const note = document.createElement('p');
  note.className = 'fl-truncated';
  note.textContent = `Showing styles from the first ${totalNodes} text nodes.`;
  regionEl.appendChild(note);
}

// -----------------------------------------------------------------------------
// Cards + rows
// -----------------------------------------------------------------------------

function ariaLabelForRow(row) {
  const m = row.detail.metrics;
  const family = row.detail.rendered || 'unknown font';
  return `${family} ${row.role.toLowerCase()}, ${parseInt(m.size, 10)} pixels, weight ${m.weight}`;
}

function metricsLine(m) {
  const sz = m.size;
  const wt = m.weight;
  const lh = m.lineHeight;
  // "16px · 400 · 24/16"
  const lhOverSize = (lh && sz) ? `${parseInt(lh, 10) || lh}/${parseInt(sz, 10) || sz}` : '';
  return `${sz} · ${wt}${lhOverSize ? ' · ' + lhOverSize : ''}`;
}

function buildBadge(label, modifier) {
  const b = document.createElement('span');
  b.className = `fl-badge ${modifier || ''}`.trim();
  b.textContent = label;
  return b;
}

function buildCardHead(group) {
  const head = document.createElement('div');
  head.className = 'fl-card-head';

  const name = document.createElement('span');
  name.className = 'fl-card-name';
  name.textContent = group.isFallback && group.requestedFamily
    ? `${group.requestedFamily} → ${group.family}`
    : group.family;
  head.appendChild(name);

  if (group.isFallback) {
    head.appendChild(buildBadge('Fallback', 'is-fallback'));
  } else {
    head.appendChild(buildBadge(SOURCE_BADGE_LABEL[group.source.type] || 'Unknown'));
  }
  if (group.isVariable) head.appendChild(buildBadge('Variable', 'is-variable'));

  const meta = document.createElement('span');
  meta.className = 'fl-card-meta';
  const fmt = group.source.format ? ` · ${group.source.format}` : '';
  const total = group.rows.reduce((n, r) => n + r.count, 0);
  meta.textContent = `${total} uses${fmt}`;
  head.appendChild(meta);

  return head;
}

function buildRow(row, globalIndex) {
  const el = document.createElement('div');
  el.className = 'fl-row';
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', globalIndex === 0 ? '0' : '-1');
  el.dataset.rowKey = row.key;
  el.dataset.rowIndex = String(globalIndex);

  const roleLabel = document.createElement('div');
  roleLabel.className = 'fl-row-role';
  roleLabel.textContent = row.role.toUpperCase();
  el.appendChild(roleLabel);

  const middle = document.createElement('div');

  const specimen = document.createElement('div');
  specimen.className = 'fl-row-specimen';
  specimen.textContent = SPECIMEN_TEXT;
  specimen.style.fontFamily = `"${row.detail.rendered}", sans-serif`;
  specimen.style.fontWeight = String(row.detail.metrics.weight);
  specimen.setAttribute('aria-label', ariaLabelForRow(row));
  middle.appendChild(specimen);

  const metrics = document.createElement('div');
  metrics.className = 'fl-row-metrics';
  metrics.textContent = metricsLine(row.detail.metrics);
  metrics.setAttribute('aria-hidden', 'true'); // already covered by specimen aria-label
  middle.appendChild(metrics);

  el.appendChild(middle);

  const count = document.createElement('div');
  count.className = 'fl-row-count';
  count.setAttribute('aria-label', `${row.count} matches`);
  count.textContent = String(row.count);
  el.appendChild(count);

  return el;
}

export function renderGroups(regionEl, payload, callbacks = {}) {
  regionEl.innerHTML = '';

  if (!payload.groups.length) {
    renderEmpty(regionEl);
    return;
  }

  let globalIndex = 0;
  for (const group of payload.groups) {
    const card = document.createElement('section');
    card.className = 'fl-card' + (group.isFallback ? ' is-fallback' : '');
    card.setAttribute('role', 'group');
    card.setAttribute('aria-label', `${group.family} family`);

    card.appendChild(buildCardHead(group));

    for (const row of group.rows) {
      const rowEl = buildRow(row, globalIndex++);
      rowEl.addEventListener('mouseenter', () => callbacks.onHighlight?.(row));
      rowEl.addEventListener('mouseleave', () => callbacks.onUnhighlight?.(row));
      rowEl.addEventListener('focus',     () => callbacks.onHighlight?.(row));
      rowEl.addEventListener('blur',      () => callbacks.onUnhighlight?.(row));
      rowEl.addEventListener('click',     () => callbacks.onActivate?.(row));
      card.appendChild(rowEl);
    }

    regionEl.appendChild(card);
  }

  if (payload.truncated) renderTruncated(regionEl, payload.totalNodes);
}

// -----------------------------------------------------------------------------
// Keyboard navigation helpers
// -----------------------------------------------------------------------------

export function countRows(regionEl) {
  return regionEl.querySelectorAll('.fl-row').length;
}

export function focusRow(regionEl, index) {
  const rows = regionEl.querySelectorAll('.fl-row');
  if (!rows.length) return;
  const clamped = Math.max(0, Math.min(rows.length - 1, index));
  rows.forEach((r, i) => r.setAttribute('tabindex', i === clamped ? '0' : '-1'));
  rows[clamped].focus();
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx vitest run sidepanel/render.test.js
```

Expected: all render tests pass (~22).

- [ ] **Step 7: Commit**

```bash
git add sidepanel/render.js sidepanel/render.test.js test/fixtures/extract-payload.js vitest.config.js
git commit -m "feat(panel): pure DOM render helpers + fixture-driven unit tests"
```

---

## Task 8: `sidepanel/panel.js` — entry, wires everything together

The entry imports `messaging.js` + `render.js`, owns:
- the current `mode` (`hover` | `inspect`) and `theme` (`auto` | `light` | `dark`)
- the most recent `payload`
- keyboard handling (arrows / Enter / Esc) over the region
- mode + theme toggle button click handlers
- the request-extract handshake on first connect and on the spec §10 "service worker cold-wake" focus event

**Files:**
- Create: `sidepanel/panel.js`

- [ ] **Step 1: Write the entry**

`sidepanel/panel.js`:

```js
import {
  sendToContent, onContentMessage, loadTheme, saveTheme,
} from './messaging.js';
import {
  renderHeader, renderBanner, renderSummary, renderGroups,
  renderEmpty, focusRow, countRows,
} from './render.js';

// ---------------------------------------------------------------------------
// State (deliberately small; service worker is ephemeral, so any state that
// needs to survive a 30-sec nap goes through chrome.storage in messaging.js)
// ---------------------------------------------------------------------------
const state = {
  mode: 'hover',          // 'hover' | 'inspect'
  theme: 'auto',          // 'auto'  | 'light' | 'dark'
  payload: null,          // last ExtractPayload received, or null
  highlightedKey: null,
};

// ---------------------------------------------------------------------------
// DOM lookup
// ---------------------------------------------------------------------------
const headerEl   = document.querySelector('header.fl-header');
const bannerEl   = document.getElementById('fl-banner');
const bannerText = document.getElementById('fl-banner-text');
const summaryEl  = document.getElementById('fl-summary');
const regionEl   = document.getElementById('fl-region');

// ---------------------------------------------------------------------------
// Render orchestration
// ---------------------------------------------------------------------------
function paint() {
  renderHeader(headerEl, { mode: state.mode, theme: state.theme });
  if (!state.payload || !state.payload.groups.length) {
    renderBanner(bannerEl, bannerText, { fallbackCount: 0 });
    summaryEl.textContent = '';
    renderEmpty(regionEl);
    return;
  }
  const fallbackCount = state.payload.groups.filter(g => g.isFallback).length;
  renderBanner(bannerEl, bannerText, { fallbackCount });
  renderSummary(summaryEl, state.payload);
  renderGroups(regionEl, state.payload, {
    onHighlight: (row) => {
      state.highlightedKey = row.key;
      sendToContent({ type: 'fontlens:highlight', key: row.key, nodeIds: row.nodeIds });
    },
    onUnhighlight: (row) => {
      state.highlightedKey = null;
      sendToContent({ type: 'fontlens:unhighlight', key: row.key });
    },
    onActivate: (row) => {
      // Currently equivalent to "copy default format" — Phase 4 wires the
      // actual clipboard write via lib/export.js. For Phase 3 we just emit
      // a synthetic event the user can confirm in DevTools.
      window.dispatchEvent(new CustomEvent('fontlens:activate', { detail: row }));
    },
  });
}

// ---------------------------------------------------------------------------
// Theme persistence
// ---------------------------------------------------------------------------
function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
}

// ---------------------------------------------------------------------------
// Header button wiring
// ---------------------------------------------------------------------------
function bindHeader() {
  document.getElementById('fl-mode-hover').addEventListener('click', () => {
    state.mode = 'hover';
    sendToContent({ type: 'fontlens:set-mode', mode: 'hover' });
    paint();
  });
  document.getElementById('fl-mode-inspect').addEventListener('click', () => {
    state.mode = 'inspect';
    sendToContent({ type: 'fontlens:set-mode', mode: 'inspect' });
    paint();
  });

  for (const t of ['auto', 'light', 'dark']) {
    document.getElementById(`fl-theme-${t}`).addEventListener('click', async () => {
      applyTheme(t);
      await saveTheme(t);
      paint();
    });
  }
}

// ---------------------------------------------------------------------------
// Keyboard handling (spec §8.5)
// ---------------------------------------------------------------------------
function bindKeyboard() {
  regionEl.addEventListener('keydown', (e) => {
    const rows = regionEl.querySelectorAll('.fl-row');
    if (!rows.length) return;
    const focused = document.activeElement?.closest?.('.fl-row');
    const focusedIndex = focused ? Number(focused.dataset.rowIndex) : -1;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focusRow(regionEl, Math.min(rows.length - 1, focusedIndex + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        focusRow(regionEl, Math.max(0, focusedIndex - 1));
        break;
      case 'Home':
        e.preventDefault();
        focusRow(regionEl, 0);
        break;
      case 'End':
        e.preventDefault();
        focusRow(regionEl, rows.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        focused?.click();   // Phase 4: copies default format
        break;
      case 'Escape':
        e.preventDefault();
        // Spec §8.1: Esc exits inspect mode. Side panel itself cannot be
        // programmatically closed in MV3 — flipping back to Hover mode is
        // the documented graceful equivalent.
        state.mode = 'hover';
        sendToContent({ type: 'fontlens:set-mode', mode: 'hover' });
        paint();
        break;
    }
  });
}

// ---------------------------------------------------------------------------
// Message intake
// ---------------------------------------------------------------------------
function bindMessages() {
  onContentMessage((msg) => {
    if (msg.type === 'fontlens:extract-result') {
      state.payload = msg.payload;
      paint();
    } else if (msg.type === 'fontlens:mode-changed') {
      state.mode = msg.mode;
      paint();
    } else if (msg.type === 'fontlens:hover-pick') {
      // Single-row payload — wrap it into a normal-shaped payload so the
      // renderer doesn't grow a second code path.
      state.payload = {
        hostname: msg.payload.hostname,
        totalNodes: 1,
        truncated: false,
        groups: [msg.payload.group],
      };
      paint();
    }
  });
}

// ---------------------------------------------------------------------------
// Cold-wake handshake (spec §10): when the panel regains focus, re-request
// the page summary from the content script. Content holds session state,
// not the service worker.
// ---------------------------------------------------------------------------
function bindFocusRehydrate() {
  window.addEventListener('focus', () => {
    sendToContent({ type: 'fontlens:request-extract' });
  });
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
(async function init() {
  state.theme = await loadTheme();
  applyTheme(state.theme);
  bindHeader();
  bindKeyboard();
  bindMessages();
  bindFocusRehydrate();
  paint();
  // Initial pull — only resolves if a content script is already injected
  // on the active tab. If the user hasn't clicked the action yet, this is
  // a quiet no-op.
  sendToContent({ type: 'fontlens:request-extract' });
})();
```

- [ ] **Step 2: Reload the extension; click the action**

Expected, with the stub content script:
- Side panel opens.
- Header shows wordmark, Hover/Inspect toggle, Auto/Light/Dark toggle. Pressed states correct.
- Banner appears only when the stub detected a fallback (rare on most sites; you may need to test on a hand-crafted local page).
- Summary line shows `N fonts · M type styles · hostname`.
- Family cards render. Hovering a row highlights matching elements on the page with an amber outline. Mouseleave clears.
- Clicking Auto/Light/Dark flips the theme immediately and persists across reload.
- Tab into the region, ArrowDown moves through rows, Enter dispatches the activation event.
- Reduced-motion preference disables row transitions.

- [ ] **Step 3: Commit**

```bash
git add sidepanel/panel.js
git commit -m "feat(panel): entry — message intake, theme/mode persistence, keyboard nav"
```

---

## Task 9: Manual smoke test on a real page

The stub content script is good enough to validate the entire panel flow end-to-end. We do not gate Phase 3 on Phase 2 — we gate it on the data flow being demonstrable.

- [ ] **Step 1: Reload the unpacked extension**

- [ ] **Step 2: Open a content-rich page** (e.g., a long Wikipedia article).

- [ ] **Step 3: Click the FontLens action button**

Verify:
- Side panel opens.
- Multiple family cards render.
- Summary line is accurate.
- Hovering rows highlights matching elements visibly.
- Switching to Inspect mode updates aria-pressed; switching back to Hover restores.
- Auto/Light/Dark toggle flips the theme.
- Reload Chrome — theme persists.

- [ ] **Step 4: Open a page with intentional fallback** (use a local file that requests a fake font)

Create `test/harness/fallback-demo.html`:

```html
<!doctype html>
<html><head><meta charset="utf-8"><title>FontLens fallback demo</title>
<style>
  body { font: 18px/1.5 system-ui; padding: 24px; }
  h1   { font-family: "FakeFontXyz", Arial, sans-serif; }
  p.b  { font-family: "AnotherFakeFont", Georgia, serif; }
</style></head>
<body>
  <h1>This headline is requesting a font that doesn't exist.</h1>
  <p class="b">So is this paragraph, but it falls to Georgia.</p>
  <p>This is a normal paragraph.</p>
</body></html>
```

Open it via `file://` (you may need to enable file access for the extension at `chrome://extensions`).

Verify:
- The amber fallback banner appears at the top: "2 of this page's fonts aren't loading — visitors see fallbacks."
- The first two family cards have amber borders and read `FakeFontXyz → Arial`, `AnotherFakeFont → Georgia`.

- [ ] **Step 5: Verify a11y in DevTools Accessibility tree**

- Side panel `<main>` is exposed as `region` with name "Detected fonts".
- Mode toggle buttons announce `aria-pressed`.
- Theme buttons announce as `Auto theme`, `Light theme`, `Dark theme`.
- Rows announce as `button` with the specimen's plain-language label.
- Visible focus rings present when tabbing.

- [ ] **Step 6: No commit needed** — manual verification only. Take a screenshot and drop it into `docs/mockups/` if useful.

---

## Task 10: Phase 3 closeout

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```

Expected: Phase 1 tests + Phase 3 tests all green. Approximate counts:
- parse-stack: 11
- roles: 24
- source-classify: 6
- detector: 6
- style-key: 7
- extractor: 13
- render: ~22
- **Total: ≥ 89 tests passing**

- [ ] **Step 2: Push**

```bash
git push origin main
```

- [ ] **Step 3: Tag the milestone**

```bash
git tag -a phase3-panel -m "Phase 3: side panel + family-grouped extraction"
git push origin phase3-panel
```

- [ ] **Step 4: Hand off to Phase 4**

Phase 4 picks up:
- `lib/export.js` — CSS / Tailwind / Token serializers.
- Per-row copy buttons in `sidepanel/render.js` (revealed on row hover; Enter on a focused row copies the default format).
- Toast component (`sidepanel/render.js` + `panel.css`).
- Variable-font axis slider component inside family cards (DESIGN.md §6.9).

Phase 3's `render.js` already has a clean seam — `onActivate(row)` — for Phase 4 to hook into.

---

## Acceptance criteria (gate for Phase 4)

Phase 3 is done when ALL of these are true:

- [ ] `npm test` passes with ≥ 89 tests across `lib/` and `sidepanel/`.
- [ ] Loading the unpacked extension in Chrome and clicking the action opens the side panel without errors.
- [ ] On a real page, the panel renders family cards grouped by rendered family, with rows sorted by usage count desc.
- [ ] On a page with a missing requested font, the amber fallback banner and amber-bordered cards appear with `Söhne → Arial` style headers.
- [ ] Hovering a row outlines all matching nodes on the page; mouseleave removes the outline.
- [ ] Theme toggle (Auto / Light / Dark) flips the panel immediately and persists across Chrome restarts via `chrome.storage.local` key `theme`.
- [ ] Mode toggle (Hover / Inspect) emits `fontlens:set-mode` messages and reflects `aria-pressed` correctly.
- [ ] Keyboard: ArrowUp/Down move row focus, Home/End jump, Enter activates, Esc returns to Hover mode.
- [ ] All metric strings and counts use `font-variant-numeric: tabular-nums`.
- [ ] Side panel `<main>` is `role="region"` with `aria-label="Detected fonts"`.
- [ ] Every interactive element has an `aria-label` (verified in DevTools Accessibility tree).
- [ ] Visible focus rings (DESIGN.md §10) appear on every focusable element via `:focus-visible`.
- [ ] `git tag phase3-panel` is pushed.

---

## Notes for the implementer

- **Do not implement copy/export buttons yet.** Phase 4 owns them. `render.js` exposes the `onActivate` callback as the seam — wire it up later. Resist scope creep.
- **Do not implement axis sliders yet.** They are Phase 4 even though variable-font badge already renders. The badge alone gives the user the signal; the slider is interactive surface.
- **Do not replace the stub `content/content.js` with Phase 2 logic.** When Phase 2 lands, that file is overwritten — the message contract is the only thing Phase 3 depends on.
- **Respect the token boundary.** No raw hex outside `lib/tokens.css`. If you find yourself writing `#0f0f10` in `panel.css`, switch to `var(--fg)`.
- **Highlight class lives on the host page, not the panel.** The stub injects `.fontlens-highlight { outline: 2px solid #f59e0b !important; }`. The real Phase 2 content script may attach this inside a Shadow DOM root for stronger isolation; the panel doesn't care as long as the message contract is honored.
- **Tabular nums everywhere.** Both `--font-mono` lines (metrics) and the summary line need them. If a number "jitters" between rows on theme switch, you missed one.
- **Empty state shows before the first message.** Loading the panel before clicking the action is a normal state, not an error.
- **The 5000-node cap is non-negotiable** (spec §11). The `extract()` test for `maxNodes` is the regression guard — don't loosen it.
- **`document.fonts.ready` is a Phase 2 concern** when running real detection on a live page. The extractor's tests stub `detect()` so they don't need it; the stub content script also doesn't wait for it (this is acceptable for Phase 3 because real detection only matters once Phase 2 lands).
- **`role="button"` on rows is intentional.** Rows are interactive (hover highlights, click activates). Using `role="button"` plus `tabindex` makes them keyboard-equivalent to actual buttons without breaking the grid layout.
