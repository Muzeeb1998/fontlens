# Post-submit monitoring

Once FontLens 1.0.0 is live on the Web Store.

## Daily for the first week

- [ ] Check the developer dashboard for new reviews (https://chrome.google.com/webstore/devconsole/<item-id>).
- [ ] Read every 1- and 2-star review the same day it lands.
- [ ] Open a GitHub issue mirroring any bug report not already covered.

## Weekly thereafter

- [ ] Check install / uninstall counts and the retention curve.
- [ ] Skim 3- to 5-star reviews for repeated language about missing features.
  Anything mentioned by ≥3 users in a week becomes a Launch 2 candidate.

## Crash / breakage signal

The extension ships with no telemetry. Breakage signal is therefore reactive,
through reviews and GitHub issues. To make breakage cheap to report:

- The GitHub repo's issue template (TODO: create `.github/ISSUE_TEMPLATE/bug.md`)
  must ask: Chrome version, OS, the URL the extension was active on, and a
  minimal repro page if possible.
- The DevTools Console error log from the extensions card is the gold standard.
  Ask for it in the template.

## Update cadence

- Bug fixes ship within one business day of confirming the bug.
- Feature requests are batched into Launch 2 unless they fix an active 1-star
  review trend.

## Killswitch posture

There is intentionally no remote killswitch in the extension. If we need to
disable a feature, we ship a patched version. The only "killswitch" Chrome
gives us is unpublishing the listing, which we will only do for security
incidents — not for ordinary bugs.
