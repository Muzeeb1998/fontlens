# Phase 6 — Chrome Web Store Prep + Launch

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship FontLens 1.0.0 to the Chrome Web Store. Take the working extension built in Phases 1–5 and produce every artifact the store demands: a clean zip, four PNG icons rendered from a single SVG source, five screenshots that lead with the fallback chip wedge, store copy, the privacy questionnaire answers, and a pre-submit QA pass on five real sites. End with the submission landed in the Web Store developer dashboard and the post-submit triage routine documented.

**Architecture:** Three streams.
1. **Bundle stream** — a Node build script that produces `dist/fontlens-1.0.0.zip` containing only what Chrome needs, plus a TDD-driven audit script that walks the zip and asserts the MV3-required absences (`eval`, remote URLs, dynamic imports, source maps pointing offsite).
2. **Visual stream** — one source SVG of the amber-wedge mark, rendered to 16/32/48/128 PNGs via a deterministic Node script; five screenshot HTML fixtures rendered by Puppeteer to PNG at Chrome's required dimensions.
3. **Copy + submission stream** — Markdown source for store listing copy, a YAML map from Chrome's privacy questionnaire fields to verbatim answers, the pre-submit QA checklist, and the dashboard submission walkthrough.

**Tech Stack:** Node ≥ 20, vanilla JS, `archiver` for zip, `sharp` for SVG → PNG rasterization, Puppeteer (already a devDependency from Phase 5 if present; otherwise added here) for screenshot generation. Vitest for the bundle-audit script. No build step for the extension itself — MV3 ships the source as-is.

**Spec section this implements:** `docs/specs/launch1-design.md` §12 (Week 6 — Store prep). Also satisfies §4.6 manifest constraints, the §3 "all processing local" trust signal, and `DESIGN.md` §7 (icon set 16/32/48/128).

---

## File Structure (new artifacts only — Phases 1–5 source untouched)

```
fontlens/
├── package.json                          [Task 1 — add scripts + deps]
├── build/
│   ├── package.js                        [Task 2]
│   ├── render-icons.js                   [Task 3]
│   ├── render-screenshots.js             [Task 5]
│   ├── audit-bundle.js                   [Task 6]
│   └── audit-bundle.test.js              [Task 6]
├── assets/
│   └── icons/
│       ├── source.svg                    [Task 3 — amber-wedge mark]
│       ├── 16.png                        [Task 3 — generated]
│       ├── 32.png                        [Task 3 — generated]
│       ├── 48.png                        [Task 3 — generated]
│       └── 128.png                       [Task 3 — generated]
├── store/
│   ├── listing.md                        [Task 4]
│   ├── privacy-answers.yaml              [Task 7]
│   ├── pre-submit-qa.md                  [Task 8]
│   ├── submission-walkthrough.md         [Task 9]
│   ├── post-submit-monitoring.md         [Task 10]
│   └── screenshots/
│       ├── fixtures/
│       │   ├── 1-hero-fallback.html      [Task 5]
│       │   ├── 2-side-panel.html         [Task 5]
│       │   ├── 3-tailwind-toast.html     [Task 5]
│       │   ├── 4-variable-axis.html      [Task 5]
│       │   └── 5-fallback-banner.html    [Task 5]
│       ├── 1-hero-fallback.png           [Task 5 — generated, 1280x800]
│       ├── 2-side-panel.png              [Task 5 — generated, 1280x800]
│       ├── 3-tailwind-toast.png          [Task 5 — generated, 1280x800]
│       ├── 4-variable-axis.png           [Task 5 — generated, 1280x800]
│       └── 5-fallback-banner.png         [Task 5 — generated, 1280x800]
└── dist/
    └── fontlens-1.0.0.zip                [Task 2 — generated, .gitignored]
```

Boundaries:
- `build/` is build-time only and **never** included in the shipped zip. Tested directly with Vitest where logic exists.
- `store/` is the human-readable artifact set, source-of-truth for the dashboard fields.
- `assets/icons/source.svg` is the only icon source. The four PNGs are generated outputs — re-runnable.
- The audit (Task 6) is the gate: it runs against the final zip; if it fails, submission does not happen.

---

## Task 1: Build dependencies + scripts

**Files:**
- Modify: `package.json` (add scripts + devDependencies)
- Modify: `.gitignore` (add `dist/`)

- [ ] **Step 1: Add devDependencies and scripts to `package.json`**

Append to `devDependencies`:

```json
{
  "archiver": "^7.0.1",
  "sharp": "^0.33.5",
  "puppeteer": "^23.5.0",
  "js-yaml": "^4.1.0"
}
```

Append to `scripts`:

```json
{
  "build:icons": "node build/render-icons.js",
  "build:screenshots": "node build/render-screenshots.js",
  "build:zip": "node build/package.js",
  "build": "npm run build:icons && npm run build:zip",
  "audit:bundle": "node build/audit-bundle.js dist/fontlens-1.0.0.zip",
  "test:audit": "vitest run build/audit-bundle.test.js"
}
```

- [ ] **Step 2: Append to `.gitignore`**

```
dist/
assets/icons/*.png
!assets/icons/.gitkeep
store/screenshots/*.png
```

The generated PNGs are derived artifacts — re-runnable from `source.svg` and HTML fixtures, no value in committing.

- [ ] **Step 3: Install**

```bash
npm install
```

Verify all four packages install cleanly. `sharp` and `puppeteer` are large; expect ~150MB of `node_modules` growth. If the install fails, do not proceed — the icon and screenshot streams depend on these.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "chore(build): add archiver, sharp, puppeteer, js-yaml for store prep"
```

---

## Task 2: `build/package.js` — produce `dist/fontlens-1.0.0.zip`

The script bundles only what Chrome needs. Everything else (tests, docs, node_modules, build scripts, the source SVG, fixtures, .git) is excluded.

**Files:**
- Create: `build/package.js`

### Include list (relative paths from repo root)

```
manifest.json
service-worker.js
content/**
sidepanel/**
options/**
lib/**           (except *.test.js)
onboarding/**
assets/icons/16.png
assets/icons/32.png
assets/icons/48.png
assets/icons/128.png
```

### Exclude list (anywhere in the tree)

```
**/*.test.js
**/.DS_Store
**/.gitkeep
**/node_modules/**
**/test/**
docs/**
build/**
store/**
dist/**
.git/**
.gitignore
.github/**
README.md
LICENSE
DESIGN.md
vitest.config.js
package.json
package-lock.json
assets/icons/source.svg
```

`README.md` and `LICENSE` are deliberately excluded — the store listing replaces the README; license text is shown via the Web Store metadata, not the zip.

- [ ] **Step 1: Create `build/package.js`**

```js
#!/usr/bin/env node
// Produces dist/fontlens-<version>.zip ready for Chrome Web Store upload.
// Reads version from manifest.json so the zip name and the manifest stay in sync.

import { createWriteStream, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import archiver from 'archiver';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
const version = manifest.version;
const outPath = join(DIST, `fontlens-${version}.zip`);

if (!existsSync(DIST)) mkdirSync(DIST, { recursive: true });

const INCLUDE_GLOBS = [
  'manifest.json',
  'service-worker.js',
  'content/**/*',
  'sidepanel/**/*',
  'options/**/*',
  'lib/**/*',
  'onboarding/**/*',
  'assets/icons/16.png',
  'assets/icons/32.png',
  'assets/icons/48.png',
  'assets/icons/128.png',
];

const EXCLUDE_GLOBS = [
  '**/*.test.js',
  '**/.DS_Store',
  '**/.gitkeep',
  '**/__snapshots__/**',
];

const output = createWriteStream(outPath);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  const kb = (archive.pointer() / 1024).toFixed(1);
  console.log(`OK  ${outPath}  (${kb} KB)`);
});
archive.on('warning', (err) => { if (err.code !== 'ENOENT') throw err; });
archive.on('error', (err) => { throw err; });
archive.pipe(output);

for (const pattern of INCLUDE_GLOBS) {
  archive.glob(pattern, { cwd: ROOT, ignore: EXCLUDE_GLOBS, dot: false });
}

await archive.finalize();
```

- [ ] **Step 2: Verify all referenced source files exist**

Before running the build, confirm Phase 1–5 produced these:

```bash
test -f manifest.json && \
test -f service-worker.js && \
test -d content && \
test -d sidepanel && \
test -d options && \
test -d lib && \
test -d onboarding && \
echo "OK"
```

If any path is missing, stop and check Phase 1–5 acceptance criteria. Do not synthesize stubs — the zip must be a real, working extension.

- [ ] **Step 3: Run the build (icons must exist first — see Task 3)**

Skip running until after Task 3 completes. Task 3 generates the four PNGs the zip depends on.

- [ ] **Step 4: Commit**

```bash
git add build/package.js
git commit -m "build: package the extension into a Web Store-ready zip"
```

---

## Task 3: Icons — one SVG source, four PNG outputs

The mark is the amber-wedge motif: a stylized lowercase `f` whose negative-space dot is the amber fallback signal. The dot color matches `--amber-500` (`#f59e0b`). The glyph color matches `--fg` light (`#0f0f10`) so the icon reads on any toolbar background — Chrome renders icons on both light and dark Chrome themes.

**Files:**
- Create: `assets/icons/source.svg`
- Create: `build/render-icons.js`

### 3.1 Design constraints

- 128×128 baseline. All four sizes are downsamples — never upsamples.
- 16px target: the wedge must remain readable at 16×16 toolbar size. Use thick strokes (≥10px on the 128 baseline → ~1.25px at 16px) and a generous amber dot (≥14px on the 128 baseline → ~1.75px at 16px). Anything thinner disappears.
- Vector-clean: every coordinate on the 16-unit grid (multiples of 8 on a 128 baseline) to survive integer rounding at small sizes.
- No gradients, no shadows, no text — they alias badly at 16px.
- Transparent background (Chrome composites the icon over the user's toolbar color).

### 3.2 Create the SVG

- [ ] **Step 1: Create `assets/icons/source.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" fill="none">
  <!-- Outer rounded square: blank, just the safe area -->
  <!-- Lowercase 'f' wedge -->
  <path
    d="M 80 24
       Q 56 24 56 48
       L 56 56
       L 40 56
       L 40 72
       L 56 72
       L 56 104
       L 72 104
       L 72 72
       L 96 72
       L 96 56
       L 72 56
       L 72 48
       Q 72 40 80 40
       L 96 40
       L 96 24
       Z"
    fill="#0F0F10"
  />
  <!-- The amber fallback dot — the wedge's marketing asset -->
  <circle cx="96" cy="96" r="14" fill="#F59E0B" />
</svg>
```

The dot sits in the lower-right counter where a serif `f`'s terminal would land. It is intentionally outsized so it survives at 16px.

- [ ] **Step 2: Visual sanity check (manual, before rendering PNGs)**

Open `assets/icons/source.svg` in a browser. Then zoom out to roughly 12.5% (Cmd+- five times in Chrome) — that approximates 16px. The amber dot must still be a recognizable circle. If it disappears, increase the `r` value to 16 and re-check.

- [ ] **Step 3: Create the PNG renderer `build/render-icons.js`**

```js
#!/usr/bin/env node
// Render assets/icons/source.svg to 16/32/48/128 PNGs via sharp.
// Idempotent — re-running overwrites the four PNGs.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC  = join(ROOT, 'assets/icons/source.svg');
const SIZES = [16, 32, 48, 128];

const svg = readFileSync(SRC);

for (const size of SIZES) {
  const out = join(ROOT, `assets/icons/${size}.png`);
  // density scales the SVG rasterization — higher density at the same
  // output size = sharper edges for the small icons.
  const density = Math.round((size / 128) * 384) || 96;
  const png = await sharp(svg, { density: Math.max(density, 96) })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
  writeFileSync(out, png);
  console.log(`OK  ${out}  (${png.length} bytes)`);
}
```

- [ ] **Step 4: Run it**

```bash
npm run build:icons
```

Expected output: four PNG files written to `assets/icons/`, sizes printed in bytes. The 16 should be under 1 KB; the 128 under 5 KB.

- [ ] **Step 5: Verify the icons render in Chrome**

```bash
# Macro check — open each in your image viewer or browser
open assets/icons/16.png assets/icons/32.png assets/icons/48.png assets/icons/128.png
```

For each, confirm: (a) background is transparent, (b) the amber dot is visibly amber (not muddy), (c) the `f` glyph is recognizable.

- [ ] **Step 6: Add `.gitkeep` and commit the source SVG and the renderer**

```bash
touch assets/icons/.gitkeep
git add assets/icons/source.svg assets/icons/.gitkeep build/render-icons.js
git commit -m "feat(icons): amber-wedge SVG mark + Node renderer for 16/32/48/128"
```

The PNGs themselves are `.gitignore`d (Task 1 Step 2) — they're regenerated on every build.

---

## Task 4: Store listing copy

Per Chrome Web Store 2026 requirements: **name ≤ 75 chars**, **short description ≤ 132 chars** (shown in search results), **long description ≤ 16,000 chars** (shown on listing page, supports paragraphs and bullet-style line breaks but no Markdown).

**Files:**
- Create: `store/listing.md`

### 4.1 Voice rules (per DESIGN.md §1)

- Honest over clever. No "revolutionary," no "AI-powered."
- Lead with the wedge: fallback detection. Every other feature is supporting cast.
- Concise. Designers and developers both skim. Every line earns its place.

- [ ] **Step 1: Create `store/listing.md`**

```markdown
# FontLens — Chrome Web Store listing copy

Paste these fields verbatim into https://chrome.google.com/webstore/devconsole
on the Store Listing tab. Character counts are validated against Chrome's
2026 limits.

---

## Name (≤ 75 chars)

FontLens — Font Inspector & Fallback Detector

(48 chars)

---

## Short description (≤ 132 chars — shown in search results)

See the font the page asked for and the font visitors actually render. Copy as CSS, Tailwind, or design token. Local-only.

(131 chars)

---

## Category

Developer Tools (primary)

---

## Language

English (United States)

---

## Long description (≤ 16,000 chars)

FontLens shows you what no other font inspector will: when a site asks for one font and visitors see another.

Most font tools just read the CSS. FontLens reads the CSS *and* checks what the browser actually rendered. If "Söhne" failed to load and visitors are seeing Arial, FontLens flags it with an amber dot. That's the one thing that matters and the one thing no one else gets right.

WHAT IT DOES

• Hover any element to see the rendered font, weight, size, line-height, and color in a small floating chip.
• Spot fallbacks instantly — an amber dot appears on the chip whenever the requested font isn't loading.
• Click an element to extract every distinct type style on the page, grouped by font family, sorted by usage.
• Copy any style as CSS, Tailwind classes, or a design token with one click.
• See the full picture: a page-level banner tells you when any font on the page is falling back.
• Audition variable font axes — sliders let you preview weight, width, optical size live on the page.

WHO IT IS FOR

• Designers handing off type to engineers and wanting a clean token export.
• Frontend developers debugging why a custom font isn't showing up in production.
• Anyone auditing a marketing site for typography drift.

PRIVACY

All processing happens inside your browser. FontLens never sends a network request, never loads remote code, never includes analytics. The extension permission list is the minimum Chrome requires for a tab-inspection tool: activeTab, scripting, sidePanel, storage. No host_permissions. No background data collection. No telemetry.

If you don't trust the description, you don't have to — the source is open and the bundle ships only what you can read.

HOW TO USE IT

1. Click the FontLens icon in your toolbar, or press Alt+Shift+F on any page.
2. The side panel opens. Hover any element to inspect it.
3. Click an element to extract every type style on the page.
4. Hover a row in the side panel to reveal copy buttons. One click and the style is on your clipboard.

WHAT'S NEXT

Free font alternatives and Figma export are on the roadmap. There's a notify-me button in the side panel footer — opt in only if you want to be told when they ship.

SUPPORT

File issues at the GitHub repository linked in the support URL field. No telemetry, no email harvesting, no surprises.

---

## Support URL

(populate with the FontLens GitHub repository issues URL at submission time, e.g.,
 https://github.com/<owner>/fontlens/issues — exact owner set during Task 9 dashboard upload)

---

## Single-purpose statement (required by Chrome Web Store)

FontLens inspects the typography of the current web page and copies styles as
CSS, Tailwind, or design tokens. It does not modify pages persistently, does
not collect data, and does not communicate with any remote server.

---

## Permission justifications (required, ≤ 1000 chars each)

### activeTab
Used to inspect the currently-focused tab when the user clicks the FontLens
toolbar icon or presses the keyboard shortcut. No background access. The
permission scope is the user-initiated tab only.

### scripting
Used to inject the FontLens content script and Shadow-DOM overlay into the
current tab on user action. Required to read computed styles and render the
hover chip. No remote code is loaded; all scripts ship inside the extension.

### sidePanel
Used to open the FontLens side panel, which displays the extracted type
system. The Side Panel API is preferred over a popup because the panel must
persist across page clicks while the user inspects elements.

### storage
Used to persist the user's theme preference (auto/light/dark), default copy
format (CSS/Tailwind/Token), and the optional "notify me" email if the user
chooses to share it. Stored in chrome.storage.local — never transmitted.

---

## Promotional images (optional, populated in Task 5)

• Small promo tile: 440×280 — not produced for Launch 1 (optional field).
• Marquee: 1400×560 — not produced for Launch 1 (optional field).

Launch 1 ships with screenshots only. Promo tiles are a Launch 2 polish item.

---

## Screenshots (required, 1–5 — see Task 5)

5 screenshots at 1280×800 are produced by build/render-screenshots.js and
uploaded in the order listed in store/screenshots/.

---

## Version (must match manifest.json)

1.0.0

---

## Privacy disclosure summary (see store/privacy-answers.yaml for the full
questionnaire)

• Single purpose: inspect on-page typography.
• Data collected: none.
• Data sold: none.
• Remote code: none.
```

- [ ] **Step 2: Character-count validation (manual)**

Open `store/listing.md` in any editor that shows character counts. Confirm:
- Name ≤ 75 chars
- Short description ≤ 132 chars
- Long description ≤ 16,000 chars (current draft is well under — leaves room for support-URL edits)
- Each permission justification ≤ 1000 chars

If any limit is exceeded, trim — do not invent value.

- [ ] **Step 3: Commit**

```bash
git add store/listing.md
git commit -m "docs(store): Web Store listing copy with permission justifications"
```

---

## Task 5: Five screenshots (1280×800 PNG)

Chrome Web Store accepts screenshots at **1280×800 or 640×400**. We ship 1280×800 — larger source survives the store's display scaling.

The five screenshots, ordered:

1. **Hero — hover chip showing fallback** on a realistic article page. This is the marketing asset.
2. **Side panel hybrid layout** — multiple family cards visible, one of them a fallback card.
3. **Copy-as-Tailwind toast** — captured mid-fade-in.
4. **Variable font slider in action** — `wght` slider mid-drag, specimen reflowing.
5. **Page-level fallback banner** — top of side panel, banner reading "⚠ 2 of this page's fonts aren't loading."

**Files:**
- Create: `store/screenshots/fixtures/1-hero-fallback.html`
- Create: `store/screenshots/fixtures/2-side-panel.html`
- Create: `store/screenshots/fixtures/3-tailwind-toast.html`
- Create: `store/screenshots/fixtures/4-variable-axis.html`
- Create: `store/screenshots/fixtures/5-fallback-banner.html`
- Create: `build/render-screenshots.js`

### 5.1 Approach

Each fixture is a static HTML page that **renders the actual FontLens UI** by importing the real Shadow-DOM overlay code and side-panel HTML/CSS from the extension. We do not paint mock screenshots — the screenshots show the real product.

The fixtures position a synthesized article page underneath and the FontLens UI on top at the exact pixel location it would occupy in a real Chrome window. Puppeteer renders each fixture at 1280×800 and writes the PNG.

- [ ] **Step 1: Create the hero fixture `store/screenshots/fixtures/1-hero-fallback.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>FontLens — Screenshot 1 hero</title>
  <style>
    @font-face {
      /* Intentionally points at a URL that will not resolve — guarantees fallback */
      font-family: "Söhne";
      src: url("./does-not-exist.woff2") format("woff2");
      font-display: block;
    }
    body { margin: 0; font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1a1a1a; background: #ffffff; }
    .page { max-width: 720px; padding: 80px 64px; }
    .article-eyebrow { font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #6b6b6e; }
    .article-title { font-family: "Söhne", Georgia, serif; font-size: 48px; line-height: 1.1; font-weight: 600; margin: 16px 0 24px; }
    .article-body { font-family: "Söhne", Georgia, serif; font-size: 18px; line-height: 1.7; color: #2a2a2c; margin: 0 0 18px; }
    /* The FontLens chip — actual production overlay markup pasted in for screenshot */
    .fl-chip {
      position: fixed; left: 312px; top: 220px;
      background: #ffffff; color: #0f0f10;
      border: 1px solid #ececec; border-radius: 10px;
      padding: 10px 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.18);
      font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      min-width: 220px;
    }
    .fl-chip .fl-name { font-weight: 600; font-size: 14px; margin-bottom: 4px; }
    .fl-chip .fl-metrics { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; color: #6b6b6e; }
    .fl-chip .fl-fallback { display: flex; align-items: center; gap: 6px; margin-top: 8px; padding-top: 8px; border-top: 1px solid #ececec; font-size: 12px; color: #7a4a1d; }
    .fl-chip .fl-amber-dot { width: 8px; height: 8px; border-radius: 999px; background: #f59e0b; flex: 0 0 8px; }
    .fl-chip .fl-requested { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; color: #6b6b6e; margin-top: 2px; }
  </style>
</head>
<body>
  <div class="page">
    <div class="article-eyebrow">Long Reads · 8 min</div>
    <h1 class="article-title">The font you asked for isn't always the font your visitors see.</h1>
    <p class="article-body">Almost before we knew it, we had left the ground. The browser tried to fetch Söhne. It failed silently. Every visitor on the page is reading this paragraph in Georgia instead — and no one on the team knows.</p>
    <p class="article-body">FontLens tells you the moment your hand leaves the mouse.</p>
  </div>

  <div class="fl-chip" role="img" aria-label="FontLens hover chip showing fallback">
    <div class="fl-name">Georgia</div>
    <div class="fl-metrics">48px · 600 · 53/48 · #1a1a1a</div>
    <div class="fl-fallback"><span class="fl-amber-dot"></span> fallback</div>
    <div class="fl-requested">requested: Söhne</div>
  </div>
</body>
</html>
```

The chip is positioned to overlap the headline — the amber dot is the visual hook. This is the screenshot store visitors will see first.

- [ ] **Step 2: Create the side panel fixture `store/screenshots/fixtures/2-side-panel.html`**

This fixture imports the real `sidepanel/panel.html` body markup and `sidepanel/panel.css`. Approach: render an iframe of the actual side-panel page seeded with deterministic detection results.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>FontLens — Screenshot 2 side panel</title>
  <style>
    body { margin: 0; background: #f4f4f5; }
    .frame { width: 360px; height: 800px; margin: 0 auto; background: #ffffff; box-shadow: 0 0 0 1px #ececec; }
    .browser-chrome { height: 800px; width: 920px; background: linear-gradient(180deg, #f0f0f3 0 56px, #ffffff 56px 800px); float: left; }
    .browser-content { padding: 80px 56px; font: 16px/1.6 -apple-system, sans-serif; color: #2a2a2c; }
    .layout { display: flex; }
  </style>
</head>
<body>
  <div class="layout">
    <div class="browser-chrome">
      <div class="browser-content">
        <h1 style="font: 600 36px/1.2 'Inter', system-ui">Pricing</h1>
        <p>The page Pretexual content visible behind the side panel for context.</p>
      </div>
    </div>
    <iframe class="frame" src="../../../sidepanel/panel.html?fixture=2"></iframe>
  </div>
  <script>
    // The fixture query parameter tells panel.js to load the seeded fixture
    // dataset instead of running live detection. panel.js handles the
    // ?fixture= switch in Phase 3 — if not yet implemented, see Implementer
    // Notes at the bottom of this plan.
  </script>
</body>
</html>
```

- [ ] **Step 3: Create the Tailwind toast fixture `store/screenshots/fixtures/3-tailwind-toast.html`**

Same layout as fixture 2, with `?fixture=3-toast` triggering panel.js to render the toast in its "dwell" state (visible, fully faded in).

```html
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>FontLens — Screenshot 3 Tailwind toast</title>
<style>body{margin:0;background:#f4f4f5}.frame{width:360px;height:800px;margin:0 auto;box-shadow:0 0 0 1px #ececec}</style>
</head>
<body><iframe class="frame" src="../../../sidepanel/panel.html?fixture=3-toast"></iframe></body>
</html>
```

- [ ] **Step 4: Create the variable axis fixture `store/screenshots/fixtures/4-variable-axis.html`**

`?fixture=4-axis` triggers panel.js to render a family card with the variable-font slider mid-drag, specimen line styled at the dragged `wght` value.

```html
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>FontLens — Screenshot 4 variable axis</title>
<style>body{margin:0;background:#f4f4f5}.frame{width:360px;height:800px;margin:0 auto;box-shadow:0 0 0 1px #ececec}</style>
</head>
<body><iframe class="frame" src="../../../sidepanel/panel.html?fixture=4-axis"></iframe></body>
</html>
```

- [ ] **Step 5: Create the fallback banner fixture `store/screenshots/fixtures/5-fallback-banner.html`**

`?fixture=5-banner` triggers panel.js to render the page-level amber banner at the top of the panel.

```html
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>FontLens — Screenshot 5 banner</title>
<style>body{margin:0;background:#f4f4f5}.frame{width:360px;height:800px;margin:0 auto;box-shadow:0 0 0 1px #ececec}</style>
</head>
<body><iframe class="frame" src="../../../sidepanel/panel.html?fixture=5-banner"></iframe></body>
</html>
```

- [ ] **Step 6: Create the Puppeteer renderer `build/render-screenshots.js`**

```js
#!/usr/bin/env node
// Render the five fixtures to PNG at 1280x800 (Chrome Web Store standard).
// Each fixture is a static HTML file. The renderer serves the repo via
// a tiny http server so iframes that point at sidepanel/panel.html resolve.

import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { resolve, dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 5174;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.woff2':'font/woff2',
};

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const file = join(ROOT, decodeURIComponent(url.pathname));
  try {
    const data = readFileSync(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('not found');
  }
});

await new Promise((r) => server.listen(PORT, r));
console.log(`serving repo at http://localhost:${PORT}/`);

const FIXTURES = [
  ['1-hero-fallback',  '/store/screenshots/fixtures/1-hero-fallback.html'],
  ['2-side-panel',     '/store/screenshots/fixtures/2-side-panel.html'],
  ['3-tailwind-toast', '/store/screenshots/fixtures/3-tailwind-toast.html'],
  ['4-variable-axis',  '/store/screenshots/fixtures/4-variable-axis.html'],
  ['5-fallback-banner','/store/screenshots/fixtures/5-fallback-banner.html'],
];

const browser = await puppeteer.launch({
  headless: 'new',
  defaultViewport: { width: 1280, height: 800, deviceScaleFactor: 1 },
});
const page = await browser.newPage();

for (const [name, path] of FIXTURES) {
  await page.goto(`http://localhost:${PORT}${path}`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  const out = join(ROOT, 'store/screenshots', `${name}.png`);
  await page.screenshot({ path: out, type: 'png', clip: { x: 0, y: 0, width: 1280, height: 800 } });
  console.log(`OK  ${out}`);
}

await browser.close();
server.close();
```

- [ ] **Step 7: Run the renderer**

```bash
npm run build:screenshots
```

Expected: five PNGs written to `store/screenshots/`. Each must be exactly 1280×800 (verify with `file store/screenshots/*.png` or open in any viewer).

- [ ] **Step 8: Visual review each screenshot**

Open each PNG and check:
1. `1-hero-fallback.png` — amber dot visible on the chip, "fallback" label readable, headline behind chip not obscured.
2. `2-side-panel.png` — at least three family cards visible, one of them with the amber fallback border.
3. `3-tailwind-toast.png` — toast at bottom-right of the panel, reading "Copied as Tailwind."
4. `4-variable-axis.png` — slider visible inside a card, specimen line styled at a non-default weight.
5. `5-fallback-banner.png` — amber banner across the top of the panel.

If any screenshot looks empty / broken / unreadable, the underlying panel.js fixture handler likely needs adjustment — fix it in Phase 3 territory or coordinate before submitting.

- [ ] **Step 9: Commit fixtures and renderer (PNGs are .gitignored)**

```bash
git add build/render-screenshots.js store/screenshots/fixtures/
git commit -m "feat(store): five 1280x800 screenshots from real UI fixtures"
```

---

## Task 6: Bundle audit script (TDD)

This is the gate. The script unzips `dist/fontlens-1.0.0.zip` into a temp directory and asserts:

- Every file inside is one of the allowed paths from Task 2.
- No file contains the substrings `eval(`, `new Function(`, `<script src="http`, `<script src='http`, `import(` with an http URL, or `__webpack_require__` (catches a bundler that snuck in).
- No `<script>` tag references a remote URL.
- No `manifest.json` field declares `content_security_policy` with `unsafe-eval`.
- `manifest.json` has exactly `manifest_version: 3`, the four required permissions, no `host_permissions`, no `content_scripts` with `<all_urls>` matches outside `activeTab`.
- All four icon PNGs are present.

**Files:**
- Create: `build/audit-bundle.js`
- Create: `build/audit-bundle.test.js`

### 6.1 Write the failing tests first

- [ ] **Step 1: Create `build/audit-bundle.test.js`**

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import archiver from 'archiver';
import { createWriteStream } from 'node:fs';
import { auditZip } from './audit-bundle.js';

let dir, zipPath;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'fontlens-audit-'));
  zipPath = join(dir, 'test.zip');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function buildZip(files) {
  return new Promise((res, rej) => {
    const out = createWriteStream(zipPath);
    const z = archiver('zip', { zlib: { level: 9 } });
    out.on('close', res); z.on('error', rej); z.pipe(out);
    for (const [name, content] of Object.entries(files)) {
      z.append(content, { name });
    }
    z.finalize();
  });
}

const VALID_MANIFEST = JSON.stringify({
  manifest_version: 3,
  name: 'FontLens',
  version: '1.0.0',
  permissions: ['activeTab', 'scripting', 'sidePanel', 'storage'],
  background: { service_worker: 'service-worker.js' },
  side_panel: { default_path: 'sidepanel/panel.html' },
  action: { default_title: 'Inspect fonts' },
  icons: { '16': 'assets/icons/16.png', '48': 'assets/icons/48.png', '128': 'assets/icons/128.png' },
});

describe('auditZip', () => {
  it('passes a clean bundle', async () => {
    await buildZip({
      'manifest.json': VALID_MANIFEST,
      'service-worker.js': 'self.addEventListener("install", () => {});',
      'content/content.js': 'console.log("hi");',
      'sidepanel/panel.html': '<!doctype html><script src="panel.js"></script>',
      'sidepanel/panel.js': 'document.title = "FontLens";',
      'options/options.html': '<!doctype html>',
      'lib/detector.js': 'export function detect() {}',
      'onboarding/demo.html': '<!doctype html>',
      'assets/icons/16.png':  Buffer.from([0x89,0x50,0x4e,0x47]),
      'assets/icons/32.png':  Buffer.from([0x89,0x50,0x4e,0x47]),
      'assets/icons/48.png':  Buffer.from([0x89,0x50,0x4e,0x47]),
      'assets/icons/128.png': Buffer.from([0x89,0x50,0x4e,0x47]),
    });
    const result = await auditZip(zipPath);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('fails when a file contains eval(', async () => {
    await buildZip({
      'manifest.json': VALID_MANIFEST,
      'service-worker.js': 'eval("nope")',
      'assets/icons/16.png':  Buffer.from([0x89]),
      'assets/icons/32.png':  Buffer.from([0x89]),
      'assets/icons/48.png':  Buffer.from([0x89]),
      'assets/icons/128.png': Buffer.from([0x89]),
    });
    const r = await auditZip(zipPath);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('eval'))).toBe(true);
  });

  it('fails when a file contains new Function(', async () => {
    await buildZip({
      'manifest.json': VALID_MANIFEST,
      'service-worker.js': 'const f = new Function("return 1");',
      'assets/icons/16.png':  Buffer.from([0x89]),
      'assets/icons/32.png':  Buffer.from([0x89]),
      'assets/icons/48.png':  Buffer.from([0x89]),
      'assets/icons/128.png': Buffer.from([0x89]),
    });
    const r = await auditZip(zipPath);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('new Function'))).toBe(true);
  });

  it('fails when an HTML file references a remote script', async () => {
    await buildZip({
      'manifest.json': VALID_MANIFEST,
      'sidepanel/panel.html': '<script src="https://cdn.example.com/x.js"></script>',
      'assets/icons/16.png':  Buffer.from([0x89]),
      'assets/icons/32.png':  Buffer.from([0x89]),
      'assets/icons/48.png':  Buffer.from([0x89]),
      'assets/icons/128.png': Buffer.from([0x89]),
    });
    const r = await auditZip(zipPath);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('remote script'))).toBe(true);
  });

  it('fails when manifest declares unsafe-eval CSP', async () => {
    const bad = JSON.parse(VALID_MANIFEST);
    bad.content_security_policy = { extension_pages: "script-src 'self' 'unsafe-eval'" };
    await buildZip({
      'manifest.json': JSON.stringify(bad),
      'assets/icons/16.png':  Buffer.from([0x89]),
      'assets/icons/32.png':  Buffer.from([0x89]),
      'assets/icons/48.png':  Buffer.from([0x89]),
      'assets/icons/128.png': Buffer.from([0x89]),
    });
    const r = await auditZip(zipPath);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('unsafe-eval'))).toBe(true);
  });

  it('fails when host_permissions is present', async () => {
    const bad = JSON.parse(VALID_MANIFEST);
    bad.host_permissions = ['<all_urls>'];
    await buildZip({
      'manifest.json': JSON.stringify(bad),
      'assets/icons/16.png':  Buffer.from([0x89]),
      'assets/icons/32.png':  Buffer.from([0x89]),
      'assets/icons/48.png':  Buffer.from([0x89]),
      'assets/icons/128.png': Buffer.from([0x89]),
    });
    const r = await auditZip(zipPath);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('host_permissions'))).toBe(true);
  });

  it('fails when an icon PNG is missing', async () => {
    await buildZip({
      'manifest.json': VALID_MANIFEST,
      'assets/icons/16.png':  Buffer.from([0x89]),
      'assets/icons/32.png':  Buffer.from([0x89]),
      'assets/icons/48.png':  Buffer.from([0x89]),
      // 128 missing
    });
    const r = await auditZip(zipPath);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('128.png'))).toBe(true);
  });

  it('fails when manifest_version is not 3', async () => {
    const bad = JSON.parse(VALID_MANIFEST);
    bad.manifest_version = 2;
    await buildZip({
      'manifest.json': JSON.stringify(bad),
      'assets/icons/16.png':  Buffer.from([0x89]),
      'assets/icons/32.png':  Buffer.from([0x89]),
      'assets/icons/48.png':  Buffer.from([0x89]),
      'assets/icons/128.png': Buffer.from([0x89]),
    });
    const r = await auditZip(zipPath);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('manifest_version'))).toBe(true);
  });

  it('fails when a required permission is missing', async () => {
    const bad = JSON.parse(VALID_MANIFEST);
    bad.permissions = ['activeTab']; // missing scripting, sidePanel, storage
    await buildZip({
      'manifest.json': JSON.stringify(bad),
      'assets/icons/16.png':  Buffer.from([0x89]),
      'assets/icons/32.png':  Buffer.from([0x89]),
      'assets/icons/48.png':  Buffer.from([0x89]),
      'assets/icons/128.png': Buffer.from([0x89]),
    });
    const r = await auditZip(zipPath);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('missing required permission'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests — confirm they fail**

```bash
npx vitest run build/audit-bundle.test.js
```

Expected: every test fails with `Cannot find module './audit-bundle.js'`.

### 6.2 Write the implementation

- [ ] **Step 3: Add `yauzl` to read the zip (CLI use only)**

```bash
npm install --save-dev yauzl
```

Append `"yauzl": "^3.1.3"` to the `package.json` devDependencies block from Task 1 (the install command does this automatically; verify after).

- [ ] **Step 4: Create `build/audit-bundle.js`**

```js
#!/usr/bin/env node
// Walks a Chrome extension zip and asserts MV3 hygiene + FontLens-specific
// guarantees: no eval, no remote code, no host_permissions, no telemetry.
//
// Exported for unit tests; the CLI entry runs auditZip on argv[2] and exits
// 0 (pass) or 1 (fail).

import yauzl from 'yauzl';

const SCANNED_EXTS = ['.js', '.mjs', '.html', '.htm', '.css', '.json'];

const FORBIDDEN_PATTERNS = [
  { name: 'eval',               re: /\beval\s*\(/ },
  { name: 'new Function',       re: /\bnew\s+Function\s*\(/ },
  { name: 'remote script tag',  re: /<script\b[^>]*\bsrc\s*=\s*['"]https?:\/\//i },
  { name: 'remote import URL',  re: /\bimport\s*\(\s*['"`]https?:\/\//i },
  { name: 'remote module URL',  re: /\bfrom\s+['"`]https?:\/\//i },
];

// Subset of HTTP(S) URLs that ARE allowed to appear as plain strings — these
// are documentation links inside source/comments, not loaded resources.
const ALLOWED_URL_HOSTS = [
  'github.com',
  'fonts.gstatic.com',     // referenced as a *pattern* in source-classify.js,
  'fonts.googleapis.com',  // not loaded
  'use.typekit.net',
  'use.fontawesome.com',
  'developer.chrome.com',
];

const REQUIRED_FILES = [
  'manifest.json',
  'assets/icons/16.png',
  'assets/icons/32.png',
  'assets/icons/48.png',
  'assets/icons/128.png',
];

const REQUIRED_PERMISSIONS = ['activeTab', 'scripting', 'sidePanel', 'storage'];

function openZip(path) {
  return new Promise((res, rej) => {
    yauzl.open(path, { lazyEntries: true }, (err, zip) => err ? rej(err) : res(zip));
  });
}

function readAll(zip) {
  return new Promise((res, rej) => {
    const entries = {};
    zip.readEntry();
    zip.on('entry', (entry) => {
      if (/\/$/.test(entry.fileName)) { zip.readEntry(); return; }
      zip.openReadStream(entry, (err, stream) => {
        if (err) return rej(err);
        const chunks = [];
        stream.on('data', (c) => chunks.push(c));
        stream.on('end', () => {
          entries[entry.fileName] = Buffer.concat(chunks);
          zip.readEntry();
        });
        stream.on('error', rej);
      });
    });
    zip.on('end', () => res(entries));
    zip.on('error', rej);
  });
}

export async function auditZip(path) {
  const zip = await openZip(path);
  const entries = await readAll(zip);
  const errors = [];
  const filenames = Object.keys(entries);

  // 1. Required files present
  for (const req of REQUIRED_FILES) {
    if (!filenames.includes(req)) errors.push(`missing required file: ${req}`);
  }

  // 2. Manifest validation
  if (entries['manifest.json']) {
    let m;
    try { m = JSON.parse(entries['manifest.json'].toString('utf8')); }
    catch { errors.push('manifest.json is not valid JSON'); m = null; }

    if (m) {
      if (m.manifest_version !== 3) errors.push(`manifest_version must be 3, got ${m.manifest_version}`);
      const perms = new Set(m.permissions || []);
      for (const req of REQUIRED_PERMISSIONS) {
        if (!perms.has(req)) errors.push(`manifest missing required permission: ${req}`);
      }
      for (const p of perms) {
        if (!REQUIRED_PERMISSIONS.includes(p)) errors.push(`manifest has extra permission: ${p}`);
      }
      if (m.host_permissions && m.host_permissions.length > 0) {
        errors.push(`manifest has host_permissions (forbidden): ${JSON.stringify(m.host_permissions)}`);
      }
      const csp = (m.content_security_policy?.extension_pages || '') + ' ' +
                  (m.content_security_policy?.sandbox || '');
      if (/unsafe-eval/.test(csp)) errors.push('manifest CSP allows unsafe-eval');
      if (/unsafe-inline/.test(csp)) errors.push('manifest CSP allows unsafe-inline');
    }
  }

  // 3. Forbidden pattern scan
  for (const [name, buf] of Object.entries(entries)) {
    const dot = name.lastIndexOf('.');
    const ext = dot >= 0 ? name.slice(dot).toLowerCase() : '';
    if (!SCANNED_EXTS.includes(ext)) continue;

    const text = buf.toString('utf8');
    for (const { name: label, re } of FORBIDDEN_PATTERNS) {
      const m = text.match(re);
      if (m) {
        // Allow the documented host strings inside source comments / pattern arrays
        if (label.startsWith('remote') && ALLOWED_URL_HOSTS.some((h) => m[0].includes(h))) continue;
        errors.push(`${name}: contains ${label}: ${m[0].slice(0, 60)}`);
      }
    }
  }

  return { ok: errors.length === 0, errors, fileCount: filenames.length };
}

// CLI entry
if (import.meta.url === `file://${process.argv[1]}`) {
  const path = process.argv[2];
  if (!path) { console.error('usage: audit-bundle.js <path-to-zip>'); process.exit(2); }
  const r = await auditZip(path);
  if (r.ok) {
    console.log(`OK  audit passed (${r.fileCount} files)`);
    process.exit(0);
  } else {
    console.error(`FAIL  ${r.errors.length} issue(s):`);
    for (const e of r.errors) console.error(`  - ${e}`);
    process.exit(1);
  }
}
```

- [ ] **Step 5: Run the unit tests — confirm they pass**

```bash
npx vitest run build/audit-bundle.test.js
```

Expected: 9 tests pass.

- [ ] **Step 6: Run the audit against the real bundle**

First build the zip (Tasks 2 + 3 must be done):

```bash
npm run build
npm run audit:bundle
```

Expected output: `OK audit passed (N files)`.

If audit fails, **fix the source** — do not loosen the audit. The most common cause is an accidental `eval(` left in a debug helper, or a comment URL that triggers the remote-script regex. The regex is intentionally strict; review the false-positive case and tighten the pattern only if the source is genuinely clean.

- [ ] **Step 7: Commit**

```bash
git add build/audit-bundle.js build/audit-bundle.test.js package.json package-lock.json
git commit -m "test(build): TDD bundle audit for MV3 hygiene + FontLens guarantees"
```

---

## Task 7: Privacy disclosure — questionnaire answers

Chrome Web Store requires answering ~10 specific questions on the Privacy practices tab. We pre-write them so submission is a copy-paste, not improvisation.

**Files:**
- Create: `store/privacy-answers.yaml`

The dashboard URL for this section is:
`https://chrome.google.com/webstore/devconsole/<dev-id>/<extension-id>/privacy`

- [ ] **Step 1: Create `store/privacy-answers.yaml`**

```yaml
# FontLens — Chrome Web Store Privacy Practices answers
#
# Copy verbatim into https://chrome.google.com/webstore/devconsole/ →
# select FontLens → Privacy practices tab.
#
# Source of truth: docs/specs/launch1-design.md §1, README.md, DESIGN.md §1.
# Top-level promise everywhere: "All processing local. No data leaves your
# browser. No analytics. No remote code."

single_purpose: |
  FontLens inspects the typography of the currently focused web page and
  copies styles as CSS, Tailwind classes, or design tokens. It is a
  developer/designer tool focused on one task: revealing what font a page
  asks for vs. what the visitor's browser actually renders.

permissions:
  activeTab: |
    Required to read the computed styles of the page the user is currently
    inspecting. Scoped to the user-initiated tab; no background access.
  scripting: |
    Required to inject the FontLens content script and Shadow-DOM overlay
    on user action. All scripts ship inside the extension package; no
    remote code is loaded.
  sidePanel: |
    Required to open the FontLens side panel, which persists across page
    navigations so users can inspect multiple elements without losing
    state. A popup would close on every page click.
  storage: |
    Required to persist the user's theme preference (auto/light/dark),
    default copy format (CSS/Tailwind/Token), and an optional opt-in
    email if they explicitly press "Send to developer." Stored in
    chrome.storage.local; never transmitted.

data_collection:
  # The dashboard asks "Are you collecting or using any of the following
  # user data?" for each of: personally identifiable info, health, financial,
  # authentication, personal communications, location, web history,
  # activity, website content.
  personally_identifiable_information: No
  health_information: No
  financial_and_payment_information: No
  authentication_information: No
  personal_communications: No
  location: No
  web_history: No
  user_activity: No
  website_content: No
  # FontLens reads the active tab's DOM ONLY in-memory and ONLY to render
  # the inspector UI. Nothing is persisted or transmitted off-device.

data_usage_certification:
  # Chrome dashboard requires three explicit certifications:
  do_not_sell_or_transfer_user_data: |
    FontLens does not sell or transfer any user data to third parties.
  do_not_use_or_transfer_for_unrelated_purposes: |
    FontLens does not use or transfer any user data for purposes unrelated
    to the single purpose stated above.
  do_not_use_or_transfer_for_creditworthiness_or_lending: |
    FontLens does not use or transfer any user data to determine
    creditworthiness or for lending purposes.

remote_code: |
  No. FontLens does not load or execute any remotely-hosted code. All
  JavaScript, CSS, HTML, and font assets are bundled in the extension
  package. The bundle audit (build/audit-bundle.js) is enforced at build
  time.

privacy_policy_url: |
  https://github.com/<owner>/fontlens#privacy
  # Section in the README that mirrors this YAML. URL is finalized on the
  # repo owner during Task 9 submission.

# ---------------------------------------------------------------
# Free-form summary the dashboard sometimes shows on the public listing.
# Lifted verbatim from the spec promise.
# ---------------------------------------------------------------
public_summary: |
  All processing local. No data leaves your browser. No analytics.
  No remote code.
```

- [ ] **Step 2: Cross-check with the actual code**

Before submission, grep the codebase to confirm the YAML is honest:

```bash
# 1. No fetch / XMLHttpRequest / navigator.sendBeacon anywhere in shipped code
grep -RnE "fetch\(|XMLHttpRequest|sendBeacon" content/ sidepanel/ service-worker.js lib/ options/ onboarding/ \
  | grep -v "test" \
  | grep -v "//"  || echo "OK: no network calls in shipped code"

# 2. No analytics SDKs
grep -RnE "(analytics|gtag|mixpanel|amplitude|segment)" content/ sidepanel/ service-worker.js lib/ options/ onboarding/ \
  || echo "OK: no analytics"
```

If grep finds matches that are not test files, **fix the source first** — do not lie on the questionnaire.

Note: the spec §8.3 "notify me" email capture explicitly says it POSTs only on a second explicit user action. Confirm that code path either (a) is gated behind an explicit button press and a confirmation dialog, or (b) is removed for Launch 1 and deferred to a later version. If (a), the YAML above is honest because no transmission happens without two user clicks. If (b), confirm grep finds zero `fetch(` calls.

- [ ] **Step 3: Commit**

```bash
git add store/privacy-answers.yaml
git commit -m "docs(store): privacy questionnaire answers mapped to dashboard fields"
```

---

## Task 8: Pre-submit QA checklist (manual)

The audit script catches code-level red flags; this catches behavior-level red flags. Run it on a fresh Chrome profile so cached fonts and saved theme don't mask bugs.

**Files:**
- Create: `store/pre-submit-qa.md`

- [ ] **Step 1: Create `store/pre-submit-qa.md`**

```markdown
# FontLens — Pre-submit QA

Run this before uploading the zip to the Web Store. Anything red here
means submission is blocked.

Tester: ______________   Date: __________   Chrome version: __________
Profile: a freshly-created Chrome profile (not your daily driver)

## Setup

- [ ] `npm run build` produced `dist/fontlens-1.0.0.zip` with the latest source.
- [ ] `npm run audit:bundle` returned OK with zero issues.
- [ ] Created a new Chrome profile via chrome://settings/manageProfile and
      opened a new browser window in that profile.
- [ ] Unzipped the bundle into a temp dir:
      `unzip dist/fontlens-1.0.0.zip -d /tmp/fontlens-qa`
- [ ] In Chrome, opened chrome://extensions, enabled Developer Mode (top
      right), clicked "Load unpacked," selected `/tmp/fontlens-qa`.
- [ ] Extension appeared in the toolbar with the amber-dot icon visible at
      16px. Pinned it to the toolbar.

## Five-site demo run

Each site below has historically been font-stack-heavy. Visit each, click
the FontLens icon (or press Alt+Shift+F), then walk through the demo
verifications.

### Site 1 — https://stripe.com

- [ ] Side panel opens within 500ms of clicking the toolbar icon.
- [ ] Hover the homepage hero headline — chip appears, shows a real face
      name (Stripe currently uses a custom 'sohne-var' family).
- [ ] If 'sohne-var' is not loading at hover time, the amber fallback dot
      is visible on the chip. If it IS loading, no amber dot. Either is a
      pass; the wedge only triggers when there's a real fallback.
- [ ] Click the headline — side panel populates with the family-grouped
      tree. At least 2 family cards visible.
- [ ] Hover a row in the side panel — page nodes highlight.
- [ ] Click "Copy CSS" on any row — toast appears bottom-right.
- [ ] Paste the clipboard into a text editor — output matches the
      DESIGN.md §6.5 specimen (font-family, weight, size, line-height,
      color all present).
- [ ] Open DevTools → Console: zero errors logged by FontLens.

### Site 2 — https://github.com

- [ ] Repeat the toolbar-click → hover → click → copy flow on the GitHub
      home page nav bar.
- [ ] Confirm GitHub's "mona-sans" variable font is detected and the
      side-panel family card shows the variable badge.
- [ ] Drag the wght slider — page text reflows live, with visible weight
      change on the inspected element.
- [ ] Slider release within 50ms returns to the original weight (or stays
      at the dragged value if the user clicks "Apply" — depends on the
      §8.3 implementation in Phase 4. Match whichever behavior Phase 4
      shipped.).
- [ ] Console: zero errors.

### Site 3 — https://www.notion.so

- [ ] Hover the marketing copy. Confirm Notion's self-hosted faces are
      labeled "Self-hosted" in the side panel.
- [ ] If any face fails to load (Notion has had this happen in
      production), confirm the page-level amber banner appears.
- [ ] Copy-as-Tailwind on a row. Confirm the output uses Tailwind
      utility classes (e.g., `font-medium text-[15px] leading-6`).
- [ ] Console: zero errors.

### Site 4 — https://en.wikipedia.org

- [ ] Hover the page title — chip shows a system stack (Wikipedia uses
      'Linux Libertine' for headings + system serif/sans for body).
- [ ] System stack handling: the side-panel "System" badge appears.
- [ ] No false amber dot (Wikipedia's stack resolves cleanly on every OS).
- [ ] Console: zero errors.

### Site 5 — https://news.ycombinator.com

- [ ] Hover the orange Y Combinator title — chip shows a system stack.
- [ ] Hover a story link — chip shows the same system stack with smaller
      metrics.
- [ ] Side panel: only one family card (Verdana) plus the system stack
      card. No fallback. No banner.
- [ ] Console: zero errors.

## Theme + accessibility checks

- [ ] In OS settings, switch to Dark mode. Side panel re-themes within
      one second of focus return (no reload required).
- [ ] Switch back to Light. Same.
- [ ] In the side panel header, click the theme toggle → Dark. Panel
      forces dark regardless of OS.
- [ ] Reload the panel. Theme preference persists (chrome.storage.local).
- [ ] Press Tab repeatedly from the side panel header. Focus ring is
      visible on every interactive element (mode toggle, theme toggle,
      each copy button when its row is hovered).
- [ ] In OS settings, enable "Reduce motion." Reload the panel. The
      hover-chip follow animation drops to instant (no 80ms ease). Toast
      still fades but at the short duration only.

## Onboarding (first install)

- [ ] Disable + re-enable the extension in chrome://extensions.
- [ ] New tab opens to `onboarding/demo.html`.
- [ ] Side panel auto-opens in Hover mode.
- [ ] Hovering the first paragraph (which intentionally requests a
      missing font) shows the amber fallback dot.
- [ ] Hovering the second paragraph (which loads its real face) shows no
      dot.
- [ ] "✓ You've seen the fallback signal" line is visible.
- [ ] "Try it on your favorite site" button closes the demo tab.

## Performance

- [ ] On stripe.com, open DevTools → Performance, start recording.
- [ ] Hover-scrub across the homepage hero for ~5 seconds.
- [ ] Stop recording. No long tasks (>50ms) attributable to FontLens
      content scripts.
- [ ] Click a complex section. Extraction completes in ≤500ms; the side
      panel doesn't block the page's main thread visibly.

## Gate

If any checkbox above is unchecked, **do not submit**. File the bug, fix
it, rebuild, re-run this checklist from the top on the same fresh
profile.

If every checkbox is checked, proceed to Task 9.
```

- [ ] **Step 2: Walk the checklist on a fresh Chrome profile**

This is human work — there is no scripted substitute. Allocate 45–60 minutes. Mark each box only after physically verifying.

- [ ] **Step 3: Commit (with the checklist clean — boxes empty in the committed copy)**

```bash
git add store/pre-submit-qa.md
git commit -m "docs(store): pre-submit QA checklist for five real sites + a11y"
```

The committed file has empty checkboxes — it's a template, re-run on every release.

---

## Task 9: Submit to the Chrome Web Store

The submission walk-through. Dashboard URLs are current as of 2026.

**Files:**
- Create: `store/submission-walkthrough.md`

- [ ] **Step 1: Create `store/submission-walkthrough.md`**

```markdown
# FontLens — Chrome Web Store submission walkthrough

A one-pass walk through the dashboard so the human submitting doesn't
have to context-switch between this doc and the spec.

## 0. Pre-flight

- All Task 8 checkboxes are checked.
- `dist/fontlens-1.0.0.zip` exists and `npm run audit:bundle` returned OK.
- Five PNG screenshots exist at `store/screenshots/`.
- `store/listing.md`, `store/privacy-answers.yaml` are committed.

## 1. Developer account

- Go to https://chrome.google.com/webstore/devconsole/
- Sign in with the Google account that will own FontLens.
- If first time: pay the one-time $5 developer fee. (Existing dev account:
  skip.)

## 2. Create the item

- Click "New item" (top right).
- Drag `dist/fontlens-1.0.0.zip` into the upload box.
- After the upload completes (~10–30 seconds), the dashboard lands on
  the Package tab with a green "Uploaded successfully" indicator.

## 3. Store listing tab

Path: left sidebar → Store listing.

- **Name** — paste from `store/listing.md` § Name.
- **Summary (short description)** — paste from `store/listing.md` §
  Short description.
- **Detailed description** — paste from `store/listing.md` § Long
  description. The textarea does not preserve Markdown; the paragraph
  breaks are preserved as plain newlines, which is what we wrote for.
- **Category** — Developer Tools.
- **Language** — English (United States).
- **Store icon (128×128)** — upload `assets/icons/128.png`.
- **Screenshots** — upload all five PNGs from `store/screenshots/`, in
  numerical order. The first uploaded is the lead image — make sure
  `1-hero-fallback.png` is first.
- **Promo tile small (440×280)** — leave blank for Launch 1.
- **Marquee tile (1400×560)** — leave blank for Launch 1.
- **Official URL** — repo URL.
- **Homepage URL** — repo URL.
- **Support URL** — `<repo-url>/issues`. Edit `store/listing.md` and
  `store/privacy-answers.yaml` with the final owner first, commit, then
  rebuild and re-upload if those values were changed.

Click **Save draft** (bottom right).

## 4. Privacy practices tab

Path: left sidebar → Privacy practices.

- **Single purpose** — paste `store/privacy-answers.yaml` § single_purpose.
- **Permission justifications** — for each permission in the dashboard's
  list, paste the matching block from `store/privacy-answers.yaml` §
  permissions. The dashboard shows one textarea per permission.
- **Data collection** — select "No" for every category. The questionnaire
  enumerates: PII, health, financial, authentication, personal
  communications, location, web history, user activity, website
  content.
- **Data usage certifications** — check all three boxes (do not sell, do
  not use for unrelated purposes, do not use for creditworthiness).
- **Remote code use** — select "No, I am not using remote code."
- **Privacy policy URL** — paste the README section URL from
  `store/privacy-answers.yaml`.

Click **Save draft**.

## 5. Distribution tab

Path: left sidebar → Distribution.

- **Visibility** — Public.
- **Geographic distribution** — All regions (default).
- **Pricing** — Free.
- **Mature content** — No.

Click **Save draft**.

## 6. Review and submit

- Return to the dashboard root for FontLens.
- The header shows a "Submit for review" button. Required-field warnings
  appear inline if anything is missing. Resolve each before continuing.
- Click **Submit for review**.
- A confirmation modal lists the build version and the estimated review
  window. As of 2026, typical review is 1–3 business days for an MV3
  extension with minimum permissions and no remote code. FontLens fits
  that profile.

## 7. After submission

- The dashboard shows status: "In review."
- You will receive an email at the developer account address when status
  changes.
- Do not modify or upload a new version while in review — it cancels the
  active review.

## 8. If the listing is rejected

- The rejection email cites a specific policy section. Read it, do not
  guess.
- Common rejection causes for MV3 extensions, ranked by likelihood:
  1. Missing or vague permission justifications — solved by Task 7.
  2. Listing screenshots that misrepresent functionality — solved by
     using the real UI in fixtures (Task 5).
  3. Long description that promises features the extension doesn't
     deliver — re-read `store/listing.md`; trim any aspirational copy.
- Fix the cited issue, bump the patch version in `manifest.json` and
  `build/package.js`, rebuild, re-upload, re-submit.

## 9. Publication

- When the listing transitions to "Published," the extension is live at
  `https://chrome.google.com/webstore/detail/<extension-id>`.
- The extension ID is permanent — record it in the project README under
  the Status section.
- Proceed to Task 10 monitoring.
```

- [ ] **Step 2: Commit**

```bash
git add store/submission-walkthrough.md
git commit -m "docs(store): step-by-step dashboard submission walkthrough"
```

---

## Task 10: Post-submit monitoring

What to watch in the first 14 days after publication. Goal: catch a regression or a confused reviewer fast.

**Files:**
- Create: `store/post-submit-monitoring.md`

- [ ] **Step 1: Create `store/post-submit-monitoring.md`**

```markdown
# FontLens — Post-submit monitoring playbook

The first two weeks after publication are when the signal is loudest:
real users on real sites, on Chrome versions and operating systems we
didn't test on. This is how to triage what comes in.

## Daily (first 14 days)

### 1. Dashboard items review

URL: https://chrome.google.com/webstore/devconsole/<dev-id>/<ext-id>/reviews

- Read every new review. Reply to legitimate questions within 24 hours.
- Star-rating drops below 4.0 with ≥5 reviews: pause and read every 1/2
  star review. Pattern-match the complaints.
- Look for the words "broken," "doesn't work," "crashes," "missing." Each
  is a bug ticket.

### 2. Dashboard developer feedback

URL: https://chrome.google.com/webstore/devconsole/<dev-id>/<ext-id>/feedback

- Chrome aggregates crash reports if any are tied to the extension ID.
  As of 2026, MV3 extensions show up here when the service worker
  crashes more than 0.1% of activations.
- An entry with a stack trace pointing at `service-worker.js:N` is a
  P0 bug. Reproduce locally first, then fix.

### 3. GitHub issues

URL: <repo-url>/issues

- Triage every new issue within 24 hours. Assign a severity:
  - P0: data loss, crash, broken on a top-1000 site → patch within 48h.
  - P1: feature regression vs. demo expectations → patch within 7 days.
  - P2: edge case, missing feature, polish → next release.
- Tag with `store-feedback` if the issue was filed by someone citing
  the Web Store listing.

## Weekly (first 8 weeks)

### 1. Install / uninstall ratio

URL: https://chrome.google.com/webstore/devconsole/<dev-id>/<ext-id>/stats

- Healthy: weekly uninstalls ≤ 25% of weekly installs.
- Concerning: ≥ 50%. Indicates the listing oversells or onboarding
  underdelivers. Action: revisit Tasks 4 and 5.

### 2. Performance regressions

- Re-run the Task 8 QA checklist on the published build. If any check
  that passed pre-submit now fails, ship a patch within 7 days.

### 3. Chrome update impact

- Chrome ships a new minor version roughly every 4 weeks. After each
  release, re-run sites 1 and 2 from the QA checklist on the new
  Chrome. MV3 has had quiet breaking changes in the past.

## Crash triage protocol

When a crash report comes in (dashboard or GitHub):

1. Get the URL where the crash occurred. If the user didn't share it,
   ask once politely — many do.
2. Open that URL in a fresh Chrome profile with FontLens installed.
3. If the crash reproduces: bisect — disable parts of the content
   script until the crash stops, then narrow.
4. If the crash does not reproduce: ask for Chrome version, OS, and
   exact reproduction steps. Tag the issue `needs-repro`.

## Posting a patch

- Bump `version` in `manifest.json` (patch: 1.0.0 → 1.0.1).
- Run `npm run build && npm run audit:bundle && npm test`.
- Walk the Task 8 QA checklist again — full pass, no shortcuts.
- Upload the new zip on the dashboard's Package tab. Submit.
- Patch reviews typically clear in 24 hours since the listing has
  established history.

## When to declare launch successful

After 14 days of monitoring, the launch is "successful" when all of:

- Install/uninstall ratio is below 25%.
- No P0 bugs are open.
- Average rating is ≥ 4.0 with ≥ 10 reviews.
- No crash-rate spikes flagged by the dashboard.

At that point, planning for Launch 2 (free-font alternatives, Figma
export) can start. Until then: monitor and patch.
```

- [ ] **Step 2: Commit**

```bash
git add store/post-submit-monitoring.md
git commit -m "docs(store): post-submit monitoring + crash triage playbook"
```

---

## Task 11: Phase 6 closeout

- [ ] **Step 1: Run the full pipeline end-to-end**

```bash
npm test                  # all units pass (Phases 1-5 + audit tests from Task 6)
npm run build             # icons + zip
npm run audit:bundle      # MV3 hygiene check
npm run build:screenshots # five PNGs at 1280x800
```

Expected:
- `npm test` → all suites pass.
- `npm run build` → `dist/fontlens-1.0.0.zip` written.
- `npm run audit:bundle` → `OK audit passed (N files)`.
- `npm run build:screenshots` → five PNGs in `store/screenshots/`.

- [ ] **Step 2: Walk the Task 8 pre-submit QA checklist on a fresh Chrome profile**

Manual. Allocate an hour. Every box checked.

- [ ] **Step 3: Submit via the Task 9 walkthrough**

The human submitting follows `store/submission-walkthrough.md` step by step.

- [ ] **Step 4: Tag the release**

```bash
git tag -a v1.0.0 -m "FontLens 1.0.0 — submitted to Chrome Web Store"
git push origin v1.0.0
```

- [ ] **Step 5: Update README.md Status section**

Once the listing is approved and published, edit `README.md` § Status to:

```
## Status

**Published.** FontLens 1.0.0 is live on the Chrome Web Store:
https://chrome.google.com/webstore/detail/<extension-id>

- Design system: [`DESIGN.md`](DESIGN.md)
- Launch 1 product spec: [`docs/specs/launch1-design.md`](docs/specs/launch1-design.md)
- Submission artifacts: [`store/`](store/)
```

Commit:

```bash
git add README.md
git commit -m "docs(readme): mark v1.0.0 published on Chrome Web Store"
git push
```

---

## Acceptance criteria

Phase 6 is done when ALL of these are true:

- [ ] `assets/icons/source.svg` exists; running `npm run build:icons` regenerates 16/32/48/128 PNGs deterministically.
- [ ] `npm run build` produces `dist/fontlens-1.0.0.zip` containing only the files listed in Task 2 (no docs, no tests, no node_modules, no build scripts, no .git).
- [ ] `npm run audit:bundle` against the zip returns `OK` with zero issues.
- [ ] `build/audit-bundle.test.js` has ≥9 passing tests covering: clean pass, eval, new Function, remote script tag, unsafe-eval CSP, host_permissions, missing icon, wrong manifest_version, missing required permission.
- [ ] Five PNG screenshots at exactly 1280×800 exist in `store/screenshots/`, ordered hero → side panel → toast → axis → banner.
- [ ] `store/listing.md` has name ≤75 chars, short description ≤132 chars, long description ≤16,000 chars, four permission justifications ≤1000 chars each, all leading with the fallback wedge.
- [ ] `store/privacy-answers.yaml` answers every Chrome questionnaire field and grep confirms zero `fetch(`, `XMLHttpRequest`, `sendBeacon`, or analytics SDK references in shipped source.
- [ ] `store/pre-submit-qa.md` exists with checklist boxes for all five sites + theme + a11y + onboarding + performance.
- [ ] `store/submission-walkthrough.md` exists with verbatim dashboard tab-by-tab steps and current 2026 URLs.
- [ ] `store/post-submit-monitoring.md` exists with daily / weekly cadence and a crash-triage protocol.
- [ ] Task 8 QA checklist walked clean on a fresh Chrome profile against the unpacked zip.
- [ ] Extension uploaded to https://chrome.google.com/webstore/devconsole/ and submitted for review.
- [ ] `git tag v1.0.0` is pushed.

---

## Notes for the implementer

- **Do not invent screenshots.** The five fixtures import the real `sidepanel/panel.html` and overlay code; if the screenshot looks bad, the *product* looks bad. Fix the product first, screenshot second. If `panel.js` doesn't yet support the `?fixture=` query param described in Task 5, add that handler in a 10-line block before rendering — it's a thin debug-only switch that reads URL search params and seeds a fixed dataset before the live detector runs. Keep that handler behind a guard like `if (new URLSearchParams(location.search).has('fixture'))` so production never hits it.

- **The audit is a gate, not a suggestion.** When audit fails, fix the source, not the audit. Every loosened regex is a leak waiting to happen. The only time it's correct to edit the audit is when a new ALLOWED_URL_HOSTS entry is legitimately needed (e.g., spec adds a new font source classifier in a future phase).

- **Permission justifications are read by humans.** The Chrome reviewer assigned to your listing reads your justifications and looks for honesty. Generic copy ("we need this to function") gets rejected. The Task 7 justifications are specific because specific passes review faster.

- **The amber dot is the marketing asset.** Screenshot 1 is the screenshot in the search results. If the amber dot isn't visible at thumbnail size, redo the fixture with a bigger chip and a more obvious dot. Reviewers and users decide whether to install in the first two seconds; the dot has to do the work in that time.

- **Don't gold-plate the icon.** A single-letter mark with the wedge dot is enough. Stripe's icon is an `S`. Linear's is an `L`. FontLens's is an `f` with a wedge dot. Do not add gradients, sub-pixel anti-aliasing tricks, or "personality" — at 16px it all collapses to a blob.

- **The "notify me" email path is the most-scrutinized feature on the privacy questionnaire.** If it's still in Launch 1 (per spec §8.3), confirm two-click consent in the source before submitting. The first version of the questionnaire was rejected for many extensions in 2025 because devs declared "no data collected" while their UI quietly POSTed an email on every page visit. FontLens's design is honest — confirm the code matches.

- **Do not submit on a Friday.** Reviews that land on weekends sit. Submit Monday morning Pacific time so the review window starts in business hours.

- **Keep the zip reproducible.** `npm run build` should produce a byte-identical zip on every run for the same source tree. The current Task 2 implementation uses `archiver` which by default embeds modification timestamps — that's fine for store submission but breaks bit-for-bit reproducibility. If a future audit wants byte-identical builds, switch to `archiver`'s `forceLocalTime: false` and zero out file mtimes. Not required for Launch 1.

- **Phase 6 produces no new shipped JavaScript.** Every file inside the zip was written in Phases 1–5. If you find yourself editing `content/*` or `sidepanel/*` during Phase 6, stop — you're fixing a Phase 5 acceptance-criteria miss. Land the fix back in the Phase 5 stream, then return here. Phase 6 is packaging, not coding.
