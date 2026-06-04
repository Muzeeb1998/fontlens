---
type: adr
tags: [decision]
date: 2026-06-01
status: accepted
---
# ADR-0001 Mix X source flow

## Context

The per-card "Get this font" block was too heavy — separate header, link
row, three copy buttons, license note. ~60-80px of clutter per family card,
duplicating the badge already in the card head.

## Decision

Collapse to "Mix X": the card-head **badge becomes the source link**, and a
row-level **Embed** button opens an inline snippet drawer (link/import for
Google, @font-face for self-hosted, system stack for system). Paid faces
get the foundry link via the badge only — never a download path.

## Alternatives considered

- Compact action row in card head with a split copy-button (A).
- Dedicated bottom "Sources" section aggregating all links (B / Mix Y).

## Consequences

- Good: shorter cards, one tap to source, snippets contextual.
- Cost: Embed button hidden until row hover; snippet discovery needs a hover.

## Links

[[Decisions MOC]] · [[Design System]]
