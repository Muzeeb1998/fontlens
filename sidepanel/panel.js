import {
  sendToContent, onContentMessage, loadTheme, saveTheme,
} from './messaging.js';
import {
  renderHeader, renderBanner, renderSummary, renderGroups,
  renderEmpty, focusRow,
} from './render.js';
import { toCSS, toTailwind, toTailwindStructured, toToken } from '../lib/export.js';
import { toTokenDoc, tokenFilename } from '../lib/tokens-export.js';

const state = {
  mode: 'hover',
  theme: 'light',
  payload: null,            // active payload shown in region (derived per mode)
  hoverPicks: [],           // hover mode: accumulated clicked-card groups
  hoverHost: '',            // hostname captured from the latest hover pick
  inspectPayload: null,     // inspect mode: full-page extract result
  highlightedKey: null,
  data: { google: {}, paid: {} },  // bundled font datasets, loaded once on init
};

// Dedupe key for a hover-picked group: family + the style key of its row.
function pickKey(group) {
  const rowKey = group?.rows?.[0]?.key || '';
  return `${group?.family || ''}|${rowKey}`;
}

async function loadJsonFromExt(relPath) {
  // Resolve from the extension origin (chrome-extension://<id>/...). The
  // bundled JSON ships under data/. fetch() is allowed because the panel
  // is same-origin to the extension.
  const baseUrl =
    typeof chrome !== 'undefined' && chrome.runtime?.getURL
      ? chrome.runtime.getURL(relPath)
      : `../${relPath}`;
  try {
    const res = await fetch(baseUrl);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

const headerEl   = document.querySelector('header.fl-header');
const bannerEl   = document.getElementById('fl-banner');
const bannerText = document.getElementById('fl-banner-text');
const summaryEl  = document.getElementById('fl-summary');
const regionEl   = document.getElementById('fl-region');
const toastEl    = document.getElementById('fl-toast');
const downloadEl = document.getElementById('fl-download');
const themeEl    = document.getElementById('fl-theme-toggle');

// ---------- Copy + Toast ----------
let defaultFormat = 'css';
let toastTimer = null;

function showToast(message) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.removeAttribute('hidden');
  toastEl.dataset.visible = 'true';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.dataset.visible = 'false';
    setTimeout(() => toastEl.setAttribute('hidden', ''), 200);
  }, 1800);
}

function serialize(detail, format) {
  switch (format) {
    case 'css':      return toCSS(detail);
    case 'tailwind': return toTailwind(detail);
    case 'token':    return JSON.stringify(toToken(detail), null, 2);
    default:         return toCSS(detail);
  }
}

async function copyDetail(detail, format) {
  const text = serialize(detail, format);
  try {
    await navigator.clipboard.writeText(text);
    const label = format === 'css' ? 'CSS' : format === 'tailwind' ? 'Tailwind' : 'Token';
    showToast(`Copied as ${label}`);
  } catch (err) {
    showToast('Copy failed — clipboard blocked');
    console.error('[FontLens] clipboard write failed', err);
  }
}

function annotateApproximateTailwind() {
  for (const row of regionEl.querySelectorAll('.fl-row[data-detail]')) {
    let detail;
    try { detail = JSON.parse(row.dataset.detail); } catch { continue; }
    const { approximate } = toTailwindStructured(detail);
    const flag = row.querySelector('[data-copy="tailwind"] .fl-approx');
    if (flag) flag.hidden = !approximate;
  }
}

// Embed toggle — show/hide the inline snippet drawer for a row.
regionEl.addEventListener('click', (e) => {
  const tog = e.target.closest('[data-embed-toggle]');
  if (!tog) return;
  e.stopPropagation();
  const key = tog.dataset.embedToggle;
  const drawer = regionEl.querySelector(`.fl-embed-drawer[data-embed-key="${CSS.escape(key)}"]`);
  if (!drawer) return;
  const open = drawer.hidden;
  drawer.hidden = !open;
  tog.setAttribute('aria-expanded', open ? 'true' : 'false');
});

// Esc inside the drawer closes it (a11y).
regionEl.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const drawer = e.target.closest?.('.fl-embed-drawer');
  if (!drawer || drawer.hidden) return;
  drawer.hidden = true;
  const tog = regionEl.querySelector(`[data-embed-toggle="${CSS.escape(drawer.dataset.embedKey)}"]`);
  if (tog) {
    tog.setAttribute('aria-expanded', 'false');
    tog.focus();
  }
});

// Click delegation — row copy buttons (CSS / Tailwind / Token) AND
// inline drawer snippet copy buttons.
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-copy]');
  if (!btn) return;
  e.stopPropagation();

  // "Get this font" snippet copy — payload travels inline on the button.
  if (btn.dataset.copy === 'snippet') {
    const text = btn.dataset.snippet || '';
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      showToast(`Copied ${btn.textContent.trim()}`);
    } catch (err) {
      showToast('Copy failed — clipboard blocked');
      console.error('[FontLens] clipboard write failed', err);
    }
    return;
  }

  // Style-row copy (CSS / Tailwind / Token).
  const row = btn.closest('.fl-row[data-detail]');
  if (!row) return;
  let detail;
  try { detail = JSON.parse(row.dataset.detail); } catch { return; }
  copyDetail(detail, btn.dataset.copy);
});

// ---------- Variable-font axis sliders ----------
const AXIS_THROTTLE_MS = 30;
function throttle(fn, ms) {
  let last = 0, pending = null, lastArgs = null;
  return function (...args) {
    lastArgs = args;
    const now = Date.now();
    const remain = ms - (now - last);
    if (remain <= 0) {
      last = now;
      fn.apply(this, lastArgs);
    } else if (!pending) {
      pending = setTimeout(() => {
        pending = null; last = Date.now();
        fn.apply(this, lastArgs);
      }, remain);
    }
  };
}

const applyAxes = throttle((styleKey, values) => {
  sendToContent({ type: 'fontlens:apply-axes', styleKey, values });
}, AXIS_THROTTLE_MS);

regionEl.addEventListener('input', (e) => {
  const input = e.target.closest('.fl-axis input[type="range"]');
  if (!input) return;
  const block = input.closest('.fl-axes');
  if (!block) return;
  const out = input.parentElement.querySelector('output');
  if (out) out.textContent = input.value;
  const values = {};
  for (const ax of block.querySelectorAll('.fl-axis')) {
    values[ax.dataset.tag] = Number(ax.querySelector('input').value);
  }
  applyAxes(block.dataset.styleKey, values);
});

regionEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.fl-axis-reset');
  if (!btn) return;
  const block = btn.closest('.fl-axes');
  if (!block) return;
  for (const ax of block.querySelectorAll('.fl-axis')) {
    const input = ax.querySelector('input');
    input.value = input.dataset.default;
    const out = ax.querySelector('output');
    if (out) out.textContent = input.dataset.default;
  }
  sendToContent({ type: 'fontlens:reset-axes', styleKey: block.dataset.styleKey });
});

// Default-format from chrome.storage.local (set by Options page — Phase 5)
if (typeof chrome !== 'undefined' && chrome.storage?.local) {
  chrome.storage.local.get(['defaultFormat']).then(({ defaultFormat: stored }) => {
    if (stored === 'css' || stored === 'tailwind' || stored === 'token') {
      defaultFormat = stored;
    }
  }).catch(() => {});
  chrome.storage.onChanged?.addListener?.((changes, area) => {
    if (area === 'local' && changes.defaultFormat) {
      const v = changes.defaultFormat.newValue;
      if (v === 'css' || v === 'tailwind' || v === 'token') defaultFormat = v;
    }
  });
}

// Resolve which payload to render based on the active mode.
function activePayload() {
  if (state.mode === 'inspect') return state.inspectPayload;
  // hover mode: synthesize a payload from accumulated picks
  if (!state.hoverPicks.length) return null;
  return {
    hostname: state.hoverHost,
    totalNodes: state.hoverPicks.length,
    truncated: false,
    groups: state.hoverPicks,
  };
}

function renderModeHint() {
  // A small contextual line above the cards. Tells the user what this mode does.
  let hint = document.getElementById('fl-hint');
  if (!hint) {
    hint = document.createElement('p');
    hint.id = 'fl-hint';
    hint.className = 'fl-hint';
    summaryEl.insertAdjacentElement('afterend', hint);
  }
  if (state.mode === 'inspect') {
    hint.textContent = 'Inspect mode — every type style used on this page.';
    hint.hidden = false;
  } else if (state.hoverPicks.length) {
    hint.innerHTML = '';
    const span = document.createElement('span');
    span.textContent = `${state.hoverPicks.length} pinned. Click more text to add — `;
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'fl-hint-clear';
    clear.textContent = 'Clear';
    clear.addEventListener('click', clearHoverPicks);
    hint.appendChild(span);
    hint.appendChild(clear);
    hint.hidden = false;
  } else {
    hint.hidden = true;
  }
}

function clearHoverPicks() {
  state.hoverPicks = [];
  state.payload = null;
  paint();
}

function paint() {
  renderHeader(headerEl, { mode: state.mode });
  state.payload = activePayload();
  updateDownloadEnabled();
  renderModeHint();

  if (!state.payload || !state.payload.groups.length) {
    renderBanner(bannerEl, bannerText, { fallbackCount: 0 });
    summaryEl.textContent = '';
    renderEmptyForMode();
    return;
  }
  const fallbackCount = state.payload.groups.filter(g => g.isFallback).length;
  renderBanner(bannerEl, bannerText, { fallbackCount });
  // Summary only meaningful for the whole-page inspect view.
  if (state.mode === 'inspect') renderSummary(summaryEl, state.payload);
  else summaryEl.textContent = '';
  renderGroups(regionEl, state.payload, {
    onHighlight: (row) => {
      state.highlightedKey = row.key;
      sendToContent({ type: 'fontlens:highlight', key: row.key, nodeIds: row.nodeIds });
    },
    onUnhighlight: (row) => {
      state.highlightedKey = null;
      sendToContent({ type: 'fontlens:unhighlight', key: row.key });
    },
    onActivate: (row) => {
      copyDetail(row.detail, defaultFormat);
    },
    data: state.data,
  });
  annotateApproximateTailwind();
}

const ILLO_HOVER = `
<svg viewBox="0 0 96 96" width="96" height="96" fill="none" aria-hidden="true">
  <rect x="14" y="20" width="56" height="40" rx="6"
        stroke="currentColor" stroke-width="2" opacity="0.45"/>
  <path d="M27 34h30M27 42h22M27 50h16" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" opacity="0.45"/>
  <!-- cursor -->
  <path d="M52 50l22 9-9 3-3 9-10-21z" fill="currentColor"/>
  <path d="M52 50l22 9-9 3-3 9-10-21z" stroke="var(--bg)" stroke-width="1.5"
        stroke-linejoin="round"/>
</svg>`;

const ILLO_INSPECT = `
<svg viewBox="0 0 96 96" width="96" height="96" fill="none" aria-hidden="true">
  <path d="M20 24h44M20 34h44M20 44h30M20 54h44M20 64h24"
        stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.4"/>
  <!-- magnifier -->
  <circle cx="58" cy="50" r="16" stroke="currentColor" stroke-width="3"
          fill="var(--bg)"/>
  <path d="M58 44v12M52 50h12" stroke="currentColor" stroke-width="2.5"
        stroke-linecap="round" opacity="0.6"/>
  <path d="M70 62l10 10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
</svg>`;

function renderEmptyForMode() {
  regionEl.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'fl-empty-state';

  const illo = document.createElement('div');
  illo.className = 'fl-empty-illo';
  const title = document.createElement('p');
  title.className = 'fl-empty-title';
  const sub = document.createElement('p');
  sub.className = 'fl-empty-sub';

  if (state.mode === 'inspect') {
    illo.innerHTML = ILLO_INSPECT;
    title.textContent = 'Scanning this page';
    sub.textContent = 'Every font and type style in use will appear here. Click any text if nothing shows.';
  } else {
    illo.innerHTML = ILLO_HOVER;
    title.textContent = 'Pin a font to start';
    sub.textContent = 'Hover any text on the page, then click to pin its card here. Pin as many as you like.';
  }

  box.appendChild(illo);
  box.appendChild(title);
  box.appendChild(sub);
  regionEl.appendChild(box);
}

function applyTheme(theme) {
  // Only light / dark now. Anything else (legacy 'auto') resolves to light.
  const t = theme === 'dark' ? 'dark' : 'light';
  state.theme = t;
  document.documentElement.setAttribute('data-theme', t);
  if (themeEl) {
    themeEl.setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  }
}

function updateDownloadEnabled() {
  if (!downloadEl) return;
  const has = !!(state.payload && state.payload.groups && state.payload.groups.length);
  downloadEl.disabled = !has;
}

function downloadTokens() {
  if (!state.payload || !state.payload.groups?.length) return;
  const doc = toTokenDoc(state.payload, { generatedAt: new Date().toISOString() });
  const json = JSON.stringify(doc, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = tokenFilename(state.payload, 'json');
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast(`Downloaded ${doc.styleCount} type styles`);
}

function bindHeader() {
  document.getElementById('fl-mode-hover').addEventListener('click', () => {
    state.mode = 'hover';
    sendToContent({ type: 'fontlens:set-mode', mode: 'hover' });
    paint(); // shows accumulated hover picks (or empty-state prompt)
  });
  document.getElementById('fl-mode-inspect').addEventListener('click', () => {
    state.mode = 'inspect';
    state.inspectPayload = null;            // clear stale full-page result
    sendToContent({ type: 'fontlens:set-mode', mode: 'inspect' });
    sendToContent({ type: 'fontlens:request-extract' }); // pull whole-page typography
    paint(); // shows "Scanning…" until extract-result lands
  });

  // Single theme toggle: flip light ↔ dark.
  themeEl?.addEventListener('click', async () => {
    const next = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    await saveTheme(next);
  });

  downloadEl?.addEventListener('click', downloadTokens);
}

function bindKeyboard() {
  regionEl.addEventListener('keydown', (e) => {
    const rows = regionEl.querySelectorAll('.fl-row');
    if (!rows.length) return;
    const focused = document.activeElement?.closest?.('.fl-row');
    const focusedIndex = focused ? Number(focused.dataset.rowIndex) : -1;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focusRow(regionEl, Math.min(rows.length - 1, focusedIndex + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        focusRow(regionEl, Math.max(0, focusedIndex - 1));
        break;
      case 'Home':
        e.preventDefault();
        focusRow(regionEl, 0);
        break;
      case 'End':
        e.preventDefault();
        focusRow(regionEl, rows.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        focused?.click();
        break;
      case 'Escape':
        e.preventDefault();
        state.mode = 'hover';
        sendToContent({ type: 'fontlens:set-mode', mode: 'hover' });
        paint();
        break;
    }
  });
}

function bindMessages() {
  onContentMessage((msg) => {
    if (msg.type === 'fontlens:extract-result') {
      // Full-page extract — only drives the panel while in inspect mode.
      state.inspectPayload = msg.payload;
      if (state.mode === 'inspect') paint();
    } else if (msg.type === 'fontlens:mode-changed') {
      // Mirror page-side mode changes (e.g. Esc from the overlay).
      if (msg.mode === state.mode) return;
      state.mode = msg.mode;
      if (msg.mode === 'inspect') {
        state.inspectPayload = null;
        sendToContent({ type: 'fontlens:request-extract' });
      }
      paint();
    } else if (msg.type === 'fontlens:hover-pick') {
      // Append the clicked card to the hover stack (dedupe). Hover only.
      if (state.mode !== 'hover') return;
      state.hoverHost = msg.payload.hostname || state.hoverHost;
      const group = msg.payload.group;
      const key = pickKey(group);
      if (!state.hoverPicks.some(g => pickKey(g) === key)) {
        state.hoverPicks.push(group);
      }
      paint();
    }
  });
}

function bindFocusRehydrate() {
  window.addEventListener('focus', () => {
    sendToContent({ type: 'fontlens:request-extract' });
  });
}

async function ensureContent() {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
  try {
    const p = chrome.runtime.sendMessage({ type: 'fontlens:ensure-content' });
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch {}
}

(async function init() {
  state.theme = await loadTheme();
  applyTheme(state.theme);
  // Load bundled font datasets in parallel with the rest of init.
  const dataPromise = Promise.all([
    loadJsonFromExt('data/google-fonts.json'),
    loadJsonFromExt('data/paid-fonts.json'),
  ]).then(([g, p]) => {
    state.data.google = g || {};
    state.data.paid   = p || {};
    if (state.payload) paint();  // re-render once data lands if payload arrived first
  });
  bindHeader();
  bindKeyboard();
  bindMessages();
  bindFocusRehydrate();
  paint();
  // Two paths to receive the first payload:
  //   a) If the content script is already loaded (toolbar click ran it),
  //      this direct tab message gets the extract started.
  //   b) If the panel opened first (e.g. Chrome's side-panel selector),
  //      the SW handler injects the loader and re-kicks request-extract.
  sendToContent({ type: 'fontlens:request-extract' });
  ensureContent();
})();
