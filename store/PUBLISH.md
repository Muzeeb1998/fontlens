# FontLens — Chrome Web Store Publishing Guide

Everything needed to submit FontLens to the Chrome Web Store, in order. All
copy and assets referenced here live in this `store/` directory.

---

## 0. One-time developer setup

- Register a Chrome Web Store developer account: <https://chrome.google.com/webstore/devconsole>
  (one-time US$5 fee).
- Have a Google account with 2FA enabled.

---

## 1. Build the upload package

```bash
npm run build          # renders icons + writes dist/fontlens-1.0.0.zip
npm run audit:bundle   # MUST print: bundle audit passed — zero issues
```

Upload artifact: **`dist/fontlens-1.0.0.zip`** (~70 KB). This is the only file
you upload as the extension package. `dist/` is gitignored — it is a build
output, regenerate it any time.

The audit gate enforces the privacy claims: no `eval`, no remote `<script>`, no
HTTP imports, no `host_permissions`. If it fails, do not submit.

---

## 2. Generate / refresh store assets

```bash
npm run build:store    # writes store/screenshots/*.png + store/promo/*.png
```

Produces, from the real extension UI (deterministic, no manual capture):

**Screenshots** (`store/screenshots/`, 1280×800, upload 1→4 in order):

| File | Shows |
|------|-------|
| `1-pin-multiple.png` | Multi-card pinning on an article — the headline interaction |
| `2-type-system.png` | Side panel, full page type system, fallback-first (light) |
| `3-fallback-signal.png` | The wedge: amber fallback signal + banner (dark) |
| `4-hover-detail.png` | Hover chip + expanded detail card with live specimen |

**Promo tiles** (`store/promo/`):

| File | Size | Field |
|------|------|-------|
| `small-tile-440x280.png` | 440×280 | Small promo tile (recommended) |
| `marquee-1400x560.png` | 1400×560 | Marquee (optional, for featuring) |

**Icon:** `assets/icons/128.png` (already in the package; the store reads it).

---

## 3. Store listing fields

Source of truth: [`listing.md`](listing.md). Paste each field verbatim into the
Dev Console → **Store listing** tab.

- **Name:** FontLens — Font Inspector & Fallback Detector
- **Summary (≤132):** see `listing.md` → Short description
- **Description:** see `listing.md` → Long description
- **Category:** Developer Tools
- **Language:** English (United States)
- **Support URL:** https://github.com/Muzeeb1998/fontlens/issues
- **Privacy policy URL:** host [`privacy-policy.md`](privacy-policy.md) (see §5) and paste the URL

---

## 4. Privacy practices tab

Source of truth: [`privacy-answers.yaml`](privacy-answers.yaml). Transfer each
value into the Dev Console → **Privacy practices** tab:

- Single purpose statement
- Permission justifications (activeTab / scripting / sidePanel / storage)
- "Does this item use remote code?" → **No** (with justification)
- Data collection / usage checkboxes → **all No**
- Data-sale certification → **I do not sell user data**
- The three required certification checkboxes

---

## 5. Host the privacy policy

The store requires a public **Privacy policy URL**. Easiest path with this repo:

1. Enable GitHub Pages on the repo (Settings → Pages → deploy from `main`).
2. The policy is served at:
   `https://muzeeb1998.github.io/fontlens/store/privacy-policy.md`
   (or render it to HTML / paste into a Gist and use that raw URL).
3. Paste that URL into the listing's Privacy policy field.

Any always-public URL works (Gist, Notion public page, personal site). It just
has to load without auth.

---

## 6. Pre-submit QA

Run the manual gate before every submission: [`pre-submit-qa.md`](pre-submit-qa.md).
Plus the automated suites must be green:

```bash
npm test               # 230 vitest
npm run test:e2e       # 19 Playwright
```

The full functional + design test matrix is in
[`../docs/qa/test-cases.md`](../docs/qa/test-cases.md); its "Manual-only cases"
section is the short list to eyeball in real Chrome (install flow, real-site
hover feel, file download, OS reduce-motion, screen reader).

---

## 7. Submit

Walkthrough with screenshots of the console flow:
[`submission-walkthrough.md`](submission-walkthrough.md).

1. Dev Console → **New item** → upload `dist/fontlens-1.0.0.zip`.
2. Fill Store listing (§3), upload screenshots + promo tiles (§2).
3. Fill Privacy practices (§4), set Privacy policy URL (§5).
4. Set visibility (Public / Unlisted) and distribution (All regions).
5. **Submit for review.** First review typically 1–3 business days.

---

## 8. After submit

Monitoring + response playbook: [`post-submit-monitoring.md`](post-submit-monitoring.md).

- Version bumps: change `version` in `manifest.json`, re-run §1, re-upload.
- The `version` in `manifest.json` must increase on every update.

---

## File map

```
store/
├── PUBLISH.md                 ← you are here (master index)
├── listing.md                 ← all store-listing copy
├── privacy-answers.yaml       ← privacy-practices questionnaire answers
├── privacy-policy.md          ← hostable privacy policy (§5)
├── pre-submit-qa.md           ← manual QA gate
├── submission-walkthrough.md  ← console submission steps
├── post-submit-monitoring.md  ← after-review playbook
├── screenshots/               ← 1280×800 PNGs (npm run build:store)
└── promo/                     ← 440×280 + 1400×560 PNGs (npm run build:store)
```
