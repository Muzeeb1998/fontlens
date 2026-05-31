# Pre-submit QA — FontLens 1.0.0

Run before uploading the zip. Sign off at the bottom with date + initials.

## 0. Bundle sanity

- [ ] `npm test` — all suites green.
- [ ] `npm run build:zip` — produces `dist/fontlens-1.0.0.zip`.
- [ ] `npm run audit:bundle` — exits 0 with "bundle audit passed".
- [ ] `unzip -l dist/fontlens-1.0.0.zip` — list contains only:
  `manifest.json`, `service-worker.js`, `content/*`, `sidepanel/*`,
  `options/*`, `lib/*`, `onboarding/*`, `assets/icons/{16,32,48,128}.png`.
  No tests, no docs, no `.git`, no `node_modules`.

## 1. Load unpacked

- [ ] `chrome://extensions` → Developer mode → Load unpacked → repo root.
- [ ] Zero errors in the extensions card "Errors" panel.
- [ ] Toolbar icon visible. Tooltip reads "Inspect fonts".
- [ ] First-install opens `onboarding/demo.html` in a new tab AND the side
  panel auto-opens in Hover mode.

## 2. Five-site smoke test

For each site, perform: open page → click toolbar → hover h1 → click h1 →
verify side panel renders → hover row → copy CSS → paste and inspect.

| Site | Expected |
|------|----------|
| `https://stripe.com` | Sohne family card, self-hosted badge, hover highlight works |
| `https://github.com` | No fallback rows; system font detected as system |
| `https://www.notion.so` | Open shadow roots inspected; rows visible from shadow trees |
| `https://en.wikipedia.org/wiki/Typography` | System stack labeled by OS (e.g. "San Francisco") |
| `https://news.ycombinator.com` | Generic serif/sans-serif handled cleanly |

For each: no console errors from FontLens, no host page navigation in
Inspect mode, panel updates on tab switch.

## 3. Theme

- [ ] Auto theme respects OS setting.
- [ ] Manual Light / Dark override persists across panel close/reopen.
- [ ] No raw hex visible (every visual element uses tokens).

## 4. Keyboard

- [ ] `Alt+Shift+F` toggles inspect mode.
- [ ] Esc unpins / exits inspect.
- [ ] ArrowUp/Down move row focus in the side panel.
- [ ] Home/End jump to first/last row.
- [ ] Enter on focused row copies in `defaultFormat`.

## 5. Accessibility

- [ ] Tab through every interactive control — visible focus rings on each.
- [ ] DevTools Accessibility tree shows: `region "Detected fonts"`, mode
  toggle group, theme toggle group, rows announced as `button`.

## 6. Reduced motion

- [ ] Enable system Reduce Motion → side-panel row hover and chip transitions
  are instant, no animation.

## 7. Edge cases (Phase 5)

- [ ] Cross-origin iframe on the page → placeholder card appears.
- [ ] Open shadow root content (e.g. notion.so) → rows from shadow trees
  appear in panel.
- [ ] >5000 text nodes (e.g. a long Wikipedia page) → "Showing styles from
  the first 5000 text nodes." footnote appears.

## 8. Onboarding

- [ ] Remove the extension; reinstall via "Load unpacked".
- [ ] Demo tab opens automatically.
- [ ] Hover the fake-font headline → confirmation line appears.
- [ ] "Try it on your favorite site" closes the tab.
- [ ] Reload Chrome — demo does NOT re-open.

## 9. Privacy / network audit

- [ ] DevTools → Network tab → reload an inspected page with FontLens
  enabled. Zero requests originate from the extension's content script or
  side panel. (Google Fonts requests on the onboarding demo page are
  served TO the demo page itself, not from the extension to a backend.)
- [ ] No `chrome.runtime.sendMessage` payload contains a URL or a token.

---

Signed off: __________ on __________
