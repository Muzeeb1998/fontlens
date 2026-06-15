# FontLens — Privacy Policy

_Last updated: 2026-06-15 · Applies to FontLens v1.0.0 and later_

## Summary

FontLens does not collect, store, transmit, or sell any personal data. All
processing happens locally inside your browser. There are no servers, no
analytics, no trackers, and no network requests of any kind.

## What FontLens accesses

When you explicitly invoke FontLens (by clicking its toolbar icon, choosing it
from the side-panel menu, or pressing the keyboard shortcut), it reads the
**computed font styles** of the web page in the active tab — font family,
weight, size, line-height, letter-spacing, and color. This is the same
information any visitor's browser already uses to render the page.

This reading happens entirely in memory, on your device, only for the tab you
invoked it on, and only while you are using the extension.

## What FontLens stores

The only data FontLens persists is your **own UI preferences**:

- Theme preference (light / dark)
- Default copy format (CSS / Tailwind / design token)

These are saved with `chrome.storage.local` on your device and are never
transmitted anywhere. Uninstalling the extension removes them.

## What FontLens does NOT do

- ❌ No network requests (verified by an automated bundle audit on every build)
- ❌ No remote code loading (no `eval`, no remote `<script>`, no HTTP imports)
- ❌ No analytics, telemetry, or usage tracking
- ❌ No collection of browsing history, page content, or personal information
- ❌ No cookies, no fingerprinting, no advertising
- ❌ No selling or sharing of data with third parties

## Permissions, and why each is needed

| Permission | Why |
|------------|-----|
| `activeTab` | Read fonts from the tab you explicitly invoke FontLens on |
| `scripting` | Inject the inspector into that tab on your action (no remote code) |
| `sidePanel` | Show the extracted type system in Chrome's side panel |
| `storage` | Remember your theme + copy-format preference, locally |

FontLens requests **no `host_permissions`** and runs on **no page** until you
act.

## External links

FontLens can open a font's source page (e.g. Google Fonts, a foundry site, or
the website's own origin) in a new tab when you click a source badge. This is a
normal browser navigation that you initiate; FontLens sends no data with it.

## Children's privacy

FontLens collects no data from anyone, including children under 13.

## Changes

Any change to this policy will be published in this file in the public
repository and reflected by an updated "Last updated" date.

## Contact

Questions or concerns: open an issue at
<https://github.com/Muzeeb1998/fontlens/issues>.
