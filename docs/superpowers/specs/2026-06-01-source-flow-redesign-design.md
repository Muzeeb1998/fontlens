# "Get this font" — flow redesign (Mix X)

**Date:** 2026-06-01
**Status:** Approved direction — implementation pending
**Replaces:** `.fl-source` block introduced 2026-06-01 (commit `7c52f16`)

## Problem

The current per-card "Get this font" block adds visual weight to every family
card: separate background, separate title row, separate link row, 1–3 copy
buttons, and a footer license note. Result is a tall, busy card. The badge
already shown in the card head duplicates the source information. Three
Google copy buttons (Link / Import / CSS) require label-decoding for casual
users.

## Solution — Mix X

Collapse all source affordances into two existing surfaces:

1. **Card head: badge becomes the source link.** The existing "Google Fonts",
   "Self-hosted", "System", or paid-foundry badge already in `.fl-card-head`
   becomes a real `<a target="_blank">` link to the resource page (Google
   specimen / foundry product page / site origin). No new block, no extra
   row. License/foundry detail stays as a `title` tooltip.

2. **Style row gains an `Embed` copy button next to CSS / Tailwind / Token.**
   Clicking it opens an inline drawer just below the row containing the
   relevant snippet (the `<link>`/`@import` pair for Google, `@font-face`
   for self-hosted, system-ui stack for system). Paid faces get a license
   reminder + foundry link only — no snippets, no friction toward piracy.

The standalone `.fl-source` section, the `.fl-source-btns`, and the source
note paragraphs are removed.

## UX details

### Card head — clickable badge

```
Söhne                   [KLIM TYPE FOUNDRY ↗]    woff2 · 38 nodes
```

- Badge styling unchanged for self-hosted / system / fallback cases (where
  there is no link). For Google + paid + selfhosted-with-origin it becomes
  an underlined-on-hover anchor.
- `aria-label="Open <foundry> page for <family> in a new tab"`.
- Tooltip (`title`) carries the license string (`OFL / Apache`,
  `Commercial — license required`).

### Row hover — Embed button

```
BODY   Almost before we knew it    16/400/24    142×
       [CSS] [Tailwind] [Token] [Embed]   ← reveals on row hover
```

- Embed only renders when the resolver produced a snippet kind worth
  emitting (Google, self-hosted, system). Paid: button hidden because the
  drawer would only repeat the foundry link.
- Clicking Embed toggles an inline drawer directly below the row.

### Inline drawer

```
┌─────────────────────────────────────────────────┐
│ <link href="...">                       [Copy]  │
│ @import url('...');                     [Copy]  │
│                                                 │
│ Add the <link> in <head>. CSS already on the    │
│ font-family line above.                         │
└─────────────────────────────────────────────────┘
```

- One row per snippet. Right-aligned `[Copy]` per snippet (reuses the
  existing `data-copy="snippet"` dispatcher).
- For self-hosted: single snippet — the `@font-face` block.
- For system: single snippet — `font-family: -apple-system, …`.
- Closing the drawer: another click on Embed, or Esc when the drawer is
  focused.

## Removed

- `.fl-source`, `.fl-source-head`, `.fl-source-title`, `.fl-source-badge`,
  `.fl-source-link`, `.fl-source-btns`, `.fl-source-note`,
  `.fl-source-paid` CSS rules.
- `buildGetThisFontBlock(group, data)` in `sidepanel/render.js`.
- The `.fl-card.is-fallback` carve-out in `renderGroups` (no longer needs
  to skip the block).

## Added

- `buildCardHead(group, data)` — extended to accept `data` and, when
  resolveable, wrap the source badge in an `<a>` with the resource URL.
- `buildEmbedDrawer(row, resolved, snip)` — new helper inside render.js.
  Returns a `<div class="fl-embed-drawer" hidden>` with one or more
  snippet rows. Inserted after the row element in `renderGroups`.
- `buildRow(row, globalIndex, data)` — extended to (a) attach
  `data-embed-key` referencing the drawer, (b) include the Embed button
  next to CSS/Tailwind/Token when resolved-kind is one of
  `google`/`selfhosted`/`system`.
- `panel.js` click handler — toggles `[hidden]` on
  `.fl-embed-drawer[data-key=<row-key>]` when the Embed button on a row
  is clicked. Esc on the drawer closes it.

## Out of scope

- The free-font alternatives matcher (Part 2 of the source plan, still
  shipping post-launch).
- Multi-snippet packs (e.g., Tailwind preset). Single-snippet rows for
  Launch 1.
- Animated transition on drawer open. CSS `transition: max-height` is a
  Launch-2 polish item.

## Testing

Vitest covers:

- `render.js` — clickable badge: Inter card head includes an `<a>` whose
  href is the Google specimen URL; paid card head links to the foundry.
- `render.js` — Embed button: appears for google/selfhosted/system rows,
  absent on paid + unknown rows.
- `render.js` — drawer toggles `[hidden]` when Embed is clicked (use the
  callback path or click dispatch).
- `render.js` — drawer contains the right snippet text for each kind.

Playwright (`test/e2e/static-pages.spec.js`) covers the new badge link
href and the Embed click via the existing fixture payload.

Existing tests removed:

- `'Get this font block' › renders Google Fonts source block with link +
  copy buttons for an Inter family'` and siblings — replaced with new
  badge + drawer tests above.

## Acceptance

- Family cards visibly shorter (1 fewer block on most pages, ~60–80 px
  saved per family).
- One tap on the badge opens the source page.
- Embed snippet drawer opens / closes without page reflow jank.
- Vitest + Playwright suites green.
- No raw hex outside `lib/tokens.css`.
- No new dependencies.
