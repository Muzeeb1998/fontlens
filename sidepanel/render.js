// Pure DOM rendering helpers for the FontLens side panel.
// No chrome.* here — panel.js owns the messaging seam.

import { resolveFont } from '../lib/resolver.js';
import { snippetsFor } from '../lib/snippets.js';

const SPECIMEN_TEXT = 'Almost before we knew it';

const SOURCE_BADGE_LABEL = {
  google:        'Google',
  adobe:         'Adobe',
  'self-hosted': 'Self-hosted',
  system:        'System',
  unknown:       'Unknown',
};

// ---------------- Header ----------------

export function renderHeader(headerEl, { mode, theme }) {
  for (const btn of headerEl.querySelectorAll('button')) {
    if (!btn.id) continue;
    if (btn.id.endsWith('hover') || btn.id.endsWith('inspect')) {
      const want =
        (btn.id.endsWith('hover')   && mode === 'hover')  ||
        (btn.id.endsWith('inspect') && mode === 'inspect');
      btn.setAttribute('aria-pressed', want ? 'true' : 'false');
    } else if (btn.id.endsWith('auto') || btn.id.endsWith('light') || btn.id.endsWith('dark')) {
      const want =
        (btn.id.endsWith('auto')  && theme === 'auto')  ||
        (btn.id.endsWith('light') && theme === 'light') ||
        (btn.id.endsWith('dark')  && theme === 'dark');
      btn.setAttribute('aria-pressed', want ? 'true' : 'false');
    }
  }
}

// ---------------- Banner ----------------

export function renderBanner(bannerEl, textEl, { fallbackCount }) {
  if (!fallbackCount || fallbackCount < 1) {
    bannerEl.setAttribute('hidden', '');
    textEl.textContent = '';
    return;
  }
  bannerEl.removeAttribute('hidden');
  const noun = fallbackCount === 1 ? "font isn't" : "fonts aren't";
  const tail = fallbackCount === 1 ? 'a fallback' : 'fallbacks';
  textEl.textContent = `⚠ ${fallbackCount} of this page's ${noun} loading — visitors see ${tail}.`;
}

// ---------------- Summary ----------------

export function renderSummary(summaryEl, payload) {
  summaryEl.style.fontVariantNumeric = 'tabular-nums';
  const fonts = payload.groups.length;
  const styles = payload.groups.reduce((n, g) => n + g.rows.length, 0);
  const host = payload.hostname || 'this page';
  summaryEl.textContent = `${fonts} fonts · ${styles} type styles · ${host}`;
}

// ---------------- Empty / truncated ----------------

export function renderEmpty(regionEl) {
  regionEl.innerHTML = '';
  const p = document.createElement('p');
  p.className = 'fl-empty';
  p.textContent = 'Navigate to a page with text and try again.';
  regionEl.appendChild(p);
}

export function renderTruncated(regionEl, totalNodes) {
  const note = document.createElement('p');
  note.className = 'fl-truncated';
  note.textContent = `Showing styles from the first ${totalNodes} text nodes.`;
  regionEl.appendChild(note);
}

function renderPlaceholderCard(regionEl, n) {
  const card = document.createElement('section');
  card.className = 'fl-card fl-placeholder';
  card.setAttribute('role', 'note');
  card.setAttribute('aria-live', 'polite');
  const head = document.createElement('div');
  head.className = 'fl-card-head';
  const name = document.createElement('span');
  name.className = 'fl-card-name';
  name.textContent = `${n} frame${n === 1 ? '' : 's'} couldn't be inspected (cross-origin)`;
  head.appendChild(name);
  card.appendChild(head);
  regionEl.appendChild(card);
}

function renderFootnotes(regionEl, footnotes) {
  const lines = [];
  if (footnotes.truncated) {
    lines.push('Showing styles from the first 5000 text nodes.');
  }
  if (footnotes.closedShadows > 0) {
    const n = footnotes.closedShadows;
    lines.push(`${n} node${n === 1 ? '' : 's'} in closed shadow tree${n === 1 ? '' : 's'} were skipped.`);
  }
  if (!lines.length) return;
  const aside = document.createElement('aside');
  aside.className = 'fl-footnotes';
  for (const line of lines) {
    const p = document.createElement('p');
    p.textContent = line;
    aside.appendChild(p);
  }
  regionEl.appendChild(aside);
}

// ---------------- Cards + rows ----------------

function ariaLabelForRow(row) {
  const m = row.detail.metrics;
  const family = row.detail.rendered || 'unknown font';
  return `${family} ${row.role.toLowerCase()}, ${parseInt(m.size, 10)} pixels, weight ${m.weight}`;
}

function metricsLine(m) {
  const sz = m.size;
  const wt = m.weight;
  const lh = m.lineHeight;
  const lhOverSize = (lh && sz) ? `${parseInt(lh, 10) || lh}/${parseInt(sz, 10) || sz}` : '';
  return `${sz} · ${wt}${lhOverSize ? ' · ' + lhOverSize : ''}`;
}

function buildBadge(label, modifier) {
  const b = document.createElement('span');
  b.className = `fl-badge ${modifier || ''}`.trim();
  b.textContent = label;
  return b;
}

function buildCardHead(group, data) {
  const head = document.createElement('div');
  head.className = 'fl-card-head';

  const name = document.createElement('span');
  name.className = 'fl-card-name';
  name.textContent = group.isFallback && group.requestedFamily
    ? `${group.requestedFamily} → ${group.family}`
    : group.family;
  head.appendChild(name);

  // Source badge — becomes a real <a> when the resolver yields a webpage URL.
  if (group.isFallback) {
    head.appendChild(buildBadge('Fallback', 'is-fallback'));
  } else {
    const sourceBadge = buildSourceBadge(group, data);
    head.appendChild(sourceBadge);
  }
  if (group.isVariable) head.appendChild(buildBadge('Variable', 'is-variable'));

  const meta = document.createElement('span');
  meta.className = 'fl-card-meta';
  const fmt = group.source.format ? ` · ${group.source.format}` : '';
  const total = group.rows.reduce((n, r) => n + r.count, 0);
  meta.textContent = `${total} uses${fmt}`;
  head.appendChild(meta);

  return head;
}

function resolveForGroup(group, data) {
  const repr = group?.rows?.[0]?.detail;
  if (!repr) return null;
  try { return resolveFont(repr, data || {}); }
  catch { return null; }
}

function buildSourceBadge(group, data) {
  const resolved = resolveForGroup(group, data);
  const label = SOURCE_BADGE_LABEL[group.source.type] || 'Unknown';

  // Pick a webpage URL + tooltip per kind.
  let href = null, tipText = '';
  if (resolved?.kind === 'google') {
    href = resolved.specimenUrl;
    tipText = `Open ${resolved.name} on Google Fonts. License: ${resolved.license}.`;
  } else if (resolved?.kind === 'paid') {
    href = resolved.url;
    tipText = `${resolved.foundry} — commercial face, license required.`;
  } else if (resolved?.kind === 'selfhosted') {
    try {
      const u = new URL(resolved.url);
      href = u.origin;
      tipText = `First seen on ${u.host}.`;
    } catch {}
  } else if (resolved?.kind === 'system') {
    tipText = resolved.os ? `System UI on ${resolved.os}.` : 'System UI font.';
  }

  if (href && /^https?:\/\//.test(href)) {
    const a = document.createElement('a');
    a.className = 'fl-badge fl-badge-link';
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = `${label} ↗`;
    a.title = tipText;
    a.setAttribute('aria-label', `Open ${label} page for ${group.family} in a new tab`);
    return a;
  }

  const b = buildBadge(label);
  if (tipText) b.title = tipText;
  return b;
}

function buildRow(row, globalIndex, embedKind) {
  const el = document.createElement('div');
  el.className = 'fl-row';
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', globalIndex === 0 ? '0' : '-1');
  el.dataset.rowKey = row.key;
  el.dataset.rowIndex = String(globalIndex);
  // detail JSON — consumed by panel.js copy-button delegation (Phase 4)
  try { el.dataset.detail = JSON.stringify(row.detail); } catch {}

  const roleLabel = document.createElement('div');
  roleLabel.className = 'fl-row-role';
  roleLabel.textContent = row.role.toUpperCase();
  el.appendChild(roleLabel);

  // Low-confidence "?" badge (Phase 4 §7b)
  if (row.detail?.confidence === 'low') {
    const lowconf = document.createElement('span');
    lowconf.className = 'fl-lowconf';
    lowconf.setAttribute('role', 'img');
    lowconf.setAttribute('aria-label', "Detection couldn't be confirmed on this page (CSP).");
    lowconf.setAttribute('title', "Detection couldn't be confirmed on this page (CSP).");
    lowconf.setAttribute('tabindex', '0');
    lowconf.textContent = '?';
    roleLabel.appendChild(lowconf);
  }

  const middle = document.createElement('div');

  const specimen = document.createElement('div');
  specimen.className = 'fl-row-specimen';
  specimen.textContent = SPECIMEN_TEXT;
  specimen.style.fontFamily = `"${row.detail.rendered}", sans-serif`;
  specimen.style.fontWeight = String(row.detail.metrics.weight);
  specimen.setAttribute('aria-label', ariaLabelForRow(row));
  middle.appendChild(specimen);

  const metrics = document.createElement('div');
  metrics.className = 'fl-row-metrics';
  metrics.textContent = metricsLine(row.detail.metrics);
  metrics.setAttribute('aria-hidden', 'true');
  middle.appendChild(metrics);

  // Copy buttons (Phase 4 — revealed on row hover via CSS)
  const copy = document.createElement('div');
  copy.className = 'fl-copy';
  for (const [fmt, label] of [['css', 'CSS'], ['tailwind', 'Tailwind'], ['token', 'Token']]) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.copy = fmt;
    btn.setAttribute('aria-label', `Copy as ${label}`);
    btn.textContent = label;
    if (fmt === 'tailwind') {
      const approx = document.createElement('span');
      approx.className = 'fl-approx';
      approx.textContent = '≈';
      approx.hidden = true;
      btn.appendChild(approx);
    }
    copy.appendChild(btn);
  }
  // Embed button — only when the resolver kind produces snippet text.
  if (embedKind && ['google', 'selfhosted', 'system'].includes(embedKind)) {
    const embed = document.createElement('button');
    embed.type = 'button';
    embed.className = 'fl-embed-toggle';
    embed.dataset.embedToggle = row.key;
    embed.setAttribute('aria-expanded', 'false');
    embed.setAttribute('aria-controls', `fl-embed-${globalIndex}`);
    embed.setAttribute('aria-label', 'Toggle embed snippet');
    embed.textContent = 'Embed';
    copy.appendChild(embed);
  }
  middle.appendChild(copy);

  el.appendChild(middle);

  const count = document.createElement('div');
  count.className = 'fl-row-count';
  count.setAttribute('aria-label', `${row.count} matches`);
  count.textContent = String(row.count);
  el.appendChild(count);

  return el;
}

function buildAxesBlock(group) {
  // group.rows[0] carries the representative detail with axes
  const detail = group.rows[0]?.detail;
  const axes = detail?.axes;
  if (!axes || !Object.keys(axes).length) return null;

  const block = document.createElement('details');
  block.className = 'fl-axes';
  block.dataset.styleKey = group.rows[0].key;

  const summary = document.createElement('summary');
  const tags = Object.keys(axes).join(' · ');
  summary.textContent = `${Object.keys(axes).length} axes — ${tags}`;
  block.appendChild(summary);

  for (const [tag, range] of Object.entries(axes)) {
    if (range.min === range.max) continue;
    const row = document.createElement('div');
    row.className = 'fl-axis';
    row.dataset.tag = tag;

    const label = document.createElement('label');
    label.textContent = tag;
    const rangeSpan = document.createElement('span');
    rangeSpan.className = 'fl-range';
    rangeSpan.textContent = `${range.min}–${range.max}`;
    label.appendChild(rangeSpan);
    row.appendChild(label);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(range.min);
    input.max = String(range.max);
    input.step = '1';
    input.value = String(range.current);
    input.dataset.default = String(range.current);
    input.setAttribute('aria-label', `${tag} axis`);
    row.appendChild(input);

    const output = document.createElement('output');
    output.textContent = String(range.current);
    row.appendChild(output);

    block.appendChild(row);
  }

  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'fl-axis-reset';
  reset.textContent = 'Reset';
  block.appendChild(reset);

  return block;
}

function buildEmbedDrawer(row, resolved, globalIndex) {
  if (!resolved) return null;
  const snip = snippetsFor(resolved);
  if (!snip || !['google', 'selfhosted', 'system'].includes(snip.kind)) return null;

  const drawer = document.createElement('div');
  drawer.className = 'fl-embed-drawer';
  drawer.id = `fl-embed-${globalIndex}`;
  drawer.dataset.embedKey = row.key;
  drawer.hidden = true;

  const lines = [];
  if (snip.kind === 'google') {
    if (snip.preconnect) lines.push({ label: '<link> + preconnect', value: snip.preconnect });
    if (snip.importCss)  lines.push({ label: '@import',             value: snip.importCss });
  } else if (snip.kind === 'selfhosted') {
    if (snip.css) lines.push({ label: '@font-face', value: snip.css });
  } else if (snip.kind === 'system') {
    if (snip.css) lines.push({ label: 'System stack CSS', value: snip.css });
  }

  for (const { label, value } of lines) {
    const r = document.createElement('div');
    r.className = 'fl-embed-row';
    const lab = document.createElement('span');
    lab.className = 'fl-embed-label';
    lab.textContent = label;
    const pre = document.createElement('pre');
    pre.className = 'fl-embed-code';
    pre.textContent = value;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.copy = 'snippet';
    btn.dataset.snippet = value;
    btn.setAttribute('aria-label', `Copy ${label}`);
    btn.textContent = 'Copy';
    r.appendChild(lab);
    r.appendChild(pre);
    r.appendChild(btn);
    drawer.appendChild(r);
  }

  // Tiny instructional footer
  const hint = document.createElement('p');
  hint.className = 'fl-embed-hint';
  if (snip.kind === 'google') {
    hint.textContent = "Paste the <link> in <head>. Apply font-family via the row's CSS button.";
  } else if (snip.kind === 'selfhosted') {
    hint.textContent = 'Self-hosted face — host the file yourself; this @font-face references the original URL.';
  } else {
    hint.textContent = 'Native OS stack — no asset to load.';
  }
  drawer.appendChild(hint);

  return drawer;
}

export function renderGroups(regionEl, payload, callbacks = {}) {
  regionEl.innerHTML = '';

  const footnotes = payload.footnotes || {};
  const blockedFrames = footnotes.blockedFrames || 0;
  const data = callbacks?.data || {};

  if (!payload.groups.length && blockedFrames === 0) {
    renderEmpty(regionEl);
    return;
  }

  let globalIndex = 0;
  for (const group of payload.groups) {
    const card = document.createElement('section');
    card.className = 'fl-card' + (group.isFallback ? ' is-fallback' : '');
    card.setAttribute('role', 'group');
    card.setAttribute('aria-label', `${group.family} family`);

    card.appendChild(buildCardHead(group, data));

    // Resolve once per group; all rows share the same family/source.
    const resolved = group.isFallback ? null : resolveForGroup(group, data);
    const embedKind = resolved?.kind || null;

    for (const row of group.rows) {
      const idx = globalIndex++;
      const rowEl = buildRow(row, idx, embedKind);
      rowEl.addEventListener('mouseenter', () => callbacks.onHighlight?.(row));
      rowEl.addEventListener('mouseleave', () => callbacks.onUnhighlight?.(row));
      rowEl.addEventListener('focus',     () => callbacks.onHighlight?.(row));
      rowEl.addEventListener('blur',      () => callbacks.onUnhighlight?.(row));
      rowEl.addEventListener('click',     () => callbacks.onActivate?.(row));
      card.appendChild(rowEl);

      // Inline embed drawer for the row (hidden until the Embed button fires).
      const drawer = buildEmbedDrawer(row, resolved, idx);
      if (drawer) card.appendChild(drawer);
    }

    if (group.isVariable) {
      const axesBlock = buildAxesBlock(group);
      if (axesBlock) card.appendChild(axesBlock);
    }

    regionEl.appendChild(card);
  }

  if (blockedFrames > 0) renderPlaceholderCard(regionEl, blockedFrames);
  if (payload.truncated) renderTruncated(regionEl, payload.totalNodes);
  if (footnotes.truncated || footnotes.closedShadows) renderFootnotes(regionEl, footnotes);
}

// ---------------- Keyboard helpers ----------------

export function countRows(regionEl) {
  return regionEl.querySelectorAll('.fl-row').length;
}

export function focusRow(regionEl, index) {
  const rows = regionEl.querySelectorAll('.fl-row');
  if (!rows.length) return;
  const clamped = Math.max(0, Math.min(rows.length - 1, index));
  rows.forEach((r, i) => r.setAttribute('tabindex', i === clamped ? '0' : '-1'));
  rows[clamped].focus();
}
