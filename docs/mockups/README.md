# Mockups

Snapshots from the design brainstorm that produced
[`docs/specs/launch1-design.md`](../specs/launch1-design.md).

These are HTML **fragments** authored for the Superpowers Visual Companion
server (they rely on its frame CSS — classes like `.cards`, `.options`,
`.mockup`, `.subtitle`). They will not render correctly when opened
directly in a browser.

To view them as the team did:

```bash
# from repo root
~/.claude/plugins/cache/claude-plugins-official/superpowers/*/skills/brainstorming/scripts/start-server.sh \
  --project-dir .
# then open the URL it prints and copy a mockup file into the served screen_dir
```

Or just read the HTML source — each file documents the intent in its
`<h2>` / `<h3>` / `<p>` tags.

## Files

| File | Purpose | Status |
|------|---------|--------|
| `01-visual-personality.html` | Three personality directions (Minimal Mono / Designer Warm / DevTools Dark) | **Chosen: Minimal Mono (A)** |
| `02-sidepanel-hybrid.html` | Final side panel layout: family-grouped, usage-sorted rows, R4 role labels | **Approved direction** |

Final design decisions live in [`DESIGN.md`](../../DESIGN.md) at the repo root.
