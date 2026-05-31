import {
  sendToContent, onContentMessage, loadTheme, saveTheme,
} from './messaging.js';
import {
  renderHeader, renderBanner, renderSummary, renderGroups,
  renderEmpty, focusRow,
} from './render.js';

const state = {
  mode: 'hover',
  theme: 'auto',
  payload: null,
  highlightedKey: null,
};

const headerEl   = document.querySelector('header.fl-header');
const bannerEl   = document.getElementById('fl-banner');
const bannerText = document.getElementById('fl-banner-text');
const summaryEl  = document.getElementById('fl-summary');
const regionEl   = document.getElementById('fl-region');

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
      window.dispatchEvent(new CustomEvent('fontlens:activate', { detail: row }));
    },
  });
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

(async function init() {
  state.theme = await loadTheme();
  applyTheme(state.theme);
  bindHeader();
  bindKeyboard();
  bindMessages();
  bindFocusRehydrate();
  paint();
  sendToContent({ type: 'fontlens:request-extract' });
})();
