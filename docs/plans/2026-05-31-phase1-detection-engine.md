# Phase 1 — Detection Engine + Test Harness

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure detection engine — given a DOM element, return what font was requested, what's actually rendering, whether it's a fallback, the source classification, and the metrics. No UI, no extension wiring; the engine and a hand-driven test harness page only.

**Architecture:** Three pure-logic modules (parse-stack, role inference, source classification) covered by Vitest unit tests. One module that needs a real browser canvas (render-detect) covered by a manual harness page that runs assertions in-browser and renders pass/fail visibly. One orchestrator (`detector.js`) that composes them.

**Tech Stack:** Vanilla JavaScript (ES modules), Node.js ≥ 20, Vitest for unit tests, happy-dom for DOM mocks, no build step (modules loaded directly). Chrome (any 2024+ version) for the manual canvas harness.

**Spec section this implements:** `docs/specs/launch1-design.md` §5 (Detection Engine) + §6.2 (R4 role inference, which is pure-logic and easy to land alongside).

---

## File Structure

```
fontlens/
├── package.json                    [Task 1]
├── vitest.config.js                [Task 1]
├── lib/
│   ├── parse-stack.js              [Task 2]
│   ├── parse-stack.test.js         [Task 2]
│   ├── roles.js                    [Task 3]
│   ├── roles.test.js               [Task 3]
│   ├── source-classify.js          [Task 4]
│   ├── source-classify.test.js     [Task 4]
│   ├── render-detect.js            [Task 5]
│   └── detector.js                 [Task 6]
└── test/
    └── harness/
        ├── index.html              [Task 7]
        ├── harness.js              [Task 7]
        └── fixtures.css            [Task 7]
```

Boundaries:
- `parse-stack`, `roles`, `source-classify` are pure functions — no DOM, no canvas. Fast unit tests.
- `render-detect` requires a real `<canvas>` 2D context. Tested only in the browser harness.
- `detector.js` is the public API. It is the only module the rest of the extension imports later.
- The harness is HTML pages that intentionally trigger every detection scenario and visibly assert results.

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `vitest.config.js`
- Create: `lib/.gitkeep`
- Create: `test/.gitkeep`
- Modify: `.gitignore` (add `node_modules/` if missing, already present)

- [ ] **Step 1: Create package.json**

```json
{
  "name": "fontlens",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "harness": "python3 -m http.server 5173 --directory test/harness"
  },
  "devDependencies": {
    "happy-dom": "^20.9.0",
    "vitest": "^4.1.7"
  }
}
```

- [ ] **Step 2: Create vitest.config.js**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['lib/**/*.test.js'],
    globals: false,
  },
});
```

- [ ] **Step 3: Add placeholder files so the directories exist**

```bash
touch lib/.gitkeep test/.gitkeep
```

- [ ] **Step 4: Install and verify vitest runs**

```bash
npm install
npm test
```

Expected: `No test files found, exiting with code 1` — that confirms vitest installs and runs. (Code 1 is fine here; later tasks add tests.)

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.js lib/.gitkeep test/.gitkeep
git commit -m "chore: scaffold vitest + lib/test dirs"
```

---

## Task 2: parse-stack.js — Parse the CSS `font-family` value

The browser returns `font-family` as a single string like `'"Söhne", Arial, sans-serif'`. We need an array of family names in priority order, with quotes stripped and whitespace trimmed.

**Files:**
- Create: `lib/parse-stack.js`
- Test: `lib/parse-stack.test.js`

### Behavior

- Input: a CSS `font-family` string from `getComputedStyle`.
- Output: an array of family names, in order, quotes removed, whitespace trimmed.
- Generic keywords (`serif`, `sans-serif`, `monospace`, `cursive`, `fantasy`, `system-ui`, `ui-serif`, `ui-sans-serif`, `ui-monospace`, `ui-rounded`, `math`, `emoji`, `fangsong`) are kept as-is but **flagged** so callers know not to canvas-fingerprint them.

### Tests to write first

- [ ] **Step 1: Write the failing tests**

`lib/parse-stack.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { parseStack, isGeneric } from './parse-stack.js';

describe('parseStack', () => {
  it('splits a quoted multi-family stack', () => {
    expect(parseStack('"Söhne", Arial, sans-serif'))
      .toEqual(['Söhne', 'Arial', 'sans-serif']);
  });

  it('handles single-quoted names', () => {
    expect(parseStack("'Iowan Old Style', Georgia, serif"))
      .toEqual(['Iowan Old Style', 'Georgia', 'serif']);
  });

  it('trims whitespace', () => {
    expect(parseStack('   Helvetica   ,   Arial   '))
      .toEqual(['Helvetica', 'Arial']);
  });

  it('keeps an unquoted multi-word family that has no commas around it intact', () => {
    // Browsers usually quote these, but accept raw input defensively.
    expect(parseStack('Times New Roman, serif'))
      .toEqual(['Times New Roman', 'serif']);
  });

  it('handles a system stack', () => {
    expect(parseStack('-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto'))
      .toEqual(['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto']);
  });

  it('returns a single-element array for one family', () => {
    expect(parseStack('Arial')).toEqual(['Arial']);
  });

  it('returns an empty array for an empty string', () => {
    expect(parseStack('')).toEqual([]);
  });
});

describe('isGeneric', () => {
  it.each([
    'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy',
    'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace',
    'ui-rounded', 'math', 'emoji', 'fangsong',
  ])('flags %s as generic', (name) => {
    expect(isGeneric(name)).toBe(true);
  });

  it('does not flag a real family as generic', () => {
    expect(isGeneric('Helvetica')).toBe(false);
    expect(isGeneric('Söhne')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isGeneric('SERIF')).toBe(true);
    expect(isGeneric('Sans-Serif')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/parse-stack.test.js`
Expected: All tests fail because `./parse-stack.js` does not exist.

- [ ] **Step 3: Write the implementation**

`lib/parse-stack.js`:

```js
const GENERICS = new Set([
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy',
  'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace',
  'ui-rounded', 'math', 'emoji', 'fangsong',
]);

export function isGeneric(name) {
  return GENERICS.has(String(name).toLowerCase());
}

export function parseStack(value) {
  if (!value) return [];
  const parts = [];
  let buf = '';
  let quote = null;
  for (const ch of value) {
    if (quote) {
      if (ch === quote) { quote = null; continue; }
      buf += ch;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === ',') { parts.push(buf); buf = ''; continue; }
    buf += ch;
  }
  parts.push(buf);
  return parts.map(p => p.trim()).filter(p => p.length > 0);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/parse-stack.test.js`
Expected: 11 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/parse-stack.js lib/parse-stack.test.js
git commit -m "feat(detector): parse CSS font-family stack into ordered families"
```

---

## Task 3: roles.js — R4 role inference

Pure function: given a DOM element and its computed metrics, return one of `Headline` / `Body` / `Caption` / `Label` / `Code`.

**Files:**
- Create: `lib/roles.js`
- Test: `lib/roles.test.js`

### Behavior (per spec §6.2)

Rules in order, first match wins:
1. Semantic tag: `h1`–`h6` → Headline; `p` → Body; `small`, `figcaption`, `caption` → Caption; `button`, `label`, or any element with `[role="button"]` → Label; `code`, `pre`, `kbd`, `samp` → Code.
2. ARIA: `role="heading"` → Headline.
3. Size buckets (only when tag is `div`, `span`, or `a` — semantically empty containers): `≥24px` Headline · `14–22px` Body · `≤13px` Caption.
4. If none matched, return `'Body'` (a sensible default — most text on the web is body).

### Tests

- [ ] **Step 1: Write the failing tests**

`lib/roles.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { inferRole } from './roles.js';

function make(tag, opts = {}) {
  const el = document.createElement(tag);
  if (opts.role) el.setAttribute('role', opts.role);
  if (opts.text) el.textContent = opts.text;
  document.body.appendChild(el);
  return el;
}

beforeEach(() => { document.body.innerHTML = ''; });

describe('inferRole — semantic tags', () => {
  it.each([
    ['h1', 'Headline'], ['h2', 'Headline'], ['h3', 'Headline'],
    ['h4', 'Headline'], ['h5', 'Headline'], ['h6', 'Headline'],
  ])('maps %s to Headline', (tag, role) => {
    expect(inferRole(make(tag), { size: 16 })).toBe(role);
  });

  it('maps p to Body', () => {
    expect(inferRole(make('p'), { size: 16 })).toBe('Body');
  });

  it.each([['small'], ['figcaption'], ['caption']])(
    'maps %s to Caption', (tag) => {
      expect(inferRole(make(tag), { size: 12 })).toBe('Caption');
    }
  );

  it.each([['button'], ['label']])(
    'maps %s to Label', (tag) => {
      expect(inferRole(make(tag), { size: 14 })).toBe('Label');
    }
  );

  it.each([['code'], ['pre'], ['kbd'], ['samp']])(
    'maps %s to Code', (tag) => {
      expect(inferRole(make(tag), { size: 13 })).toBe('Code');
    }
  );
});

describe('inferRole — ARIA fallback', () => {
  it('honors role="heading" on a div', () => {
    expect(inferRole(make('div', { role: 'heading' }), { size: 14 })).toBe('Headline');
  });

  it('honors role="button" on a div', () => {
    expect(inferRole(make('div', { role: 'button' }), { size: 14 })).toBe('Label');
  });
});

describe('inferRole — size buckets on non-semantic tags', () => {
  it.each([['div'], ['span'], ['a']])('uses size on %s', (tag) => {
    expect(inferRole(make(tag), { size: 32 })).toBe('Headline');
    expect(inferRole(make(tag), { size: 16 })).toBe('Body');
    expect(inferRole(make(tag), { size: 12 })).toBe('Caption');
  });

  it('uses 24px as the Headline lower bound', () => {
    expect(inferRole(make('div'), { size: 24 })).toBe('Headline');
    expect(inferRole(make('div'), { size: 23 })).toBe('Body');
  });

  it('uses 13px as the Caption upper bound', () => {
    expect(inferRole(make('div'), { size: 13 })).toBe('Caption');
    expect(inferRole(make('div'), { size: 14 })).toBe('Body');
  });
});

describe('inferRole — fallback default', () => {
  it('returns Body for any unmatched tag', () => {
    expect(inferRole(make('article'), { size: 16 })).toBe('Body');
    expect(inferRole(make('section'), { size: 16 })).toBe('Body');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/roles.test.js`
Expected: all tests fail (`inferRole is not a function`).

- [ ] **Step 3: Write the implementation**

`lib/roles.js`:

```js
const SEMANTIC = new Map([
  ['h1', 'Headline'], ['h2', 'Headline'], ['h3', 'Headline'],
  ['h4', 'Headline'], ['h5', 'Headline'], ['h6', 'Headline'],
  ['p', 'Body'],
  ['small', 'Caption'], ['figcaption', 'Caption'], ['caption', 'Caption'],
  ['button', 'Label'], ['label', 'Label'],
  ['code', 'Code'], ['pre', 'Code'], ['kbd', 'Code'], ['samp', 'Code'],
]);

const ARIA = new Map([
  ['heading', 'Headline'],
  ['button',  'Label'],
]);

const NON_SEMANTIC_TAGS = new Set(['div', 'span', 'a']);

export function inferRole(el, metrics) {
  const tag = el.tagName.toLowerCase();

  // 1. Semantic tag
  if (SEMANTIC.has(tag)) return SEMANTIC.get(tag);

  // 2. ARIA role
  const role = el.getAttribute('role');
  if (role && ARIA.has(role)) return ARIA.get(role);

  // 3. Size buckets — only on tags that carry no semantic meaning
  if (NON_SEMANTIC_TAGS.has(tag)) {
    const size = Number(metrics?.size) || 0;
    if (size >= 24) return 'Headline';
    if (size <= 13) return 'Caption';
    return 'Body';
  }

  // 4. Default
  return 'Body';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/roles.test.js`
Expected: 24 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/roles.js lib/roles.test.js
git commit -m "feat(detector): R4 role inference (semantic > ARIA > size buckets)"
```

---

## Task 4: source-classify.js — Label the origin of a rendered face

Given a family name, scan `document.styleSheets` for `@font-face` rules and classify the source: `google` / `adobe` / `self-hosted` / `system` / `unknown`.

**Files:**
- Create: `lib/source-classify.js`
- Test: `lib/source-classify.test.js`

### Behavior

- Take a family name string and a `Document` reference (defaults to `document`).
- Walk every stylesheet's CSSRules. For each `CSSFontFaceRule`, parse `font-family` and `src`.
- Match family against the input (case-insensitive, quotes ignored).
- Classify the first matched rule's first `url(...)` by host:
  - `fonts.gstatic.com` or `fonts.googleapis.com` → `google`
  - `use.typekit.net` or `use.fontawesome.com` → `adobe` (Adobe Fonts / Typekit)
  - Any other `http(s)://` URL or relative path → `self-hosted`
  - No `@font-face` rule found for the family → `system`
- Also report the format if present (`woff2`, `woff`, `truetype`/`ttf`).

Cross-origin stylesheets throw when reading `cssRules`. Catch and skip them; report what we can.

### Tests

- [ ] **Step 1: Write the failing tests**

`lib/source-classify.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { classifySource } from './source-classify.js';

function injectStyle(css) {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}

beforeEach(() => { document.head.innerHTML = ''; });

describe('classifySource', () => {
  it('returns system when no @font-face matches', () => {
    expect(classifySource('Arial').type).toBe('system');
  });

  it('classifies Google Fonts via fonts.gstatic.com', () => {
    injectStyle(`
      @font-face {
        font-family: "Inter";
        src: url('https://fonts.gstatic.com/s/inter/foo.woff2') format('woff2');
      }
    `);
    const r = classifySource('Inter');
    expect(r.type).toBe('google');
    expect(r.format).toBe('woff2');
  });

  it('classifies Adobe Fonts via use.typekit.net', () => {
    injectStyle(`
      @font-face {
        font-family: "Soehne";
        src: url('https://use.typekit.net/af/abc/soehne.woff2') format('woff2');
      }
    `);
    expect(classifySource('Soehne').type).toBe('adobe');
  });

  it('classifies self-hosted via any other URL', () => {
    injectStyle(`
      @font-face {
        font-family: "Local Sans";
        src: url('/fonts/local-sans.woff2') format('woff2');
      }
    `);
    expect(classifySource('Local Sans').type).toBe('self-hosted');
  });

  it('is case-insensitive on family name', () => {
    injectStyle(`
      @font-face {
        font-family: "Inter";
        src: url('https://fonts.gstatic.com/x.woff2') format('woff2');
      }
    `);
    expect(classifySource('inter').type).toBe('google');
  });

  it('reports format when present', () => {
    injectStyle(`
      @font-face {
        font-family: "X";
        src: url('/x.woff') format('woff');
      }
    `);
    expect(classifySource('X').format).toBe('woff');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/source-classify.test.js`
Expected: failures (`classifySource is not a function`).

- [ ] **Step 3: Write the implementation**

`lib/source-classify.js`:

```js
const GOOGLE_HOSTS = ['fonts.gstatic.com', 'fonts.googleapis.com'];
const ADOBE_HOSTS  = ['use.typekit.net', 'use.fontawesome.com'];

function unquote(s) { return s.replace(/^["']|["']$/g, '').trim(); }

function readRules(sheet) {
  try { return Array.from(sheet.cssRules || []); }
  catch { return []; } // cross-origin
}

function* fontFaceRules(doc) {
  for (const sheet of Array.from(doc.styleSheets || [])) {
    for (const rule of readRules(sheet)) {
      if (rule.constructor.name === 'CSSFontFaceRule' || rule.type === 5) {
        yield rule;
      }
    }
  }
}

function parseSrc(srcValue) {
  if (!srcValue) return { url: null, format: null };
  const urlMatch = srcValue.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/);
  const fmtMatch = srcValue.match(/format\(\s*['"]?([^'")]+)['"]?\s*\)/);
  return {
    url: urlMatch ? urlMatch[1] : null,
    format: fmtMatch ? fmtMatch[1].toLowerCase() : null,
  };
}

function hostOf(url) {
  try { return new URL(url, 'https://example.com/').host; }
  catch { return ''; }
}

function classifyHost(host, url) {
  if (GOOGLE_HOSTS.includes(host)) return 'google';
  if (ADOBE_HOSTS.includes(host)) return 'adobe';
  if (url) return 'self-hosted';
  return 'unknown';
}

export function classifySource(family, doc = document) {
  const target = String(family).toLowerCase();
  for (const rule of fontFaceRules(doc)) {
    const ruleFamily = unquote(rule.style.getPropertyValue('font-family') || '').toLowerCase();
    if (ruleFamily !== target) continue;
    const { url, format } = parseSrc(rule.style.getPropertyValue('src'));
    return { type: classifyHost(hostOf(url), url), format, url };
  }
  return { type: 'system', format: null, url: null };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/source-classify.test.js`
Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/source-classify.js lib/source-classify.test.js
git commit -m "feat(detector): classify font source via @font-face src URL host"
```

---

## Task 5: render-detect.js — Canvas width fingerprint

The one module that genuinely needs a real browser canvas. We unit-test the small pure helpers; the actual canvas measurement is exercised in the Task 7 harness.

**Files:**
- Create: `lib/render-detect.js`
- Test: none in this task (harness validates in Task 7)

- [ ] **Step 1: Write the module**

`lib/render-detect.js`:

```js
// Probe string mixes wide/narrow glyphs and descenders so width differences
// are pronounced when a font is actually present versus falling back.
const PROBE = 'mmmiiiwwWQ@gjpy 0123';
const SIZE  = '72px';
const BASELINES = ['monospace', 'serif', 'sans-serif'];
const EPSILON = 0.5; // px

let _ctx = null;
function ctx() {
  if (_ctx) return _ctx;
  const c = document.createElement('canvas');
  _ctx = c.getContext('2d');
  return _ctx;
}

function measure(font) {
  const c = ctx();
  c.font = font;
  return c.measureText(PROBE).width;
}

// rendersDistinctly(family) is true when the named family produces a
// measurably different width from every generic baseline. If the family
// is not present, the browser draws each measurement in the baseline,
// producing identical widths.
export function rendersDistinctly(family, { weight = 400, style = 'normal' } = {}) {
  if (!family) return false;
  for (const base of BASELINES) {
    const wWith = measure(`${style} ${weight} ${SIZE} "${family}", ${base}`);
    const wBase = measure(`${style} ${weight} ${SIZE} ${base}`);
    if (Math.abs(wWith - wBase) > EPSILON) return true;
  }
  return false;
}

// Walk a stack and return the first family that renders distinctly.
// Returns null if every family falls through (caller decides what to do).
export function findRenderedFamily(stack, opts = {}) {
  for (const family of stack) {
    if (rendersDistinctly(family, opts)) return family;
  }
  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/render-detect.js
git commit -m "feat(detector): canvas width fingerprint for rendered-font detection"
```

(No automated test in this task — covered visibly in the harness.)

---

## Task 6: detector.js — Orchestrator (public API)

Composes the four modules into one `detect(el)` call that returns the spec §5.6 shape. Integrates `document.fonts.check` (spec §5.2 Layer 2) as an additional signal alongside the canvas fingerprint, and handles the system-stack OS-naming edge case (spec §5.5).

**Files:**
- Create: `lib/detector.js`
- Test: `lib/detector.test.js`

### API

```js
detect(el): {
  requested: string[],
  rendered: string | null,
  isFallback: boolean,
  source: { type, format, url, os },   // os populated only for system stacks
  isVariable: boolean,
  axes: object | null,
  metrics: { size, weight, lineHeight, letterSpacing, transform, color },
  confidence: 'high' | 'low',
}
```

- `confidence: 'low'` when `document.fonts.check()` and `rendersDistinctly` disagree, or when canvas read throws (CSP).
- `isFallback` is true when `rendered !== requested[0]` and `requested[0]` is not a generic.
- `metrics.color` is the object form `{ rgb, hex }` per spec §5.6 edit.
- **System stacks** (`-apple-system`, `system-ui`, `BlinkMacSystemFont`, `Segoe UI`): when the first non-generic family is a known system token, `source.type` is set to `'system'` and `source.os` is one of `'macos' | 'windows' | 'linux' | 'android' | 'unknown'` derived from `navigator.userAgentData?.platform`. The `rendered` value reflects the *user-friendly* name ("San Francisco" on macOS, "Segoe UI" on Windows, etc.) instead of the raw token.

### Tests

These tests use happy-dom — which does NOT implement canvas. We stub `rendersDistinctly` so we test the *orchestration logic*, not canvas behavior. Canvas itself is validated in Task 7's harness.

- [ ] **Step 1: Write the failing tests**

`lib/detector.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { detect, __setRenderDetector, __setPlatform } from './detector.js';

function makeEl(tag, css = {}) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(css)) el.style[k] = v;
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  __setRenderDetector(null); // reset
});

describe('detect', () => {
  it('returns requested stack, rendered first family, no fallback when face is present', () => {
    __setRenderDetector(() => 'Inter'); // pretend Inter is present
    const el = makeEl('p');
    el.style.fontFamily = '"Inter", Arial, sans-serif';
    el.style.fontSize = '16px';

    const out = detect(el);
    expect(out.requested).toEqual(['Inter', 'Arial', 'sans-serif']);
    expect(out.rendered).toBe('Inter');
    expect(out.isFallback).toBe(false);
  });

  it('flags isFallback when the first family does not render and a later one does', () => {
    __setRenderDetector((family) => family === 'Arial');
    const el = makeEl('p');
    el.style.fontFamily = '"Soehne", Arial, sans-serif';

    const out = detect(el);
    expect(out.rendered).toBe('Arial');
    expect(out.isFallback).toBe(true);
  });

  it('does not flag fallback when the first family is a generic keyword', () => {
    __setRenderDetector(() => 'sans-serif');
    const el = makeEl('p');
    el.style.fontFamily = 'sans-serif';

    const out = detect(el);
    expect(out.isFallback).toBe(false);
  });

  it('captures color in both rgb and hex form', () => {
    __setRenderDetector(() => 'Inter');
    const el = makeEl('p');
    el.style.fontFamily = 'Inter';
    el.style.color = 'rgb(34, 34, 34)';

    const out = detect(el);
    expect(out.metrics.color.rgb).toBe('rgb(34, 34, 34)');
    expect(out.metrics.color.hex).toBe('#222222');
  });

  it('marks confidence:low when canvas detector returns null but document.fonts.check would have said yes', () => {
    // Simulate CSP failure: renderDetector returns null (canvas threw).
    __setRenderDetector(() => null);
    const el = makeEl('p');
    el.style.fontFamily = 'Inter, sans-serif';

    const out = detect(el);
    expect(out.confidence).toBe('low');
  });

  it('detects a system stack and reports os + friendly name', () => {
    __setRenderDetector(() => null); // canvas can't fingerprint system tokens reliably
    const el = makeEl('p');
    el.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

    __setPlatform('macOS');
    const out = detect(el);
    expect(out.source.type).toBe('system');
    expect(out.source.os).toBe('macos');
    expect(out.rendered).toBe('San Francisco');
    expect(out.isFallback).toBe(false);
    __setPlatform(null); // reset
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/detector.test.js`
Expected: failures (`detect is not a function`).

- [ ] **Step 3: Write the implementation**

`lib/detector.js`:

```js
import { parseStack, isGeneric } from './parse-stack.js';
import { findRenderedFamily } from './render-detect.js';
import { classifySource } from './source-classify.js';

// ---------------------------------------------------------------
// System stack handling (spec §5.5)
// ---------------------------------------------------------------

const SYSTEM_TOKENS = new Set([
  '-apple-system', 'blinkmacsystemfont', 'system-ui',
  'segoe ui', 'roboto', 'helvetica neue', 'noto sans',
]);

const OS_FRIENDLY_NAME = {
  macos:   'San Francisco',
  ios:     'San Francisco',
  windows: 'Segoe UI',
  android: 'Roboto',
  linux:   'Cantarell',
  unknown: 'System UI',
};

let _platformOverride = null;
export function __setPlatform(p) { _platformOverride = p; }

function detectOs() {
  const p = (_platformOverride ?? navigator.userAgentData?.platform ?? navigator.platform ?? '').toLowerCase();
  if (p.includes('mac'))     return 'macos';
  if (p.includes('iphone') || p.includes('ipad') || p.includes('ios')) return 'ios';
  if (p.includes('win'))     return 'windows';
  if (p.includes('android')) return 'android';
  if (p.includes('linux'))   return 'linux';
  return 'unknown';
}

function isSystemStack(stack) {
  const firstNonGeneric = stack.find(f => !isGeneric(f));
  if (!firstNonGeneric) return false;
  return SYSTEM_TOKENS.has(firstNonGeneric.toLowerCase());
}

// ---------------------------------------------------------------
// Indirection so tests can substitute the canvas-dependent function.
// ---------------------------------------------------------------

let _renderDetector = (family, opts) => {
  try { return findRenderedFamily([family], opts); }
  catch { return null; }
};

export function __setRenderDetector(fn) {
  _renderDetector = fn || ((f, o) => {
    try { return findRenderedFamily([f], o); } catch { return null; }
  });
}

// ---------------------------------------------------------------
// Metric helpers
// ---------------------------------------------------------------

function rgbToHex(rgb) {
  const m = String(rgb).match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return rgb;
  return '#' + [m[1], m[2], m[3]].map(n => Number(n).toString(16).padStart(2, '0')).join('');
}

function readMetrics(cs) {
  return {
    size: cs.fontSize,
    weight: Number(cs.fontWeight) || cs.fontWeight,
    lineHeight: cs.lineHeight,
    letterSpacing: cs.letterSpacing,
    transform: cs.textTransform,
    color: { rgb: cs.color, hex: rgbToHex(cs.color) },
  };
}

// ---------------------------------------------------------------
// Layer 2 — document.fonts.check (fast pre-signal)
// ---------------------------------------------------------------

function checkLoaded(family, cs) {
  try {
    const probe = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} "${family}"`;
    return document.fonts.check(probe);
  } catch { return false; }
}

// ---------------------------------------------------------------
// Find rendered family — combines fonts.check + canvas fingerprint.
// ---------------------------------------------------------------

function findRendered(stack, opts, cs) {
  let checkSaidYes = null;     // first family the FontFaceSet API claims is loaded
  for (const family of stack) {
    if (isGeneric(family)) continue;

    const canvas = _renderDetector(family, opts);
    const checked = checkLoaded(family, cs);
    if (checkSaidYes === null && checked) checkSaidYes = family;

    if (canvas === null) {
      // Canvas blocked (CSP) — degrade to fonts.check signal, low confidence.
      if (checked) return { family, low: true };
      continue;
    }
    if (canvas === true || canvas === family) {
      return { family, low: !checked }; // disagreement → low confidence
    }
    if (typeof canvas === 'string') {
      return { family: canvas, low: false };
    }
  }
  // Canvas found nothing. Fall back to whatever fonts.check liked, if anything.
  if (checkSaidYes) return { family: checkSaidYes, low: true };
  return { family: null, low: false };
}

// ---------------------------------------------------------------
// Public API
// ---------------------------------------------------------------

export function detect(el) {
  const cs = getComputedStyle(el);
  const requested = parseStack(cs.fontFamily);
  const metrics = readMetrics(cs);
  const opts = { weight: cs.fontWeight, style: cs.fontStyle };

  // System-stack short-circuit (spec §5.5): when the user's stack starts
  // with -apple-system / system-ui / BlinkMacSystemFont / Segoe UI, do NOT
  // claim a specific name based on canvas — name it honestly by OS.
  if (isSystemStack(requested)) {
    const os = detectOs();
    return {
      requested,
      rendered: OS_FRIENDLY_NAME[os] || 'System UI',
      isFallback: false,
      source: { type: 'system', format: null, url: null, os },
      isVariable: false,
      axes: null,
      metrics,
      confidence: 'high',
    };
  }

  const { family: rendered, low } = findRendered(requested, opts, cs);

  const firstNonGeneric = requested.find(f => !isGeneric(f)) || null;
  const isFallback = !!(rendered && firstNonGeneric && rendered !== firstNonGeneric);

  const source = rendered
    ? { ...classifySource(rendered, el.ownerDocument), os: null }
    : { type: 'system', format: null, url: null, os: detectOs() };

  return {
    requested,
    rendered,
    isFallback,
    source,
    isVariable: false,   // axis detection lands in Phase 4
    axes: null,
    metrics,
    confidence: low ? 'low' : 'high',
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/detector.test.js`
Expected: 6 tests pass.

- [ ] **Step 5: Run the full unit suite**

Run: `npm test`
Expected: All tests (parse-stack: 11, roles: 24, source-classify: 6, detector: 6) pass.

- [ ] **Step 6: Commit**

```bash
git add lib/detector.js lib/detector.test.js
git commit -m "feat(detector): orchestrator that composes parse/classify/render"
```

---

## Task 7: Browser test harness

A standalone HTML page that exercises the engine in a real browser. It intentionally constructs fallback, present, and system scenarios, runs `detect()` on each, and renders a visible pass/fail report. This is the regression bed for canvas detection that unit tests can't cover.

**Files:**
- Create: `test/harness/index.html`
- Create: `test/harness/harness.js`
- Create: `test/harness/fixtures.css`

### Layout of the page

Each fixture is a `<section>` with:
- An expected-output JSON `<script type="application/json">` block.
- A test element with controlled `font-family`.
- A results panel that compares actual vs expected and shows pass / fail.

### Files

- [ ] **Step 1: Create the CSS with controlled `@font-face` rules**

`test/harness/fixtures.css`:

```css
/* A self-hosted face that MUST load (data URL with a tiny real font). */
/* We use a real woff2 served from the local server so the test is honest. */
@font-face {
  font-family: "HarnessReal";
  src: url("./fonts/inter-400.woff2") format("woff2");
  font-display: block; /* block so we don't read before it's ready */
}

/* A face that will fail to load — wrong URL. */
@font-face {
  font-family: "HarnessMissing";
  src: url("./fonts/does-not-exist.woff2") format("woff2");
  font-display: block;
}

/* Visual baseline */
body { font: 16px/1.5 system-ui; padding: 24px; max-width: 880px; margin: 0 auto; }
.fixture { border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin: 12px 0; }
.fixture h2 { margin: 0 0 8px; font-size: 14px; }
.subject { font-size: 22px; }
.report { font: 12px/1.4 ui-monospace, Menlo, monospace; margin-top: 8px; }
.pass { color: #137333; }
.fail { color: #b3261e; }
```

- [ ] **Step 2: Create the HTML**

`test/harness/index.html`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>FontLens Detection Harness</title>
  <link rel="stylesheet" href="./fixtures.css">
</head>
<body>
  <h1>FontLens — Detection Harness</h1>
  <p>Open with: <code>npm run harness</code> then visit <code>http://localhost:5173/</code>.</p>

  <section class="fixture" id="fx-present">
    <h2>1. Present face (HarnessReal) — should detect HarnessReal, no fallback</h2>
    <script type="application/json" class="expect">
    { "rendered": "HarnessReal", "isFallback": false }
    </script>
    <div class="subject" style="font-family: 'HarnessReal', sans-serif">The quick brown fox</div>
    <pre class="report"></pre>
  </section>

  <section class="fixture" id="fx-fallback">
    <h2>2. Missing face (HarnessMissing) — should detect a fallback</h2>
    <script type="application/json" class="expect">
    { "rendered_not": "HarnessMissing", "isFallback": true }
    </script>
    <div class="subject" style="font-family: 'HarnessMissing', Arial, sans-serif">The quick brown fox</div>
    <pre class="report"></pre>
  </section>

  <section class="fixture" id="fx-system">
    <h2>3. System stack — should label source as system</h2>
    <script type="application/json" class="expect">
    { "source_type": "system" }
    </script>
    <div class="subject" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">The quick brown fox</div>
    <pre class="report"></pre>
  </section>

  <section class="fixture" id="fx-generic-only">
    <h2>4. Only a generic keyword — should not flag fallback</h2>
    <script type="application/json" class="expect">
    { "isFallback": false }
    </script>
    <div class="subject" style="font-family: serif">The quick brown fox</div>
    <pre class="report"></pre>
  </section>

  <script type="module" src="./harness.js"></script>
</body>
</html>
```

- [ ] **Step 3: Create the harness driver**

`test/harness/harness.js`:

```js
import { detect } from '../../lib/detector.js';

await document.fonts.ready;

const fixtures = document.querySelectorAll('.fixture');
let passes = 0, fails = 0;

for (const fx of fixtures) {
  const subject = fx.querySelector('.subject');
  const expect = JSON.parse(fx.querySelector('.expect').textContent);
  const out = detect(subject);

  const errors = [];
  if ('rendered' in expect && out.rendered !== expect.rendered) {
    errors.push(`rendered: expected ${expect.rendered}, got ${out.rendered}`);
  }
  if ('rendered_not' in expect && out.rendered === expect.rendered_not) {
    errors.push(`rendered: expected NOT to be ${expect.rendered_not}, got ${out.rendered}`);
  }
  if ('isFallback' in expect && out.isFallback !== expect.isFallback) {
    errors.push(`isFallback: expected ${expect.isFallback}, got ${out.isFallback}`);
  }
  if ('source_type' in expect && out.source.type !== expect.source_type) {
    errors.push(`source.type: expected ${expect.source_type}, got ${out.source.type}`);
  }

  const report = fx.querySelector('.report');
  if (errors.length === 0) {
    passes++;
    report.classList.add('pass');
    report.textContent = `PASS\n${JSON.stringify(out, null, 2)}`;
  } else {
    fails++;
    report.classList.add('fail');
    report.textContent = `FAIL\n${errors.join('\n')}\n---\n${JSON.stringify(out, null, 2)}`;
  }
}

const summary = document.createElement('h2');
summary.textContent = `Summary: ${passes} passed, ${fails} failed`;
summary.style.color = fails ? '#b3261e' : '#137333';
document.body.insertBefore(summary, document.querySelector('.fixture'));
```

- [ ] **Step 4: Download a real Inter woff2 for fixture #1**

The engineer should download a small Inter Regular woff2 file from the [Inter GitHub release](https://github.com/rsms/inter/releases) (any recent version) and place it at `test/harness/fonts/inter-400.woff2`. This is a real binary, not committed via the plan — pulled by the engineer once.

Create the directory and add a `.gitkeep`:

```bash
mkdir -p test/harness/fonts
touch test/harness/fonts/.gitkeep
```

Add this line to the existing `.gitignore` so we don't commit the binary by accident in this repo:

```
test/harness/fonts/*.woff2
test/harness/fonts/*.woff
test/harness/fonts/*.ttf
!test/harness/fonts/.gitkeep
```

- [ ] **Step 5: Update .gitignore**

Open `.gitignore` and append the lines from Step 4 above.

- [ ] **Step 6: Run the harness manually**

```bash
npm run harness
```

Then visit `http://localhost:5173/` in Chrome. Expected:
- Fixture 1 (HarnessReal present): **PASS** — only if the engineer placed `inter-400.woff2` in the fonts folder. If absent, fixture 1 will likely FAIL — that confirms the detector correctly notices the missing font.
- Fixture 2 (HarnessMissing): **PASS** — `isFallback: true`, rendered is one of Arial / sans-serif.
- Fixture 3 (system stack): **PASS** — `source.type: 'system'`.
- Fixture 4 (generic only): **PASS** — `isFallback: false`.

If any unexpected fail occurs, do NOT proceed — the engine has a real bug. Investigate before committing.

- [ ] **Step 7: Commit**

```bash
git add test/harness/ .gitignore
git commit -m "test(detector): browser harness for canvas fingerprint + sources"
```

---

## Task 8: Sanity check against a real-world site

Final validation — open `test/harness/index.html` is not enough; the engine must behave on a real complex page.

- [ ] **Step 1: Open Chrome DevTools on `https://stripe.com`**

- [ ] **Step 2: Paste this into the console**

```js
const s = await import('http://localhost:5173/../../lib/detector.js'); // won't work cross-origin — see Step 3
```

Cross-origin import won't work. Use this alternative: in DevTools Sources, add a snippet that pastes the entire `detector.js` (plus its dependencies inlined) and run it on the page. Or — simpler — load the snippet via a tampermonkey-style userscript.

**Easier path for this sanity check:** copy the contents of `lib/parse-stack.js`, `lib/source-classify.js`, `lib/render-detect.js`, and `lib/detector.js` into one IIFE, paste in console, then run `detect(document.querySelector('h1'))`.

- [ ] **Step 3: Verify the output**

Expected on stripe.com:
- `requested` contains a real custom family (e.g., `"sohne-var"` or similar at the time of testing — Stripe changes this).
- `rendered` either equals `requested[0]` if the face loaded, or is a system fallback if it didn't.
- `source.type` is one of `self-hosted` / `unknown`.
- `metrics.size`, `weight`, `lineHeight`, `color.hex` are populated.

If the output looks coherent, Phase 1 is complete. If not, file a note in `docs/notes/phase1-real-world.md` and investigate before phase 2.

- [ ] **Step 4: No commit needed for the sanity check** — it's a manual verification.

---

## Task 9: Phase 1 closeout

- [ ] **Step 1: Run the full test suite once more**

```bash
npm test
```

Expected: all unit tests pass (≥47 tests across four files).

- [ ] **Step 2: Push to GitHub**

```bash
git push origin main
```

- [ ] **Step 3: Tag the milestone**

```bash
git tag -a phase1-engine -m "Phase 1: detection engine + test harness"
git push origin phase1-engine
```

- [ ] **Step 4: Move to Phase 2**

When ready, request the Phase 2 plan ("Overlay + hover chip") from the planning agent. It will pick up `lib/detector.js` as a black-box and build the Shadow-DOM overlay around it.

---

## Acceptance criteria (gate for Phase 2)

Phase 1 is done when ALL of these are true:

- [ ] `npm test` passes with zero failures.
- [ ] `test/harness/index.html` shows 4 / 4 PASS on a real Chrome.
- [ ] Running the engine in the Stripe DevTools console returns a coherent detect() result.
- [ ] `lib/detector.js` exports `detect(el)` and is the only public symbol used by future phases.
- [ ] Roles inference (`lib/roles.js`) exports `inferRole(el, metrics)` and is independently testable.
- [ ] `git tag phase1-engine` is pushed.

---

## Notes for the implementer

- **Do not start any UI work in this phase.** The temptation is real. Resist. A solid engine is the whole point of Phase 1.
- **Do not skip the harness.** Canvas behavior in real browsers is the highest-risk part of the project. Visible pass/fail in a browser is the only honest validation.
- **Confidence flag matters later.** Phase 3 (side panel) will show a low-confidence indicator in the row for any style whose `confidence === 'low'`. Keep it accurate.
- **Don't add features.** No variable-font axis reading yet (Phase 4). No `iframe` walking (Phase 5). Resist scope creep — every line not needed in Phase 1 is risk you don't have to manage now.
