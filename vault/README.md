# FontLens vault (Obsidian)

A note vault for design + research that doesn't belong in shipped source.

## Open it

Obsidian → **Open folder as vault** → select this `vault/` folder. Start at
[[HOME]] (the Map of Content).

Don't open the repo root as the vault — open `vault/` specifically, so
Obsidian doesn't index `node_modules`, source, or test output.

## Layout

```
vault/
├── HOME.md              Map of Content (start here)
├── Spec / Design System / Information Architecture / Plans
│                        pointer notes → link out to ../docs and ../DESIGN.md
├── *.MOC                hub notes per area (Research, Design, Decisions, Competitors)
├── research/            user + market notes
├── design/             visual explorations, mockups, attachments
├── decisions/          ADRs (ADR-0001 …)
├── competitors/        teardowns (WhatFont …)
├── templates/          note templates (Templates plugin points here)
└── .obsidian/          minimal config (templates folder, core plugins, link format)
```

## Workflow

- New note from template: command palette → "Templates: Insert template".
- Wikilink everything: `[[note name]]`. Backlinks + graph build themselves.
- Tags: `#research #design #decision #competitor`.
- Drop images into `design/attachments/`, embed with `![[name.png]]`.

This vault is committed to git so notes travel with the repo. It ships
nowhere — the bundle audit excludes everything outside the runtime globs.
