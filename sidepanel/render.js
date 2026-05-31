// Pure DOM rendering helpers for the FontLens side panel.
// No chrome.* here — panel.js owns the messaging seam.

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

function buildCardHead(group) {
  const head = document.createElement('div');
  head.className = 'fl-card-head';

  const name = document.createElement('span');
  name.className = 'fl-card-name';
  name.textContent = group.isFallback && group.requestedFamily
    ? `${group.requestedFamily} → ${group.family}`
    : group.family;
  head.appendChild(name);

  if (group.isFallback) {
    head.appendChild(buildBadge('Fallback', 'is-fallback'));
  } else {
    head.appendChild(buildBadge(SOURCE_BADGE_LABEL[group.source.type] || 'Unknown'));
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

function buildRow(row, globalIndex) {
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
  middle.appendChild(copy);

  el.appendChild(middle);

  const count = document.createElement('div');
  count.className = 'fl-row-count';
  count.setAttribute('aria-label', `${row.count} matches`);
  count.textContent = String(row.count);
  el.appendChild(count);

  return el;
}

export function renderGroups(regionEl, payload, callbacks = {}) {
  regionEl.innerHTML = '';

  if (!payload.groups.length) {
    renderEmpty(regionEl);
    return;
  }

  let globalIndex = 0;
  for (const group of payload.groups) {
    const card = document.createElement('section');
    card.className = 'fl-card' + (group.isFallback ? ' is-fallback' : '');
    card.setAttribute('role', 'group');
    card.setAttribute('aria-label', `${group.family} family`);

    card.appendChild(buildCardHead(group));

    for (const row of group.rows) {
      const rowEl = buildRow(row, globalIndex++);
      rowEl.addEventListener('mouseenter', () => callbacks.onHighlight?.(row));
      rowEl.addEventListener('mouseleave', () => callbacks.onUnhighlight?.(row));
      rowEl.addEventListener('focus',     () => callbacks.onHighlight?.(row));
      rowEl.addEventListener('blur',      () => callbacks.onUnhighlight?.(row));
      rowEl.addEventListener('click',     () => callbacks.onActivate?.(row));
      card.appendChild(rowEl);
    }

    regionEl.appendChild(card);
  }

  if (payload.truncated) renderTruncated(regionEl, payload.totalNodes);
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
