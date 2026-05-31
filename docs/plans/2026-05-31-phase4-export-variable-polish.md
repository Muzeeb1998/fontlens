# Phase 4 — Export + Variable Fonts + Polish

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the three things that turn FontLens from "an inspector" into "the inspector designers and devs actually keep": (1) one-click export to CSS / Tailwind / Token, (2) variable-font axis detection with interactive sliders that mutate the page live, and (3) the polish pass — page-level fallback banner refinement, CSP low-confidence "?" badges, dark-mode token audit, raw-hex audit.

**Architecture:** One new pure-logic module (`lib/export.js`) covered by Vitest. Detector extension (`lib/detector.js`) — populate `isVariable` + `axes` from `document.fonts` + `@font-face` parsing, unit-tested with mocked FontFaceSet. Side-panel wiring: copy buttons → clipboard → toast (DESIGN.md §6.7); axis sliders → throttled content-script message → mutate `font-variation-settings` on matching nodes. Polish: dark-mode token audit, `?` badge on low-confidence rows, fallback banner tightening. No new permissions, no new build step.

**Tech Stack:** Vanilla JavaScript (ES modules), Vitest with happy-dom, Chrome MV3 messaging (`chrome.tabs.sendMessage`). Same toolchain established in Phase 1.

**Spec section this implements:**
- `docs/specs/launch1-design.md` §7 (Export — three serializers, Tailwind nearest-mapping with arbitrary-value fallback)
- §8.3 (Variable-font axis sliders inside family card, interactive)
- §8.4 (Visual system polish — token audit, dark-mode)
- §10 (CSP fallback — low-confidence "?" badge)
- DESIGN.md §6.7 (Toast), §6.9 (Variable-Font Axis Slider)

**Prerequisite phases:**
- Phase 1 — `lib/detector.js`, `lib/parse-stack.js`, `lib/source-classify.js`, Vitest infra.
- Phase 2 — Content script + overlay + Shadow-DOM chip (contributes `content/content.js`, message-routing scaffolding).
- Phase 3 — Side panel (`sidepanel/panel.html`, `sidepanel/panel.js`, `sidepanel/panel.css`), family-card markup, row-hover behavior. Phase 4 wires into existing markup.

If any Phase 2/3 contract drifts from what this plan assumes, the implementer must update **this** plan before writing code — do not silently adapt.

---

## File Structure

```
fontlens/
├── lib/
│   ├── export.js                          [Task 1]
│   ├── export.test.js                     [Task 1]
│   ├── detector.js                        [Task 4 — extend]
│   ├── detector.test.js                   [Task 4 — extend]
│   └── variable-axes.js                   [Task 3]
│   └── variable-axes.test.js              [Task 3]
├── sidepanel/
│   ├── panel.js                           [Tasks 2, 5, 7 — extend]
│   ├── panel.css                          [Tasks 6, 7 — extend]
│   └── panel.html                         [Task 2 — extend]
├── content/
│   └── content.js                         [Task 5 — extend]
├── options/
│   └── options.js                         [Task 2 — extend]
└── test/
    └── harness/
        ├── variable.html                  [Task 5]
        └── variable.js                    [Task 5]
```

Boundaries:
- `lib/export.js` is pure: takes a `detect()` detail object, returns a string or JSON object. No DOM, no clipboard, no chrome APIs. Vitest-only.
- `lib/variable-axes.js` is pure-ish: takes a `FontFaceSet` and a family name, returns `{ isVariable, axes }`. DOM-touching helpers are split into a thin wrapper consumed by `detector.js`.
- Slider input → message → content script. Side-panel does not reach into the host page directly; it sends `{ type: 'fontlens/apply-axes', familyKey, axes }` to the active tab via `chrome.tabs.sendMessage`.
- All polish work (Tasks 6, 7) is non-functional — no behavior change, only consistency and accessibility.

---

## Task 1: `lib/export.js` — Three serializers

Pure module. Three exported functions: `toCSS(detail)`, `toTailwind(detail)`, `toToken(detail)`. CSS and Tailwind return strings; Token returns a JSON object (caller stringifies with whatever indent it wants).

**Files:**
- Create: `lib/export.js`
- Create: `lib/export.test.js`

### Contract

Input is a single `detect()` result object as defined in Phase 1 §5.6, e.g.:

```js
{
  requested: ['Söhne', 'Arial', 'sans-serif'],
  rendered: 'Söhne',
  isFallback: false,
  source: { type: 'self-hosted', format: 'woff2', url: '...', os: null },
  isVariable: false,
  axes: null,
  metrics: {
    size: '16px',
    weight: 400,
    lineHeight: '24px',
    letterSpacing: 'normal',
    transform: 'none',
    color: { rgb: 'rgb(34,34,34)', hex: '#222222' }
  },
  confidence: 'high',
}
```

### `toCSS(detail)` returns

```css
font-family: "Söhne", Arial, sans-serif;
font-weight: 400;
font-size: 16px;
line-height: 24px;
letter-spacing: normal;
color: #222222;
```

Rules:
- Re-quote family names that contain whitespace or are not pure ASCII letters/digits.
- Omit `text-transform` when value is `none`.
- Use the rendered face as `font-family` value's first member if `isFallback` is false; otherwise emit the original requested stack as-authored (designer needs to see what the page actually asked for so they can debug). Add a trailing `/* fallback: Arial */` comment when `isFallback === true`.

### `toTailwind(detail)` returns

```
font-sans font-normal text-base leading-6 tracking-normal text-[#222222]
```

Returns an object shape internally that the function flattens to a string:

```js
{
  classes: ['font-sans', 'font-normal', 'text-base', 'leading-6', 'tracking-normal', 'text-[#222222]'],
  approximate: false,  // true when any value used the arbitrary-value form
}
```

Public API returns the flattened string. A second exported helper `toTailwindStructured(detail)` returns the `{ classes, approximate }` shape for the side-panel's "≈" badge logic (Task 2 needs this).

Mapping tables (must be exhaustive and live in the file as constants):

```js
// font-size → Tailwind utility (default theme, v3.4+)
const TW_TEXT = [
  ['text-xs',   12],
  ['text-sm',   14],
  ['text-base', 16],
  ['text-lg',   18],
  ['text-xl',   20],
  ['text-2xl',  24],
  ['text-3xl',  30],
  ['text-4xl',  36],
  ['text-5xl',  48],
  ['text-6xl',  60],
  ['text-7xl',  72],
  ['text-8xl',  96],
  ['text-9xl',  128],
];

// font-weight → Tailwind utility
const TW_WEIGHT = {
  100: 'font-thin',
  200: 'font-extralight',
  300: 'font-light',
  400: 'font-normal',
  500: 'font-medium',
  600: 'font-semibold',
  700: 'font-bold',
  800: 'font-extrabold',
  900: 'font-black',
};

// line-height numeric → Tailwind utility (default theme)
const TW_LEADING = [
  ['leading-3',     12],
  ['leading-4',     16],
  ['leading-5',     20],
  ['leading-6',     24],
  ['leading-7',     28],
  ['leading-8',     32],
  ['leading-9',     36],
  ['leading-10',    40],
];

// letter-spacing tokens (em-based — convert from computed px-based using current size)
const TW_TRACKING = {
  '-0.05em': 'tracking-tighter',
  '-0.025em': 'tracking-tight',
  '0em':     'tracking-normal',
  '0.025em': 'tracking-wide',
  '0.05em':  'tracking-wider',
  '0.1em':   'tracking-widest',
};
```

Arbitrary-value fallback rule: when the exact computed value is not in the table (within a `0.5px` tolerance for line-height to absorb 23.something → leading-6 false negatives), emit `text-[17px]`, `font-[450]`, `leading-[26px]`, `tracking-[0.03em]`, `text-[#abcdef]`. Set `approximate: true` whenever any arbitrary-value form is emitted.

Family handling: ship a tiny generic heuristic — if any family in the stack matches `/mono|courier|menlo|consolas/i` → `font-mono`; otherwise if any matches `/serif|georgia|times/i` → `font-serif`; else → `font-sans`. Do not attempt to map specific brand faces (Söhne, Inter) to Tailwind classes — Tailwind defaults don't have them, and arbitrary-value family is rarely what users want pasted; the family base utility is the right behaviour.

### `toToken(detail)` returns

A JSON object (NOT a string — caller stringifies):

```js
{
  fontFamily: 'Söhne',
  fontWeight: 400,
  fontSize: '16px',
  lineHeight: '24px',
  letterSpacing: '0',
  color: '#222222'
}
```

Rules:
- `fontFamily` is the first non-generic family in `requested` (so a self-aware designer sees the canonical name even when it's falling back).
- `letterSpacing: 'normal'` is normalized to `'0'` in token form (design tokens don't typically carry the CSS keyword `normal`).
- Omit `textTransform` unless non-default.
- When `isVariable === true`, include `axes: { wght: 450, wdth: 100, opsz: 24 }` (current applied values from the detector). Do NOT include the ranges — that's introspection, not a token.

### Tests

- [ ] **Step 1: Write the failing tests**

`lib/export.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { toCSS, toTailwind, toTailwindStructured, toToken } from './export.js';

const baseDetail = {
  requested: ['Söhne', 'Arial', 'sans-serif'],
  rendered: 'Söhne',
  isFallback: false,
  source: { type: 'self-hosted', format: 'woff2', url: 'https://x/y.woff2', os: null },
  isVariable: false,
  axes: null,
  metrics: {
    size: '16px',
    weight: 400,
    lineHeight: '24px',
    letterSpacing: 'normal',
    transform: 'none',
    color: { rgb: 'rgb(34, 34, 34)', hex: '#222222' },
  },
  confidence: 'high',
};

describe('toCSS', () => {
  it('emits a clean CSS block with quoted family', () => {
    const css = toCSS(baseDetail);
    expect(css).toMatch(/font-family:\s*"Söhne", Arial, sans-serif;/);
    expect(css).toMatch(/font-weight:\s*400;/);
    expect(css).toMatch(/font-size:\s*16px;/);
    expect(css).toMatch(/line-height:\s*24px;/);
    expect(css).toMatch(/letter-spacing:\s*normal;/);
    expect(css).toMatch(/color:\s*#222222;/);
  });

  it('omits text-transform when value is none', () => {
    expect(toCSS(baseDetail)).not.toMatch(/text-transform/);
  });

  it('emits text-transform when non-default', () => {
    const d = { ...baseDetail, metrics: { ...baseDetail.metrics, transform: 'uppercase' } };
    expect(toCSS(d)).toMatch(/text-transform:\s*uppercase;/);
  });

  it('adds a fallback comment when isFallback is true', () => {
    const d = { ...baseDetail, isFallback: true, rendered: 'Arial' };
    expect(toCSS(d)).toMatch(/\/\* fallback: Arial \*\//);
  });

  it('does not quote families that are bare ASCII single words', () => {
    const d = { ...baseDetail, requested: ['Arial', 'sans-serif'] };
    expect(toCSS(d)).toMatch(/font-family:\s*Arial, sans-serif;/);
  });
});

describe('toTailwind', () => {
  it('maps default-scale values to utilities, no approximate flag', () => {
    const out = toTailwindStructured(baseDetail);
    expect(out.classes).toContain('font-sans');
    expect(out.classes).toContain('font-normal');
    expect(out.classes).toContain('text-base');
    expect(out.classes).toContain('leading-6');
    expect(out.classes).toContain('tracking-normal');
    expect(out.classes).toContain('text-[#222222]');
    expect(out.approximate).toBe(false);
  });

  it('falls back to arbitrary-value form and flags approximate', () => {
    const d = {
      ...baseDetail,
      metrics: { ...baseDetail.metrics, size: '17px', weight: 450, lineHeight: '26px' },
    };
    const out = toTailwindStructured(d);
    expect(out.classes).toContain('text-[17px]');
    expect(out.classes).toContain('font-[450]');
    expect(out.classes).toContain('leading-[26px]');
    expect(out.approximate).toBe(true);
  });

  it('chooses font-mono when stack contains a mono family', () => {
    const d = { ...baseDetail, requested: ['SF Mono', 'Menlo', 'monospace'] };
    expect(toTailwindStructured(d).classes).toContain('font-mono');
  });

  it('chooses font-serif when stack contains a serif family', () => {
    const d = { ...baseDetail, requested: ['Iowan Old Style', 'Georgia', 'serif'] };
    expect(toTailwindStructured(d).classes).toContain('font-serif');
  });

  it('flattens to a string in toTailwind()', () => {
    expect(typeof toTailwind(baseDetail)).toBe('string');
    expect(toTailwind(baseDetail)).toMatch(/\bfont-sans\b/);
    expect(toTailwind(baseDetail)).toMatch(/\btext-base\b/);
  });

  it('tolerates 0.5px slop on line-height before going arbitrary', () => {
    // 23.99px → leading-6 (close enough to 24)
    const d = { ...baseDetail, metrics: { ...baseDetail.metrics, lineHeight: '23.99px' } };
    expect(toTailwindStructured(d).classes).toContain('leading-6');
  });
});

describe('toToken', () => {
  it('returns a plain object (not a string)', () => {
    const t = toToken(baseDetail);
    expect(typeof t).toBe('object');
    expect(t.fontFamily).toBe('Söhne');
    expect(t.fontWeight).toBe(400);
    expect(t.fontSize).toBe('16px');
    expect(t.lineHeight).toBe('24px');
    expect(t.letterSpacing).toBe('0');
    expect(t.color).toBe('#222222');
  });

  it('normalises letter-spacing "normal" to "0"', () => {
    expect(toToken(baseDetail).letterSpacing).toBe('0');
  });

  it('uses the first non-generic family, not a generic keyword', () => {
    const d = { ...baseDetail, requested: ['sans-serif'] };
    // No non-generic — fall back to the generic
    expect(toToken(d).fontFamily).toBe('sans-serif');
  });

  it('includes axes when variable, current values only (no ranges)', () => {
    const d = {
      ...baseDetail,
      isVariable: true,
      axes: { wght: { min: 100, max: 900, current: 450 }, opsz: { min: 6, max: 144, current: 24 } },
    };
    const t = toToken(d);
    expect(t.axes).toEqual({ wght: 450, opsz: 24 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run lib/export.test.js
```

Expected: failures (`toCSS is not a function` etc.).

- [ ] **Step 3: Implement `lib/export.js`**

`lib/export.js`:

```js
import { isGeneric } from './parse-stack.js';

// ---------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------

function needsQuotes(family) {
  return /[\s]/.test(family) || /[^\x00-\x7F]/.test(family);
}

function formatFamilyList(stack) {
  return stack.map(f => needsQuotes(f) ? `"${f}"` : f).join(', ');
}

function pxNumber(value) {
  if (typeof value === 'number') return value;
  const m = String(value).match(/^(-?\d+(?:\.\d+)?)px$/);
  return m ? Number(m[1]) : null;
}

// ---------------------------------------------------------------
// toCSS
// ---------------------------------------------------------------

export function toCSS(detail) {
  const { metrics, isFallback, rendered, requested } = detail;
  const lines = [];
  lines.push(`font-family: ${formatFamilyList(requested)};`);
  lines.push(`font-weight: ${metrics.weight};`);
  lines.push(`font-size: ${metrics.size};`);
  lines.push(`line-height: ${metrics.lineHeight};`);
  lines.push(`letter-spacing: ${metrics.letterSpacing};`);
  if (metrics.transform && metrics.transform !== 'none') {
    lines.push(`text-transform: ${metrics.transform};`);
  }
  lines.push(`color: ${metrics.color.hex};`);
  if (isFallback && rendered) lines.push(`/* fallback: ${rendered} */`);
  return lines.join('\n');
}

// ---------------------------------------------------------------
// toTailwind
// ---------------------------------------------------------------

const TW_TEXT = [
  ['text-xs', 12], ['text-sm', 14], ['text-base', 16], ['text-lg', 18],
  ['text-xl', 20], ['text-2xl', 24], ['text-3xl', 30], ['text-4xl', 36],
  ['text-5xl', 48], ['text-6xl', 60], ['text-7xl', 72], ['text-8xl', 96],
  ['text-9xl', 128],
];

const TW_WEIGHT = {
  100: 'font-thin', 200: 'font-extralight', 300: 'font-light',
  400: 'font-normal', 500: 'font-medium', 600: 'font-semibold',
  700: 'font-bold', 800: 'font-extrabold', 900: 'font-black',
};

const TW_LEADING = [
  ['leading-3', 12], ['leading-4', 16], ['leading-5', 20], ['leading-6', 24],
  ['leading-7', 28], ['leading-8', 32], ['leading-9', 36], ['leading-10', 40],
];

const TW_TRACKING = {
  '-0.05em':  'tracking-tighter',
  '-0.025em': 'tracking-tight',
  '0em':      'tracking-normal',
  '0.025em':  'tracking-wide',
  '0.05em':   'tracking-wider',
  '0.1em':    'tracking-widest',
};

function familyUtility(stack) {
  const joined = stack.join(' ').toLowerCase();
  if (/mono|courier|menlo|consolas/.test(joined)) return 'font-mono';
  if (/serif|georgia|times/.test(joined))         return 'font-serif';
  return 'font-sans';
}

function nearestExact(value, table, tol = 0) {
  for (const [cls, px] of table) {
    if (Math.abs(px - value) <= tol) return cls;
  }
  return null;
}

export function toTailwindStructured(detail) {
  const { metrics, requested } = detail;
  const classes = [];
  let approximate = false;

  // family
  classes.push(familyUtility(requested));

  // weight
  const w = Number(metrics.weight);
  if (TW_WEIGHT[w]) {
    classes.push(TW_WEIGHT[w]);
  } else {
    classes.push(`font-[${w}]`);
    approximate = true;
  }

  // size
  const sz = pxNumber(metrics.size);
  if (sz !== null) {
    const exact = nearestExact(sz, TW_TEXT);
    if (exact) {
      classes.push(exact);
    } else {
      classes.push(`text-[${metrics.size}]`);
      approximate = true;
    }
  }

  // line-height (tolerate 0.5px slop)
  const lh = pxNumber(metrics.lineHeight);
  if (lh !== null) {
    const exact = nearestExact(lh, TW_LEADING, 0.5);
    if (exact) {
      classes.push(exact);
    } else {
      classes.push(`leading-[${metrics.lineHeight}]`);
      approximate = true;
    }
  } else if (metrics.lineHeight === 'normal') {
    classes.push('leading-normal');
  }

  // letter-spacing (px → em conversion using detected size)
  if (metrics.letterSpacing === 'normal') {
    classes.push('tracking-normal');
  } else {
    const ls = pxNumber(metrics.letterSpacing);
    if (ls !== null && sz) {
      const em = (ls / sz).toFixed(3);
      const key = `${em}em`.replace(/0+em$/, 'em').replace(/\.em$/, 'em');
      if (TW_TRACKING[key]) {
        classes.push(TW_TRACKING[key]);
      } else {
        classes.push(`tracking-[${em}em]`);
        approximate = true;
      }
    } else {
      classes.push(`tracking-[${metrics.letterSpacing}]`);
      approximate = true;
    }
  }

  // color — always arbitrary (Tailwind's named palette never matches a real
  // brand color exactly, and silently rounding is dishonest).
  classes.push(`text-[${metrics.color.hex}]`);

  return { classes, approximate };
}

export function toTailwind(detail) {
  return toTailwindStructured(detail).classes.join(' ');
}

// ---------------------------------------------------------------
// toToken
// ---------------------------------------------------------------

export function toToken(detail) {
  const { metrics, requested, isVariable, axes } = detail;
  const firstNonGeneric = requested.find(f => !isGeneric(f)) || requested[0] || '';

  const token = {
    fontFamily: firstNonGeneric,
    fontWeight: Number(metrics.weight) || metrics.weight,
    fontSize: metrics.size,
    lineHeight: metrics.lineHeight,
    letterSpacing: metrics.letterSpacing === 'normal' ? '0' : metrics.letterSpacing,
    color: metrics.color.hex,
  };

  if (metrics.transform && metrics.transform !== 'none') {
    token.textTransform = metrics.transform;
  }

  if (isVariable && axes) {
    token.axes = Object.fromEntries(
      Object.entries(axes).map(([k, v]) => [k, v.current ?? v])
    );
  }

  return token;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run lib/export.test.js
```

Expected: all `export.test.js` tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/export.js lib/export.test.js
git commit -m "feat(export): CSS / Tailwind / Token serializers with arbitrary-value fallback"
```

---

## Task 2: Copy buttons + toast wiring in the side panel

Wire the three copy buttons (CSS / Tailwind / Token) that Phase 3 placed in each row to call the exporters and write to the clipboard. Show a `Copied as <format>` toast (DESIGN.md §6.7). Read `defaultFormat` from `chrome.storage.local` (set by Options page) and use it for the keyboard-default copy action (Enter on a focused row copies the default format without choosing a button).

**Files:**
- Modify: `sidepanel/panel.js`
- Modify: `sidepanel/panel.html` (add toast container if not already present from Phase 3)
- Modify: `sidepanel/panel.css` (toast styles if not present)
- Modify: `options/options.js` (write `defaultFormat`)

### Side-panel contract Phase 4 inherits

Phase 3 must produce rows of the form:

```html
<div class="row"
     data-style-key="..."
     data-detail='<JSON encoded detail object>'>
  <span class="role-label">BODY</span>
  <span class="specimen">Almost before we knew it...</span>
  <span class="metrics">16/24 · 400 · #222</span>
  <span class="count-chip">×42</span>
  <div class="copy-buttons" hidden>
    <button data-copy="css">CSS</button>
    <button data-copy="tailwind">Tailwind <span class="approx" hidden>≈</span></button>
    <button data-copy="token">Token</button>
  </div>
</div>
```

If Phase 3 used different attribute names, **update this plan first** and only then change the code.

### Steps

- [ ] **Step 1: Add the toast container to `panel.html`**

If `<div id="toast" role="status" aria-live="polite" hidden></div>` is not already present (it should be from Phase 3 §6.7 work), add it right before `</body>`.

- [ ] **Step 2: Toast CSS**

If not already present, add to `sidepanel/panel.css`:

```css
#toast {
  position: fixed;
  right: var(--s-6);
  bottom: var(--s-6);
  background: var(--bg);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
  font: var(--t-sm) / 1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  padding: var(--s-3) var(--s-5);
  opacity: 0;
  transform: translateY(4px);
  transition: opacity 120ms ease-out, transform 120ms ease-out;
  pointer-events: none;
  z-index: 9999;
}
#toast[data-visible="true"] {
  opacity: 1;
  transform: translateY(0);
}
@media (prefers-reduced-motion: reduce) {
  #toast { transition: none; }
}
```

- [ ] **Step 3: Wire copy buttons in `panel.js`**

Add (or extend an existing) initialization block:

```js
import { toCSS, toTailwind, toTailwindStructured, toToken } from '../lib/export.js';

const TOAST = document.getElementById('toast');
let toastTimer = null;

function showToast(message) {
  TOAST.textContent = message;
  TOAST.removeAttribute('hidden');
  TOAST.dataset.visible = 'true';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    TOAST.dataset.visible = 'false';
    setTimeout(() => TOAST.setAttribute('hidden', ''), 200);
  }, 1800);
}

function serialize(detail, format) {
  switch (format) {
    case 'css':      return toCSS(detail);
    case 'tailwind': return toTailwind(detail);
    case 'token':    return JSON.stringify(toToken(detail), null, 2);
    default:         return toCSS(detail);
  }
}

async function copyDetail(detail, format) {
  const text = serialize(detail, format);
  try {
    await navigator.clipboard.writeText(text);
    const label = format === 'css' ? 'CSS' : format === 'tailwind' ? 'Tailwind' : 'Token';
    showToast(`Copied as ${label}`);
  } catch (err) {
    showToast('Copy failed — clipboard blocked');
    console.error('[FontLens] clipboard write failed', err);
  }
}

// Mark approximate Tailwind on render — Phase 4 augments existing rows.
function annotateApproximateTailwindButtons(root = document) {
  for (const row of root.querySelectorAll('.row[data-detail]')) {
    let detail;
    try { detail = JSON.parse(row.dataset.detail); } catch { continue; }
    const { approximate } = toTailwindStructured(detail);
    const flag = row.querySelector('[data-copy="tailwind"] .approx');
    if (flag) flag.hidden = !approximate;
  }
}

// Click delegation
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-copy]');
  if (!btn) return;
  const row = btn.closest('.row[data-detail]');
  if (!row) return;
  let detail;
  try { detail = JSON.parse(row.dataset.detail); } catch { return; }
  copyDetail(detail, btn.dataset.copy);
});

// Keyboard: Enter on a focused row copies the default format.
let defaultFormat = 'css';
chrome.storage.local.get(['defaultFormat']).then(({ defaultFormat: stored }) => {
  if (stored === 'css' || stored === 'tailwind' || stored === 'token') {
    defaultFormat = stored;
  }
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.defaultFormat) {
    const v = changes.defaultFormat.newValue;
    if (v === 'css' || v === 'tailwind' || v === 'token') defaultFormat = v;
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const row = document.activeElement?.closest?.('.row[data-detail]');
  if (!row) return;
  let detail;
  try { detail = JSON.parse(row.dataset.detail); } catch { return; }
  e.preventDefault();
  copyDetail(detail, defaultFormat);
});

// Re-annotate every time the panel re-renders. Phase 3's render path should
// dispatch a `fontlens:rendered` event on document for this hook.
document.addEventListener('fontlens:rendered', () => annotateApproximateTailwindButtons());
annotateApproximateTailwindButtons();
```

If Phase 3 did not emit `fontlens:rendered`, add an emit at the end of its render function — record this as a Phase 3 contract patch in the closeout notes.

- [ ] **Step 4: Options-page wiring for `defaultFormat`**

Add to `options/options.js`:

```js
const RADIO_NAME = 'defaultFormat';

document.addEventListener('DOMContentLoaded', async () => {
  const { defaultFormat = 'css' } = await chrome.storage.local.get(['defaultFormat']);
  const target = document.querySelector(`input[name="${RADIO_NAME}"][value="${defaultFormat}"]`);
  if (target) target.checked = true;

  for (const radio of document.querySelectorAll(`input[name="${RADIO_NAME}"]`)) {
    radio.addEventListener('change', () => {
      if (radio.checked) chrome.storage.local.set({ defaultFormat: radio.value });
    });
  }
});
```

Verify the Phase 2/3 `options.html` already contains a radio group with `name="defaultFormat"` and values `css | tailwind | token`. If it does not, add it as part of this task and note the addition.

- [ ] **Step 5: Manual verification**

Load the extension unpacked, open a real site, run inspect. For each of the three buttons on a row, click, then paste into a scratch text editor:
- CSS button → multi-line `font-family: ... color: #...;` block.
- Tailwind button → space-separated class string.
- Token button → JSON object.

Then in Options page choose Tailwind as the default, focus a row in the side panel, press Enter — clipboard should contain the Tailwind string and toast should read "Copied as Tailwind".

- [ ] **Step 6: Commit**

```bash
git add sidepanel/panel.js sidepanel/panel.html sidepanel/panel.css options/options.js
git commit -m "feat(panel): wire copy buttons → clipboard → toast, default format from storage"
```

---

## Task 3: `lib/variable-axes.js` — Variable-font axis extraction

Pure-ish module that, given a `FontFaceSet` (passed in, defaults to `document.fonts`) and a family name, returns `{ isVariable: boolean, axes: object | null }`. The detector orchestrator (Task 4) calls this and copies the result into its output.

**Files:**
- Create: `lib/variable-axes.js`
- Create: `lib/variable-axes.test.js`

### Behavior

A face is variable if **any** of these are true:

1. The matching `FontFace` instance has a non-empty `variationSettings` string (e.g. `"wght" 450, "wdth" 100`).
2. The matching `@font-face` `font-weight` descriptor is a range (e.g. `font-weight: 100 900`) — that alone implies a `wght` axis.
3. The matching `@font-face` `font-stretch` descriptor is a range (`font-stretch: 75% 125%`) — implies `wdth`.
4. The matching `@font-face` has a `font-style: oblique 0deg 14deg` form — implies `slnt`.

Per axis, capture `{ min, max, current }`. The `current` value comes from `variationSettings` if present, otherwise from the computed `font-weight` / `font-stretch` / `font-style` of the inspected element (passed in by the orchestrator).

Return shape:

```js
{
  isVariable: true,
  axes: {
    wght: { min: 100, max: 900, current: 450 },
    wdth: { min: 75,  max: 125, current: 100 },
    opsz: { min: 6,   max: 144, current: 24  },
  }
}
```

When the face is not variable, return `{ isVariable: false, axes: null }`.

### Tests

- [ ] **Step 1: Write the failing tests**

`lib/variable-axes.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { detectAxes } from './variable-axes.js';

// Minimal FontFaceSet-like mock — vitest happy-dom does not expose a real one.
function mockFontFaceSet(faces) {
  return {
    [Symbol.iterator]() {
      let i = 0;
      return { next() { return i < faces.length ? { value: faces[i++], done: false } : { done: true }; } };
    },
  };
}

function injectStyle(css) {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}

beforeEach(() => { document.head.innerHTML = ''; });

describe('detectAxes', () => {
  it('returns isVariable=false when no matching face exists', () => {
    const out = detectAxes('Nope', mockFontFaceSet([]), document);
    expect(out.isVariable).toBe(false);
    expect(out.axes).toBe(null);
  });

  it('detects variable from a FontFace with variationSettings', () => {
    const face = { family: 'Inter', variationSettings: '"wght" 450, "opsz" 24' };
    injectStyle(`
      @font-face {
        font-family: "Inter";
        src: url('/x.woff2') format('woff2-variations');
        font-weight: 100 900;
        font-stretch: 75% 125%;
      }
    `);
    const out = detectAxes('Inter', mockFontFaceSet([face]), document, { weight: 450, stretch: '100%', style: 'normal' });
    expect(out.isVariable).toBe(true);
    expect(out.axes.wght).toEqual({ min: 100, max: 900, current: 450 });
    expect(out.axes.wdth).toEqual({ min: 75, max: 125, current: 100 });
    expect(out.axes.opsz.current).toBe(24);
  });

  it('detects variable from font-weight range alone', () => {
    injectStyle(`
      @font-face {
        font-family: "Recursive";
        src: url('/r.woff2') format('woff2');
        font-weight: 300 1000;
      }
    `);
    const out = detectAxes('Recursive', mockFontFaceSet([]), document, { weight: 500 });
    expect(out.isVariable).toBe(true);
    expect(out.axes.wght).toEqual({ min: 300, max: 1000, current: 500 });
  });

  it('detects slnt from font-style oblique range', () => {
    injectStyle(`
      @font-face {
        font-family: "Slanty";
        src: url('/s.woff2') format('woff2');
        font-style: oblique 0deg 14deg;
      }
    `);
    const out = detectAxes('Slanty', mockFontFaceSet([]), document, { style: 'oblique 7deg' });
    expect(out.isVariable).toBe(true);
    expect(out.axes.slnt.min).toBe(0);
    expect(out.axes.slnt.max).toBe(14);
    expect(out.axes.slnt.current).toBe(7);
  });

  it('returns isVariable=false for a non-variable face with single weight', () => {
    injectStyle(`
      @font-face {
        font-family: "Static";
        src: url('/s.woff2') format('woff2');
        font-weight: 400;
      }
    `);
    const out = detectAxes('Static', mockFontFaceSet([]), document, { weight: 400 });
    expect(out.isVariable).toBe(false);
  });

  it('matches family case-insensitively and strips quotes', () => {
    const face = { family: '"Inter"', variationSettings: '"wght" 600' };
    injectStyle(`
      @font-face {
        font-family: "Inter";
        src: url('/x.woff2') format('woff2');
        font-weight: 100 900;
      }
    `);
    const out = detectAxes('inter', mockFontFaceSet([face]), document, { weight: 600 });
    expect(out.isVariable).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run lib/variable-axes.test.js
```

Expected: failures (`detectAxes is not a function`).

- [ ] **Step 3: Implement `lib/variable-axes.js`**

```js
function unquote(s) { return String(s || '').replace(/^["']|["']$/g, '').trim(); }

function readRules(sheet) {
  try { return Array.from(sheet.cssRules || []); }
  catch { return []; }
}

function* fontFaceRules(doc) {
  for (const sheet of Array.from(doc.styleSheets || [])) {
    for (const rule of readRules(sheet)) {
      if (rule.constructor?.name === 'CSSFontFaceRule' || rule.type === 5) yield rule;
    }
  }
}

function parseRange(value) {
  if (!value) return null;
  // "100 900" or "75% 125%" or "0deg 14deg"
  const m = String(value).trim().match(/^(-?\d+(?:\.\d+)?)\s*(?:%|deg)?\s+(-?\d+(?:\.\d+)?)\s*(?:%|deg)?$/);
  if (!m) return null;
  const min = Number(m[1]), max = Number(m[2]);
  if (Number.isNaN(min) || Number.isNaN(max) || min === max) return null;
  return { min, max };
}

function parseObliqueRange(value) {
  if (!value) return null;
  const m = String(value).trim().match(/^oblique\s+(-?\d+(?:\.\d+)?)deg\s+(-?\d+(?:\.\d+)?)deg$/);
  if (!m) return null;
  return { min: Number(m[1]), max: Number(m[2]) };
}

function parseVariationSettings(s) {
  if (!s) return {};
  const out = {};
  // "wght" 450, "opsz" 24
  for (const m of s.matchAll(/["']?([a-zA-Z0-9]{1,4})["']?\s+(-?\d+(?:\.\d+)?)/g)) {
    out[m[1]] = Number(m[2]);
  }
  return out;
}

function findFontFace(family, fontFaceSet) {
  if (!fontFaceSet) return null;
  const target = family.toLowerCase();
  for (const face of fontFaceSet) {
    if (unquote(face.family).toLowerCase() === target) return face;
  }
  return null;
}

function findFontFaceRule(family, doc) {
  const target = family.toLowerCase();
  for (const rule of fontFaceRules(doc)) {
    const ruleFamily = unquote(rule.style.getPropertyValue('font-family')).toLowerCase();
    if (ruleFamily === target) return rule;
  }
  return null;
}

function parseStretchPercent(value) {
  // "100%" → 100, "normal" → 100, "condensed" → 75 (approximations)
  if (!value || value === 'normal') return 100;
  const pct = String(value).match(/^(-?\d+(?:\.\d+)?)%$/);
  if (pct) return Number(pct[1]);
  const STRETCH_KEYWORDS = {
    'ultra-condensed': 50, 'extra-condensed': 62.5, 'condensed': 75,
    'semi-condensed': 87.5, 'normal': 100, 'semi-expanded': 112.5,
    'expanded': 125, 'extra-expanded': 150, 'ultra-expanded': 200,
  };
  return STRETCH_KEYWORDS[value] ?? 100;
}

function parseObliqueDegrees(value) {
  if (!value) return 0;
  const m = String(value).match(/oblique\s+(-?\d+(?:\.\d+)?)deg/);
  return m ? Number(m[1]) : 0;
}

export function detectAxes(family, fontFaceSet, doc = document, computed = {}) {
  const face = findFontFace(family, fontFaceSet);
  const rule = findFontFaceRule(family, doc);
  if (!face && !rule) return { isVariable: false, axes: null };

  const axes = {};

  // From the @font-face rule descriptors
  if (rule) {
    const wghtRange = parseRange(rule.style.getPropertyValue('font-weight'));
    if (wghtRange) {
      axes.wght = { ...wghtRange, current: Number(computed.weight) || wghtRange.min };
    }
    const wdthRange = parseRange(rule.style.getPropertyValue('font-stretch'));
    if (wdthRange) {
      axes.wdth = { ...wdthRange, current: parseStretchPercent(computed.stretch) };
    }
    const slntRange = parseObliqueRange(rule.style.getPropertyValue('font-style'));
    if (slntRange) {
      axes.slnt = { ...slntRange, current: parseObliqueDegrees(computed.style) };
    }
  }

  // From the FontFace.variationSettings (per-instance override or any axis
  // the rule didn't expose — including opsz, GRAD, custom axes)
  if (face && face.variationSettings) {
    const settings = parseVariationSettings(face.variationSettings);
    for (const [tag, value] of Object.entries(settings)) {
      if (axes[tag]) {
        axes[tag].current = value;
      } else {
        // Unknown range — record as fixed-point with synthetic range so the
        // UI can still show a slider with sensible bounds.
        axes[tag] = { min: value, max: value, current: value };
      }
    }
  }

  const isVariable = Object.keys(axes).length > 0 &&
    Object.values(axes).some(a => a.min !== a.max);

  return { isVariable, axes: isVariable ? axes : null };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run lib/variable-axes.test.js
```

Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add lib/variable-axes.js lib/variable-axes.test.js
git commit -m "feat(detector): variable-font axis extraction from FontFaceSet + @font-face"
```

---

## Task 4: Extend `lib/detector.js` to populate `isVariable` + `axes`

The detector currently returns `isVariable: false, axes: null` (placeholder from Phase 1). Now it actually calls `detectAxes` from Task 3.

**Files:**
- Modify: `lib/detector.js`
- Modify: `lib/detector.test.js`

### Steps

- [ ] **Step 1: Add a failing test**

Append to `lib/detector.test.js`:

```js
import { detectAxes as _detectAxes } from './variable-axes.js'; // sanity import
import * as varModule from './variable-axes.js';

describe('detect — variable fonts', () => {
  it('populates isVariable and axes from variable-axes module', () => {
    __setRenderDetector(() => 'Inter');
    // Stub document.fonts with a face that has variationSettings
    const originalFonts = document.fonts;
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: {
        [Symbol.iterator]() {
          let n = 0;
          const arr = [{ family: 'Inter', variationSettings: '"wght" 500' }];
          return { next() { return n < arr.length ? { value: arr[n++], done: false } : { done: true }; } };
        },
        check() { return true; },
        ready: Promise.resolve(),
      },
    });

    const style = document.createElement('style');
    style.textContent = `@font-face { font-family: "Inter"; src: url('/x.woff2'); font-weight: 100 900; }`;
    document.head.appendChild(style);

    const el = makeEl('p');
    el.style.fontFamily = '"Inter", sans-serif';
    el.style.fontWeight = '500';
    el.style.fontSize = '16px';

    const out = detect(el);
    expect(out.isVariable).toBe(true);
    expect(out.axes.wght.min).toBe(100);
    expect(out.axes.wght.max).toBe(900);
    expect(out.axes.wght.current).toBe(500);

    Object.defineProperty(document, 'fonts', { configurable: true, value: originalFonts });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run lib/detector.test.js
```

Expected: the new test fails (`out.isVariable` is still `false`).

- [ ] **Step 3: Wire `detectAxes` into the orchestrator**

In `lib/detector.js`, add the import and replace the placeholder `isVariable: false, axes: null` returns:

```js
import { detectAxes } from './variable-axes.js';
```

Inside the `detect()` function, after computing `rendered`, before the return:

```js
let variable = { isVariable: false, axes: null };
if (rendered) {
  try {
    variable = detectAxes(rendered, document.fonts, el.ownerDocument, {
      weight: cs.fontWeight,
      stretch: cs.fontStretch,
      style: cs.fontStyle,
    });
  } catch (err) {
    // Swallow — variable detection failure must not break the whole detect.
    console.warn('[FontLens] variable axis detection failed', err);
  }
}
```

Replace the two `isVariable: false, axes: null` return entries with `isVariable: variable.isVariable, axes: variable.axes` (one in the system-stack branch — keep that one `false` since system tokens don't expose axes via `@font-face` rules anyway, and one in the main branch — use `variable.*`).

- [ ] **Step 4: Run all detector tests**

```bash
npx vitest run lib/detector.test.js
```

Expected: existing 6 tests still pass, new variable-font test passes (7/7).

- [ ] **Step 5: Run the full suite**

```bash
npm test
```

Expected: all Phase 1/2/3 tests still pass plus the new Phase 4 ones.

- [ ] **Step 6: Commit**

```bash
git add lib/detector.js lib/detector.test.js
git commit -m "feat(detector): populate isVariable + axes via variable-axes module"
```

---

## Task 5: Variable-font axis sliders in family card

When a family card has `isVariable: true`, render a slider row per axis (DESIGN.md §6.9). Slider input → throttle at 30ms → send a message to the content script → the content script mutates `font-variation-settings` on every node matching the family + style key. "Reset" link restores the original `font-variation-settings` (or removes the inline style if none was originally set).

**Files:**
- Modify: `sidepanel/panel.js` (render axes, wire slider input)
- Modify: `sidepanel/panel.css` (slider styling — DESIGN.md §6.9)
- Modify: `content/content.js` (handle `fontlens/apply-axes` and `fontlens/reset-axes`)
- Create: `test/harness/variable.html` (manual exercise harness — see §6 below)
- Create: `test/harness/variable.js`

### Message contract

Side panel → content script:

```js
chrome.tabs.sendMessage(tabId, {
  type: 'fontlens/apply-axes',
  styleKey: 'Inter|400|16px|24px|normal|none|#222222',
  values: { wght: 600, opsz: 30 },
});
```

```js
chrome.tabs.sendMessage(tabId, {
  type: 'fontlens/reset-axes',
  styleKey: '...',
});
```

The content script keeps a `Map<styleKey, Set<Element>>` populated during `extract()` (built in Phase 3); on `apply-axes` it walks the set and sets `el.style.fontVariationSettings = '"wght" 600, "opsz" 30'`. On reset it removes the inline style.

If Phase 3 did not store the per-style node set, add it now — it is the cheapest way to do this and is also needed for row-hover highlighting. Update Phase 3's contract here in this plan first.

### Steps

- [ ] **Step 1: Slider markup**

Extend Phase 3's family-card renderer so that when any row's detail has `isVariable: true`, the card renders an `<details>` block (collapsed by default — opt-in to avoid visual noise on font-heavy pages):

```html
<details class="axes" data-style-key="Inter|...">
  <summary>3 axes — wght · opsz · wdth</summary>
  <div class="axis" data-tag="wght">
    <label>wght <span class="range">100–900</span></label>
    <input type="range" min="100" max="900" step="1" value="500" aria-label="wght axis">
    <output>500</output>
  </div>
  <!-- ...one per axis -->
  <button class="axis-reset" type="button">Reset</button>
</details>
```

- [ ] **Step 2: Slider styling** in `sidepanel/panel.css`

```css
.axes {
  margin-top: var(--s-3);
  border-top: 1px solid var(--border);
  padding-top: var(--s-3);
}
.axes summary {
  font: var(--t-sm) / 1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: var(--fg-muted);
  cursor: pointer;
  user-select: none;
}
.axis {
  display: grid;
  grid-template-columns: 64px 1fr 48px;
  gap: var(--s-3);
  align-items: center;
  margin: var(--s-2) 0;
}
.axis label {
  font: var(--t-xs) / 1 ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;
  color: var(--fg);
}
.axis label .range {
  display: block;
  color: var(--fg-faint);
  font-size: 10px;
}
.axis input[type="range"] {
  appearance: none;
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: var(--bg-subtle);
}
.axis input[type="range"]::-webkit-slider-thumb {
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 7px;
  background: var(--accent);
  border: 0;
  cursor: pointer;
}
.axis output {
  font: var(--t-sm) / 1 ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;
  color: var(--fg-muted);
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.axis-reset {
  margin-top: var(--s-2);
  background: none;
  border: 0;
  color: var(--link);
  font: var(--t-xs) / 1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  cursor: pointer;
  padding: 0;
}
```

- [ ] **Step 3: Slider behaviour in `panel.js`**

```js
const THROTTLE_MS = 30;

function throttle(fn, ms) {
  let last = 0, pending = null;
  return function (...args) {
    const now = Date.now();
    const remain = ms - (now - last);
    if (remain <= 0) {
      last = now;
      fn.apply(this, args);
    } else {
      clearTimeout(pending);
      pending = setTimeout(() => { last = Date.now(); fn.apply(this, args); }, remain);
    }
  };
}

async function activeTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

const applyAxes = throttle(async (styleKey, values) => {
  const tabId = await activeTabId();
  if (!tabId) return;
  chrome.tabs.sendMessage(tabId, { type: 'fontlens/apply-axes', styleKey, values });
}, THROTTLE_MS);

document.addEventListener('input', (e) => {
  const input = e.target.closest('.axis input[type="range"]');
  if (!input) return;
  const axesBlock = input.closest('.axes');
  const styleKey = axesBlock.dataset.styleKey;
  const tag = input.closest('.axis').dataset.tag;
  const out = input.parentElement.querySelector('output');
  out.textContent = input.value;
  // Gather every current axis value in this block — apply-axes is replace-all.
  const values = {};
  for (const ax of axesBlock.querySelectorAll('.axis')) {
    values[ax.dataset.tag] = Number(ax.querySelector('input').value);
  }
  applyAxes(styleKey, values);
});

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.axis-reset');
  if (!btn) return;
  const axesBlock = btn.closest('.axes');
  const styleKey = axesBlock.dataset.styleKey;
  // Reset each input to its initial detected current value (stored as data-default at render).
  for (const ax of axesBlock.querySelectorAll('.axis')) {
    const input = ax.querySelector('input');
    input.value = input.dataset.default;
    ax.querySelector('output').textContent = input.dataset.default;
  }
  const tabId = await activeTabId();
  if (tabId) chrome.tabs.sendMessage(tabId, { type: 'fontlens/reset-axes', styleKey });
});
```

When rendering each slider, set `data-default` on the input to the detected `current` value so Reset can restore.

- [ ] **Step 4: Content-script handler** in `content/content.js`

Add (alongside Phase 2's existing message router):

```js
const originalAxes = new WeakMap();

function nodesForStyleKey(key) {
  // Phase 3 must populate `window.__fontlens.nodesByStyle` (a Map). If it's
  // not there, do nothing — caller will see no change and can file a bug.
  return window.__fontlens?.nodesByStyle?.get(key) || [];
}

function fmtAxes(values) {
  return Object.entries(values)
    .map(([tag, v]) => `"${tag}" ${v}`)
    .join(', ');
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'fontlens/apply-axes') {
    for (const el of nodesForStyleKey(msg.styleKey)) {
      if (!originalAxes.has(el)) originalAxes.set(el, el.style.fontVariationSettings || '');
      el.style.fontVariationSettings = fmtAxes(msg.values);
    }
  } else if (msg?.type === 'fontlens/reset-axes') {
    for (const el of nodesForStyleKey(msg.styleKey)) {
      const orig = originalAxes.get(el);
      if (orig === undefined) continue;
      if (orig === '') el.style.removeProperty('font-variation-settings');
      else el.style.fontVariationSettings = orig;
      originalAxes.delete(el);
    }
  }
});
```

- [ ] **Step 5: Manual harness for the slider** — `test/harness/variable.html` + `variable.js`

This is a standalone HTML page (run via `npm run harness` from Phase 1) that loads a real variable font (Inter Variable is widely available), renders a paragraph in it, and provides a stub slider that drives `font-variation-settings` directly — verifying the mechanism works in a real browser independent of the extension wiring. The extension wiring is then verified manually by loading unpacked.

`test/harness/variable.html`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>FontLens Variable-Font Harness</title>
  <link rel="stylesheet" href="./fixtures.css">
  <style>
    @font-face {
      font-family: "InterVariable";
      src: url("./fonts/inter-variable.woff2") format("woff2-variations");
      font-weight: 100 900;
      font-display: block;
    }
    #subject {
      font-family: "InterVariable", sans-serif;
      font-size: 32px;
      font-variation-settings: "wght" 400;
    }
    label { display: block; margin: 12px 0 4px; font: 12px/1 ui-monospace, Menlo, monospace; }
    input[type="range"] { width: 320px; }
  </style>
</head>
<body>
  <h1>Variable-Font Slider Harness</h1>
  <p>Drag the slider and watch the paragraph reflow. Expected: a smooth weight sweep with no jank.</p>
  <div id="subject">Almost before we knew it, we had left the ground.</div>
  <label>wght <span id="wght-value">400</span></label>
  <input id="wght" type="range" min="100" max="900" value="400" step="1">
  <p id="detect-out" style="font: 12px/1.4 ui-monospace, Menlo, monospace; white-space: pre;"></p>
  <script type="module" src="./variable.js"></script>
</body>
</html>
```

`test/harness/variable.js`:

```js
import { detect } from '../../lib/detector.js';

await document.fonts.ready;

const subject = document.getElementById('subject');
const slider = document.getElementById('wght');
const out = document.getElementById('wght-value');

slider.addEventListener('input', () => {
  subject.style.fontVariationSettings = `"wght" ${slider.value}`;
  out.textContent = slider.value;
});

const result = detect(subject);
document.getElementById('detect-out').textContent =
  `isVariable: ${result.isVariable}\naxes: ${JSON.stringify(result.axes, null, 2)}`;
```

Implementer pulls a real Inter Variable woff2 into `test/harness/fonts/inter-variable.woff2` (the .gitignore in Phase 1 already excludes it). Open in Chrome, drag the slider, confirm the text reflows smoothly. The `detect-out` block must show `isVariable: true` and a `wght` axis with min 100, max 900.

- [ ] **Step 6: Manual extension test**

Load the extension unpacked, visit `https://rsms.me/inter/` (or any page using Inter Variable), open inspect mode, click on body text. In the side panel the Inter family card should expose a `wght` slider. Drag it — every Inter-styled paragraph on the page should change weight in real time. Click Reset — weights revert.

- [ ] **Step 7: Commit**

```bash
git add sidepanel/panel.js sidepanel/panel.css content/content.js test/harness/variable.html test/harness/variable.js
git commit -m "feat(panel): variable-font axis sliders with live page mutation"
```

---

## Task 6: Dark-mode + raw-hex audit

A scan-and-fix pass. The DESIGN.md §3.3 forbidden combinations and the rule "no raw hex outside `lib/tokens.css`" are real constraints — Phase 4 is where they get enforced for real before launch.

**Files:**
- Review/modify: every `.css` file in the project
- Audit: every JS file that injects inline styles

### Steps

- [ ] **Step 1: Grep for raw hex outside `lib/tokens.css`**

```bash
grep -nE '#[0-9a-fA-F]{3,8}\b' \
  $(find . -name '*.css' -not -path './node_modules/*' -not -path './lib/tokens.css') \
  $(find . -name '*.js' -not -path './node_modules/*' -not -path './lib/export.js' -not -path './lib/*.test.js')
```

Note: `lib/export.js` is exempt because it serializes user-facing CSS strings — those hex values are the detected page color, not FontLens chrome.

- [ ] **Step 2: Replace every found raw hex with a token**

For each match, replace the hex with `var(--token-name)`. If no existing token fits, that's a real gap — add the token to `lib/tokens.css` AND update DESIGN.md §3 to record it. Do not silently introduce ad-hoc colors.

- [ ] **Step 3: Verify dark-mode visually**

Load the extension, switch theme toggle to Dark, open inspect mode on a real page. Walk every component on screen:
- Side panel background uses `--bg` token (not pure black).
- Borders visible against background.
- Specimen text contrasts cleanly.
- Toast readable.
- Fallback banner amber tokens distinct from regular text.
- Slider track + thumb visible.
- Focus rings visible (Tab through the panel).

Take screenshots of each, save under `docs/mockups/phase4-dark-audit/` for the record.

- [ ] **Step 4: Verify contrast ratios**

For every text/background pairing in dark mode, run through a contrast checker (the Chrome DevTools color picker shows AA/AAA inline). Required: AA (4.5:1) for normal text. If any fails, adjust the token in `lib/tokens.css` and re-test.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "polish(visual): swap raw hex → tokens, verify dark-mode contrast"
```

---

## Task 7: Page-level fallback banner refinement + CSP "?" badge

Two small polish items the spec calls out explicitly.

**Files:**
- Modify: `sidepanel/panel.js` (banner copy + count, "?" badge render)
- Modify: `sidepanel/panel.css` ("?" badge style)

### 7a. Fallback banner polish

The Phase 3 banner says something like "2 fallbacks detected." The spec §8.3 line is more pointed:

> "⚠ 2 of this page's fonts aren't loading — visitors see fallbacks."

- [ ] **Step 1: Verify the banner copy matches the spec exactly**

In `sidepanel/panel.js`, find the banner render. If the copy differs, replace with:

```js
function banner(fallbackCount) {
  if (fallbackCount === 0) return null;
  const noun = fallbackCount === 1 ? 'font isn\'t' : 'fonts aren\'t';
  return `⚠ ${fallbackCount} of this page's ${noun} loading — visitors see fallbacks.`;
}
```

(Note the apostrophe handling — the singular form uses `isn't`.)

- [ ] **Step 2: Verify the banner uses the amber tokens** (`--amber-bg`, `--amber-fg`, `--amber-border`), no raw hex. If not, fix and add to Task 6's grep target.

### 7b. CSP low-confidence "?" badge

Rows where `detail.confidence === 'low'` get a small `?` badge with tooltip "Detection couldn't be confirmed on this page (CSP)."

- [ ] **Step 1: Markup**

In the row template (Phase 3), after the role label:

```html
<span class="lowconf-badge"
      role="img"
      aria-label="Detection couldn't be confirmed on this page (CSP)"
      title="Detection couldn't be confirmed on this page (CSP)."
      hidden>?</span>
```

In the renderer, set `hidden = false` when `detail.confidence === 'low'`.

- [ ] **Step 2: Style** — append to `sidepanel/panel.css`:

```css
.lowconf-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  margin-left: var(--s-1);
  border-radius: 999px;
  background: var(--bg-subtle);
  color: var(--fg-muted);
  font: 600 10px / 1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  cursor: help;
}
.lowconf-badge:focus-visible {
  outline: 2px solid var(--border-strong);
  outline-offset: 2px;
}
```

- [ ] **Step 3: Manual verification**

Load the extension on a site with strict CSP (e.g., GitHub). Inspect a font. At least one row should sport the `?` badge. Hover the badge — native tooltip surfaces the spec copy. Tab to the badge — visible focus ring.

- [ ] **Step 4: Commit**

```bash
git add sidepanel/panel.js sidepanel/panel.css
git commit -m "polish(panel): banner copy matches spec, low-confidence rows show '?' badge"
```

---

## Task 8: Phase 4 closeout

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```

Expected: every Phase 1, 2, 3, and 4 test passes. No skips. New Phase 4 test additions:
- `lib/export.test.js` — ≥14 tests
- `lib/variable-axes.test.js` — ≥6 tests
- `lib/detector.test.js` — +1 variable-font test (now 7 total)

- [ ] **Step 2: Run the harnesses**

```bash
npm run harness
```

Visit:
- `http://localhost:5173/` — Phase 1 detection harness, still 4/4 PASS.
- `http://localhost:5173/variable.html` — Phase 4 variable-font slider harness; slider drags smoothly, `detect-out` block reports `isVariable: true`.

- [ ] **Step 3: Real-world sanity walk**

Load the extension unpacked, then on these sites confirm the listed behavior:

| Site | Expected |
|------|----------|
| `https://rsms.me/inter/` | Inter card shows axes; slider drags weight live |
| `https://stripe.com` | A row has the `?` low-confidence badge (or doesn't, but no console error) |
| `https://github.com` | Same — strict CSP, expect `?` badges or visibly low-conf rows |
| Any page with fallbacks (or the Phase 1 demo) | Banner reads exactly the spec line |
| All sites | Copy buttons → toast → clipboard contains the right format |
| All sites | Dark mode toggle → no raw hex visible, every text contrasts |

- [ ] **Step 4: Push and tag**

```bash
git push origin main
git tag -a phase4-export-variable-polish -m "Phase 4: export + variable fonts + polish"
git push origin phase4-export-variable-polish
```

---

## Acceptance criteria (gate for Phase 5)

Phase 4 is done when ALL of the following are true:

- [ ] `npm test` passes with zero failures and zero skips.
- [ ] `lib/export.js` exports `toCSS`, `toTailwind`, `toTailwindStructured`, `toToken`. `toTailwindStructured` returns `{ classes, approximate }`. `toToken` returns a JSON object (not a string).
- [ ] Tailwind serializer emits arbitrary-value form (`text-[17px]`) for any value not on the default scale, and sets `approximate: true` on those outputs.
- [ ] Side-panel rows have three working copy buttons. Toast confirms each copy with `Copied as <Format>` and fades within ~2s.
- [ ] Enter on a focused row copies in the format stored under `chrome.storage.local` key `defaultFormat`. Options page reads/writes that key.
- [ ] `lib/detector.js` populates `isVariable` and `axes` from real `FontFaceSet` + `@font-face` parsing. `axes` shape is `{ tag: { min, max, current } }`.
- [ ] Variable family cards render one slider per detected axis (DESIGN.md §6.9 styling). Dragging a slider mutates `font-variation-settings` on every matching node on the host page. Throttle is 30ms. Reset link restores.
- [ ] No raw hex colors anywhere in CSS or JS outside `lib/tokens.css` and `lib/export.js`. Dark-mode visual walkthrough produced screenshots in `docs/mockups/phase4-dark-audit/`.
- [ ] Page-level fallback banner copy reads exactly: `⚠ N of this page's font(s) (isn't|aren't) loading — visitors see fallbacks.` (with correct singular/plural).
- [ ] Low-confidence rows display a `?` badge with tooltip `Detection couldn't be confirmed on this page (CSP).` Badge is keyboard-focusable and has a visible focus ring.
- [ ] `git tag phase4-export-variable-polish` is pushed.

---

## Notes for the implementer

- **Pure modules first, wiring second.** `lib/export.js` and `lib/variable-axes.js` are pure — write and test them in isolation before touching the side panel. Bugs in pure code are 10x cheaper to find with Vitest than in a loaded extension.
- **Slider throttling is taste, not science.** 30ms is the floor that keeps font-variation-settings reflows watchable. If a particular site janks, try 60ms — never go below 16ms (one frame at 60Hz) or the page chokes on `style` writes.
- **`font-variation-settings` overrides `font-weight`.** Once you set the inline style, normal CSS weight on that element stops winning. That is fine for the slider audition, and Reset removes the inline style cleanly. Do NOT also touch `font-weight` — let one mechanism own each.
- **Tailwind default theme is what we map against.** A site using a custom Tailwind config will see different class names than what's in their codebase. Don't try to read their `tailwind.config.js` — too brittle. The arbitrary-value fallback is the honest answer when our mapping doesn't fit.
- **Token export does NOT include axis ranges.** The min/max are introspection — useful in the UI, not in a token contract. Only the current applied values go in the exported token. The slider in the panel is for designers; the token is for the system that consumes the chosen value.
- **CSP-blocked canvas is normal, not a failure.** A `?` badge is the design's honest answer. Do not retry, do not work around — the spec is explicit: degrade quietly with a label.
- **No new permissions.** Phase 4 should not change `manifest.json`. If you find yourself reaching for `host_permissions` or `clipboardWrite`, stop — `navigator.clipboard.writeText` works from the side panel without extra permissions, and message-passing is already in scope.
- **Don't scope-creep into Phase 5.** Variable-font axis "presets" (named instances), CMYK token export, Figma direct-push, and font-pairing suggestions are all great ideas — file them in `docs/notes/phase5-ideas.md` and walk away.
