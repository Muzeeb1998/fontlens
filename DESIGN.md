# FontLens — Design System

**Status:** v1.0 (Launch 1)
**Last updated:** 2026-05-31
**Source of truth for all visual and interaction decisions.** Reference this doc when adding any new feature so the product stays coherent.

Related:
- Product spec: [`docs/specs/launch1-design.md`](docs/specs/launch1-design.md)
- Mockup archive: [`docs/mockups/`](docs/mockups/)

---

## 1. Brand

**Name:** FontLens
**One-line promise:** See the font the page asked for *and* the font the visitor is actually rendering — then copy it as CSS, Tailwind, or a design token.

**Voice**
- Honest over clever. We say "couldn't confirm rendering" instead of inventing an answer.
- Concise. Designers and developers both read fast; respect their time.
- Confident on the wedge (fallback detection), humble on edges (cross-origin iframes, closed shadow roots).
- No emoji in product UI. Symbols where meaning is clear (e.g., `⚠`, `◐` for theme).

**Tone in copy**
- Buttons: imperative verbs ("Copy CSS", "Inspect element"). Never "Click here".
- Empty / error states: tell the user what happened and what to do next in one short sentence.
- Onboarding line that ships: *"You've seen the fallback signal — that's the part nobody else shows you."*

---

## 2. Visual Personality

**Minimal Mono.** Mostly grayscale, generous whitespace, one accent for navigation/CTA, one *reserved* accent for the differentiator.

Principles:
- Let typography do the work. The product is about type — the UI must read as restrained, not noisy.
- One amber accent (`--amber-500`) is **reserved exclusively** for the fallback signal. It only ever means "the requested font isn't loading." Never reuse it for hover, warnings, info, or anything else.
- System fonts for the UI itself so it feels native to Chrome and loads instantly.

---

## 3. Color Tokens

All tokens declared as CSS custom properties on `:root` in `sidepanel/panel.css` and the overlay shadow root. Names are stable across light/dark — only values flip.

### 3.1 Light (default)

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg`              | `#ffffff` | Side panel + chip background |
| `--bg-muted`        | `#fafafa` | Row hover, banner backdrop |
| `--bg-subtle`       | `#f4f4f5` | Buttons, badges, count pills, mode-toggle track |
| `--border`          | `#ececec` | Card and row dividers |
| `--border-strong`   | `#d4d4d8` | Hovered card border, focus rings |
| `--fg`              | `#0f0f10` | Primary text |
| `--fg-muted`        | `#6b6b6e` | Secondary text, metrics, captions |
| `--fg-faint`        | `#9c9ca0` | Tertiary / placeholder text |
| `--accent`          | `#0f0f10` | Primary CTA, focused tab (mono — accent *is* the foreground) |
| `--link`            | `#1e6fd8` | The single restrained blue, for links only |
| `--amber-500`       | `#f59e0b` | **Reserved: fallback signal only** |
| `--amber-bg`        | `#fff8eb` | Fallback banner/card background |
| `--amber-border`    | `#f7e3b9` | Fallback card border |
| `--amber-fg`        | `#7a4a1d` | Fallback text |

### 3.2 Dark

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg`              | `#0e0e10` | Side panel + chip background |
| `--bg-muted`        | `#161618` | Row hover, banner backdrop |
| `--bg-subtle`       | `#1f1f22` | Buttons, badges, count pills |
| `--border`          | `#26262a` | Card and row dividers |
| `--border-strong`   | `#3a3a3f` | Hovered card border, focus rings |
| `--fg`              | `#f5f5f7` | Primary text |
| `--fg-muted`        | `#a1a1a6` | Secondary text |
| `--fg-faint`        | `#6b6b6e` | Tertiary / placeholder text |
| `--accent`          | `#f5f5f7` | Primary CTA |
| `--link`            | `#5fa8ff` | Link text |
| `--amber-500`       | `#f5b840` | Fallback signal (slightly lighter for dark contrast) |
| `--amber-bg`        | `#2a1e08` | Fallback banner background |
| `--amber-border`    | `#574014` | Fallback card border |
| `--amber-fg`        | `#f5d089` | Fallback text |

Theme is a single sun/moon icon toggle in the panel header that flips light ↔ dark, persisted in `chrome.storage.local` under key `theme`. Light is the default. (The earlier three-state Auto/Light/Dark control was collapsed to one icon for a cleaner header; OS-follow "Auto" was dropped.)

### 3.3 Forbidden combinations

- Amber on anything that isn't a fallback indication.
- Link blue on anything that isn't a link.
- Pure black (`#000`) or pure white in dark mode — always use the token values for layer separation.

---

## 4. Typography

### 4.1 UI font

```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
```

System UI for *everything except* specimens. This keeps the bundle small and the surface feeling native to Chrome.

### 4.2 Specimen font (the type sample line)

Specimens are rendered in the **actual detected face** from the page. That is the whole point — never substitute. If the face can't be loaded into the side panel's iframe, fall back to a generic that matches the detected category (serif / sans / mono) and tag the row "specimen approximate."

### 4.3 Mono font (for metrics, code, copy snippets)

```css
font-family: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;
```

### 4.4 Type scale (UI)

| Token | Size / line | Usage |
|-------|-------------|-------|
| `--t-xs`    | 10px / 14px | Badges, button labels, count chips |
| `--t-sm`    | 11px / 16px | Secondary text, metrics, banner |
| `--t-base`  | 12px / 18px | Default body inside cards |
| `--t-md`    | 13px / 18px | Wordmark, card heading, mode toggle |
| `--t-lg`    | 14px / 20px | Section heading |
| `--t-xl`    | 16px / 22px | Specimen line in rows |
| `--t-xxl`   | 22-28px     | Headline specimens (variable, follows detected size where reasonable) |

Tabular numerals enabled (`font-variant-numeric: tabular-nums`) on all metric strings so counts and px values align cleanly.

---

## 5. Spacing

4-point grid. All paddings, gaps, and margins use these tokens — no one-off values.

| Token | Value | Usage |
|-------|-------|-------|
| `--s-1` | 4px  | Tight gaps inside chips, between icon and label |
| `--s-2` | 6px  | Inner padding for buttons and badges |
| `--s-3` | 8px  | Default gap between adjacent inline items |
| `--s-4` | 10px | Row padding vertical |
| `--s-5` | 12px | Card inner padding, header height padding |
| `--s-6` | 14px | Side-panel head/banner horizontal padding |
| `--s-7` | 18px | Between major sections |
| `--s-8` | 24px | Top of body, generous breathing room |

Border radius: `4` (buttons/badges), `6` (rows/inputs), `8` (cards), `10` (chip). No fully-rounded except the count pill (`999px`).

---

## 6. Components

### 6.1 Hover Chip (signature interaction)

**Where:** Floating in a `<dialog>` or fixed `<div>` inside a Shadow DOM attached to the host page.

**Behavior:** Follows cursor with `~80ms` ease-out transform. Click to pin at last hover position. Esc unpins.

**Content (max two lines + optional fallback row):**
```
Söhne                ← rendered face, font-weight: 600
16px · 400 · 24/16   ← metrics, mono, fg-muted
[amber dot] fallback ← only when isFallback
requested: Söhne     ← only when isFallback, fg-muted
```

**Tokens:** `--bg`, `--fg`, `--fg-muted`, `--border`, radius `10`, padding `var(--s-4) var(--s-5)`, shadow `0 8px 24px rgba(0,0,0,0.18)`.

### 6.2 Side Panel Header

Wordmark (left, weight 600, size `--t-md`), mode toggle (center, segmented control over `--bg-subtle`), and a right-aligned action cluster: Download-tokens icon button + single sun/moon theme icon button (both 28×28, `.fl-icon-btn`). Bottom border `1px solid var(--border)`. Download is disabled until a payload exists.

### 6.3 Fallback Banner

Full-width strip below the header, only when any fallback is detected. `--amber-bg`, `--amber-fg`, top/bottom border `--amber-border`, amber dot prefix. Single line. Padding `var(--s-3) var(--s-6)`.

### 6.4 Family Card

Outer wrapper for one detected font family. `--border`, radius `8`, margin `var(--s-3) 0`. Contains a `.fam-head` row (name, badge, meta) and N `.row` children (one per style).

**Fallback family cards** flip border and background to amber tokens and prefix the header with the amber dot.

### 6.5 Style Row

Grid: `60px 1fr auto`. Cells: role label, specimen + metrics + (hover) copy buttons, usage count chip.

| Sub-element | Spec |
|-------------|------|
| Role label | `--t-xs`, uppercase, `letter-spacing: .06em`, color `--fg-muted`, font-weight 600 |
| Specimen   | In the *detected face*, weight matches detected, line-height tight (1.15), truncate with ellipsis |
| Metrics    | Mono, `--t-sm`, `--fg-muted`, tabular nums |
| Count chip | `--bg-subtle`, radius 999, `--t-xs`, padding `2px 6px` |
| Copy buttons | Hidden until row hover; mono, `--t-xs`, `--bg-subtle` background, 1px border `--border` |

### 6.6 Badge

Small uppercase pill on family-card heads. Possible values: `Self-hosted`, `Google`, `Adobe`, `System`, `Fallback`, `Variable`. Always `--bg-subtle` + `--fg-muted` except `Fallback` which uses amber tokens.

### 6.7 Toast

Bottom-right of side panel. Fades in 120ms, dwells 1.8s, fades out 200ms. Single line: "Copied as CSS" (format reflects the button clicked). `--bg`, `1px solid --border`, radius `8`, shadow `0 4px 14px rgba(0,0,0,0.12)`.

### 6.8 Mode Toggle

Two-segment control. Track `--bg-subtle`, active segment `--bg` with `0 1px 2px rgba(0,0,0,0.06)`. `--t-sm`. Keyboard: arrow keys to move focus, Space to toggle.

### 6.9 Variable-Font Axis Slider

Appears inside the family card when the face is variable.
- Label: axis tag (e.g., `wght`) + min/max
- Range input styled to the token palette, value tooltip shows current numeric
- Below row: "Reset" link in `--link` color
- Debounce slider input at 30ms to avoid layout thrash on the page

---

## 7. Iconography

Minimum set ships in `assets/icons/`:
- 16/32/48/128 PNG for Chrome (manifest requirement)
- An inline SVG sprite for in-UI icons: theme (`◐`), close (`×`), pin, eye, code, check (for copy)

Inline SVGs use `currentColor` and inherit `--fg-muted` by default.

---

## 8. Motion

Restrained and fast. No bouncy easing.

| Use | Duration | Easing |
|-----|----------|--------|
| Hover chip follow | 80ms | `ease-out` (cubic-bezier(0.2, 0, 0, 1)) |
| Button / row hover background | 120ms | `ease-out` |
| Toast fade in | 120ms | `ease-out` |
| Toast fade out | 200ms | `ease-in` |
| Card expand (if added later) | 180ms | `ease-out` |
| Slider value update | none (immediate) | — |

Disable all non-essential motion if `prefers-reduced-motion: reduce` is set.

---

## 9. Interaction Principles

1. **Glance first, depth on demand.** Hover chip is glance. Side panel is depth.
2. **One click to the result.** Copy buttons live one hover away — never behind a menu.
3. **Honest failures.** If detection is uncertain, label it. Never assert wrong.
4. **Click anywhere is safe.** Clicking a host-page element never triggers navigation while inspect mode is on (we `preventDefault` and `stopPropagation`).
5. **Keyboard parity.** Every mouse action has a keyboard equivalent. Esc always exits.
6. **Persistent state belongs in `chrome.storage`.** Service worker is ephemeral; never trust in-memory.

---

## 10. Accessibility

- Color contrast ≥ 4.5:1 for all text against its background, both themes. Verified per token in `docs/specs/launch1-design.md` review.
- Every interactive element has an ARIA label and a visible focus ring (`2px solid var(--border-strong)`, offset `2px`).
- Mode toggle, theme toggle, and copy buttons are real `<button>` elements with `aria-pressed` where applicable.
- Side panel main region marked `role="region"` with `aria-label="Detected fonts"`.
- Specimen lines have `aria-label` describing the metrics in plain language ("Söhne body, 16 pixels, weight 400").
- Reduced motion respected (see §8).

---

## 11. File Conventions

When implementing or extending the extension:

```
fontlens/
├── DESIGN.md                  ← this file
├── README.md
├── LICENSE
├── manifest.json
├── service-worker.js
├── content/                   ← only surface with DOM access
├── sidepanel/                 ← Side Panel API root
├── options/
├── lib/                       ← pure functions, no DOM
│   ├── export.js
│   ├── roles.js
│   └── tokens.css             ← canonical token declarations
├── onboarding/
│   └── demo.html
├── assets/
│   └── icons/
└── docs/
    ├── specs/                 ← versioned product specs per launch
    └── mockups/               ← brainstorm archives
```

CSS organization: every CSS file imports `lib/tokens.css` first, then declares only component-scoped rules. No raw hex colors anywhere outside `lib/tokens.css`.

---

## 12. Adding a New Feature

Before writing code:

1. Read this document end to end.
2. Identify whether the feature touches: chip / panel / options / onboarding / engine. Co-locate code accordingly (§11).
3. Choose tokens for any new visual element from §3, §4, §5. **Do not introduce new color values without updating §3.**
4. If the feature has UI copy, write it to match §1 voice.
5. If interactive, ensure §9 and §10 are satisfied.
6. Add the new component pattern to §6 with the same level of detail as existing entries.
7. Bump the "Last updated" date at the top.

---

## 13. Changelog

- **2026-05-31 — v1.0** Initial design system established from Launch 1 brainstorm. Minimal Mono visual personality, hybrid family-grouped side panel, R4 role inference, amber-reserved fallback signal.
