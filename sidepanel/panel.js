import {
  sendToContent, onContentMessage, loadTheme, saveTheme,
} from './messaging.js';
import {
  renderHeader, renderBanner, renderSummary, renderGroups,
  renderEmpty, focusRow,
} from './render.js';
import { toCSS, toTailwind, toTailwindStructured, toToken } from '../lib/export.js';

const state = {
  mode: 'hover',
  theme: 'auto',
  payload: null,
  highlightedKey: null,
  data: { google: {}, paid: {} },  // bundled font datasets, loaded once on init
};

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

// Click delegation — row copy buttons (CSS / Tailwind / Token) AND
// "Get this font" snippet buttons (Link / Import / CSS / etc.).
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

function paint() {
  renderHeader(headerEl, { mode: state.mode, theme: state.theme });
  if (!state.payload || !state.payload.groups.length) {
    renderBanner(bannerEl, bannerText, { fallbackCount: 0 });
    summaryEl.textContent = '';
    renderEmpty(regionEl);
    return;
  }
  const fallbackCount = state.payload.groups.filter(g => g.isFallback).length;
  renderBanner(bannerEl, bannerText, { fallbackCount });
  renderSummary(summaryEl, state.payload);
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

function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
}

function bindHeader() {
  document.getElementById('fl-mode-hover').addEventListener('click', () => {
    state.mode = 'hover';
    sendToContent({ type: 'fontlens:set-mode', mode: 'hover' });
    paint();
  });
  document.getElementById('fl-mode-inspect').addEventListener('click', () => {
    state.mode = 'inspect';
    sendToContent({ type: 'fontlens:set-mode', mode: 'inspect' });
    paint();
  });

  for (const t of ['auto', 'light', 'dark']) {
    document.getElementById(`fl-theme-${t}`).addEventListener('click', async () => {
      applyTheme(t);
      await saveTheme(t);
      paint();
    });
  }
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
      state.payload = msg.payload;
      paint();
    } else if (msg.type === 'fontlens:mode-changed') {
      state.mode = msg.mode;
      paint();
    } else if (msg.type === 'fontlens:hover-pick') {
      state.payload = {
        hostname: msg.payload.hostname,
        totalNodes: 1,
        truncated: false,
        groups: [msg.payload.group],
      };
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
