---
type: competitor
tags: [competitor, research]
url: https://chrome.google.com/webstore/detail/whatfont/jabopobgcpjmedljpbcaablpmlmfcogm
installs: ~2M
rating: ~4.5
---
# WhatFont

The incumbent. ~2M users. The bar FontLens has to clear.

## What it does well

- Dead simple: click text, see family/size/weight/line-height/color.
- Fast, trusted, huge install base.
- Clean compact popover.

## Where it's weak

- Shows the **requested** font name, not what actually rendered. When a
  webfont fails and the page falls back, WhatFont still names the requested
  face — confidently wrong.
- System-stack fonts (`-apple-system`) often mislabeled.
- No export (CSS / Tailwind / token). No page-wide extraction.
- No source links / foundry resolution.

## Fallback handling (the wedge)

None. This is the entire opening. FontLens's amber fallback dot exists
because WhatFont can't tell you the page is degrading for visitors.

## What to steal / avoid

- Steal: the click-to-card simplicity, the compact popover feel.
- Avoid: confidently asserting a font that isn't actually rendering.

## Links

[[Competitors MOC]] · [[Spec]]
