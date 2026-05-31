# Chrome Web Store — submission walkthrough

Prerequisites:
- A registered Chrome Web Store developer account (one-time $5 fee at
  https://chrome.google.com/webstore/devconsole).
- `dist/fontlens-1.0.0.zip` produced by `npm run build:zip`.
- `npm run audit:bundle` exits 0.
- `store/pre-submit-qa.md` signed off.

---

## Step 1 — Create the item

1. Open https://chrome.google.com/webstore/devconsole.
2. Click "New item".
3. Drag `dist/fontlens-1.0.0.zip` onto the upload zone.
4. Wait for parse. If Chrome flags any manifest errors, fix in source,
   rebuild, re-upload — do not silently override.

## Step 2 — Store listing

Fill in from `store/listing.md`:

- Name
- Short description
- Long description
- Category: Developer Tools
- Language: English (United States)
- Support URL
- Icons: ensure all four PNGs auto-detected by Chrome.

Upload screenshots in order (1 → 5) from `store/screenshots/`.

## Step 3 — Privacy practices

Fill in from `store/privacy-answers.yaml`:

- Single purpose
- Permission justifications (one per permission)
- "Does your extension use remote code?" → No (with justification)
- Data collection / use sections → all No except the permission-scoped UI
  preferences (per the YAML notes)
- Three certifications at the bottom → check all three.

## Step 4 — Distribution

- Visibility: Public
- Regions: All regions (default)
- Pricing: Free

## Step 5 — Review and submit

1. Click "Submit for review".
2. Chrome will email when the review status changes. Typical review time
   is 1–3 business days for a simple, low-permission extension.
3. If rejected, the email will name the failing policy. Address in source,
   bump version to 1.0.1, rebuild, re-upload, re-submit.

## Step 6 — Post-submit

See `store/post-submit-monitoring.md`.
